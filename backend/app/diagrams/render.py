"""Code-rendered diagrams (CLAUDE.md §11): accurate figures, never image models.

Safety model: the LLM emits a constrained JSON *spec* (curves as maths
expressions, ranges, labels) — it never writes code we execute. This module
validates the spec (SymPy-parsed expressions over x only, capped counts/ranges)
and renders it with Matplotlib. Wrong or hostile specs fail closed to "no figure".
"""
from __future__ import annotations

import base64
import io
import json
import re

import matplotlib

matplotlib.use("Agg")  # headless — no GUI backend on the server
import matplotlib.pyplot as plt
import numpy as np
import sympy as sp

import urllib.parse
import urllib.request
import requests

# Questions where a rendered figure genuinely helps (plots, structures, processes, images).
_DIAGRAM_HINT = re.compile(
    r"\b("
    # Explicit visual requests
    r"diagram|figure|illustration|illustration of|schematic|sketch|drawing|"
    r"label(l?ed)?|labels|with labels|neat diagram|neat label(l?ed)? diagram|"
    r"picture|image|photo|visual|visualize|visual representation|"
    r"graph|plot|curve|parabola|sine wave|cos(ine)? curve|number line|y\s*=|f\s*\(x\)|"
    # Structural & anatomical views
    r"structure of|parts of|anatomy of|internal view|cross[- ]section|cutaway|"
    r"layers of|sagittal|longitudinal section|"
    # Cycles, processes & flowcharts
    r"cycle|flow ?chart|reflex arc|food chain|food web|pathway|stages of|life cycle|"
    # Physics & chemistry visuals
    r"ray diagram|circuit diagram|electric circuit|free body diagram|fbd|"
    r"magnetic field lines|bohr model|galvanic cell|electrochemical cell|blast furnace|"
    # Verbs + entity intent
    r"(draw|sketch|show|illustrate|generate|visualize|display|give me|explain).{0,25}"
    r"(diagram|image|picture|figure|illustration|drawing|schematic|structure|anatomy|parts)"
    r")\b",
    re.IGNORECASE,
)

# Step 1 — the diagram router: classify what KIND of figure serves the question
# and emit its payload (for plots, flows, or educational images/schematics).
ROUTER_SYSTEM_PROMPT = (
    "You are a master scientific visual illustrator and curriculum diagram planner for a school AI tutor.\n"
    "Analyze the student's question and decide what visual figure or labelled diagram will best help them understand and score in exams.\n"
    "Reply with ONLY a valid JSON object.\n\n"
    "VISUAL KINDS:\n"
    '1. MATHS FUNCTION GRAPH (curves, lines, parabolas, polynomials, trigonometric functions):\n'
    '{"kind":"plot","title":"...","xlabel":"x","ylabel":"y","x_min":-5,"x_max":5,"curves":[{"expr":"x**2 - 4","label":"y = x^2 - 4"}],"points":[{"x":2,"y":0,"label":"(2, 0)"}]}\n'
    '— expr must be single variable x, Python syntax (** for power; sin, cos, tan, exp, log, sqrt, Abs, pi).\n\n'
    '2. PROCESS / CYCLE / FLOWCHART (water cycle, reflex arc, nitrogen cycle, photosynthesis stages, digestion path):\n'
    '{"kind":"flow","mermaid":"flowchart TD\\n  A[\\"Stage 1\\"] -->|action| B[\\"Stage 2\\"]"}\n'
    '— mermaid flowchart TD only, max 14 nodes, short quoted node labels.\n\n'
    '3. LABELLED EDUCATIONAL DIAGRAM / SCIENTIFIC ILLUSTRATION (human organs like heart, nephron, eye, ear, brain; cells like plant cell, animal cell, neuron; physics apparatus like electric motor, generator, ray diagrams, prism; chemistry setups like galvanic cell, blast furnace; geography like layers of earth, volcano):\n'
    '{\n'
    '  "kind": "image",\n'
    '  "subject": "Human Heart Anatomy",\n'
    '  "view": "Internal coronal cross-section showing all 4 chambers, valves, and major blood vessels",\n'
    '  "labels": ["Superior Vena Cava", "Inferior Vena Cava", "Aorta", "Pulmonary Artery", "Pulmonary Veins", "Left Atrium", "Right Atrium", "Left Ventricle", "Right Ventricle", "Tricuspid Valve", "Bicuspid Valve", "Septum"],\n'
    '  "search_query": "human heart internal cross section labelled diagram textbook"\n'
    '}\n'
    '— subject: concise standard academic topic.\n'
    '— view: specific cross-section, angle, or cutaway needed for teaching.\n'
    '— labels: 4-12 essential syllabus labels that a textbook diagram must show.\n'
    '— search_query: 4-8 words optimized for searching authentic textbook diagrams.\n\n'
    '4. NO DIAGRAM HELPS (pure conversation, simple text, basic arithmetic):\n'
    '{"kind":"none"}\n\n'
    "JSON ONLY. No markdown fences, no explanations."
)

# Kept for compatibility with the plot renderer's contract.
SPEC_SYSTEM_PROMPT = ROUTER_SYSTEM_PROMPT


def schematic_prompt(subject: str, labels: list[str]) -> str:
    return (
        "You are a precise textbook illustrator. Draw a SIMPLIFIED, clean schematic "
        f"diagram of: {subject}.\n"
        f"Include exactly these labels: {', '.join(labels)}.\n"
        "STRICT RULES:\n"
        '- Output ONLY an <svg> element, nothing else. viewBox="0 0 480 380", no '
        "width/height attributes.\n"
        '- First child: <rect x="0" y="0" width="480" height="380" fill="#ffffff"/>.\n'
        "- Allowed tags ONLY: svg, g, rect, circle, ellipse, line, polyline, polygon, "
        "path, text, defs, marker. Nothing else — no script, style, image, use, "
        "foreignObject, animate.\n"
        '- No attribute starting with "on". No href or xlink:href anywhere.\n'
        "- Simplified flat-colour shapes (soft pastel fills, 2px #23232a outlines). "
        "Structurally CORRECT for teaching — relative positions and connections must "
        "be right, artistic detail must not.\n"
        '- Each label: <text font-size="13" font-family="sans-serif" fill="#23232a"> '
        "placed clear of the shapes, with a thin leader line (#5b5b66) to its part. "
        "Labels must not overlap shapes or each other.\n"
        '- Title top-centre: <text x="240" y="24" text-anchor="middle" '
        'font-size="16" font-weight="bold">.\n'
        "- At most 80 elements."
    )


# SVG safety: the model's markup is only ever shown inside an <img> (which cannot
# run scripts), but we still reject anything with active-content markers.
_SVG_FORBIDDEN = (
    "<script", "onload", "onclick", "onerror", "onmouse", "onfocus", "javascript:",
    "<foreignobject", "<image", "<iframe", "<embed", "<object", "xlink:href",
    "href=", "<use", "<style", "<animate", "<link", "<meta", "expression(",
)


def sanitize_svg(raw: str) -> str | None:
    m = re.search(r"<svg[\s\S]*?</svg>", raw or "", re.IGNORECASE)
    if not m:
        return None
    svg = m.group(0)
    if len(svg) > 60_000:
        return None
    low = svg.lower()
    if any(tok in low for tok in _SVG_FORBIDDEN):
        return None
    if "viewbox" not in low:
        return None
    return svg


def svg_to_data_url(svg: str) -> str:
    from urllib.parse import quote

    return "data:image/svg+xml;utf8," + quote(svg)


def _is_image_reachable(url: str, timeout: float = 2.5) -> bool:
    """Verify that an image URL responds with 200 and image MIME type."""
    if not url or not url.startswith("http"):
        return False
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
    }
    try:
        r = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", "").lower():
            return True
        r = requests.get(url, headers=headers, timeout=timeout, stream=True)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", "").lower():
            return True
    except Exception:
        pass
    return False


def fetch_educational_image(
    subject: str,
    query: str = "",
    labels: list[str] | None = None,
    view: str = "",
    search_query: str = "",
) -> str | None:
    """Fetch or synthesize a high-yield educational image or authentic labelled textbook diagram.
    Tier 1: High-Yield Academic Search via Tavily (Britannica, OpenStax, LibreTexts, Wikimedia SVGs).
    Tier 2: SOTA AI Scientific Diagram Synthesis (Pollinations Flux model with clean white background and labels).
    Returns an image URL or data URL.
    """
    raw_term = (subject or query or "").strip()
    # NEVER synthesize images for textbook pages / lesson scans — those come from real PDFs
    if re.search(r"\bpage\s*\d+\b|\btextbook\b|\bchapter\s*\d+\s*page\b|\bmilestone\b", raw_term, re.IGNORECASE):
        return None

    clean_subj = re.sub(r"[^a-zA-Z0-9\s\-]", " ", raw_term).strip()
    if not clean_subj or re.search(r"^(page|chp|chapter)\s*\d+$", clean_subj, re.IGNORECASE):
        return None

    # Construct the targeted academic search query
    eff_query = (search_query or "").strip()
    if not eff_query:
        bits = [clean_subj]
        if view:
            bits.append(view)
        bits.append("labelled diagram textbook")
        eff_query = " ".join(bits)

    # Clean conversational filler words
    eff_query = re.sub(
        r"\b(explain|me|please|can you|draw|generate|show me|want to see|tell me about)\b",
        "", eff_query, flags=re.IGNORECASE
    ).strip()

    # Tier 1: Search authoritative educational and textbook archives via Tavily
    try:
        from app.config.settings import Settings
        settings = Settings()
        tavily_keys = settings.tavily_api_keys
        for key in tavily_keys:
            try:
                res = requests.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": key,
                        "query": eff_query,
                        "include_images": True,
                        "max_results": 6,
                    },
                    timeout=5,
                )
                if res.status_code != 200:
                    continue
                data = res.json()
                candidate_images = data.get("images", [])
                if not candidate_images:
                    continue

                # Sort / prioritize authentic educational domains
                edu_domains = (
                    "britannica.com", "wikimedia.org", "openstax.org", "libretexts.org",
                    "pressbooks.pub", "sciencedirect.com", "nature.com", "amnh.org",
                    "snexplores.org", "clevelandclinic.org", "physio-pedia.com",
                    "biologydictionary.net", "byjus.com", "vedantu.com", "geeksforgeeks.org",
                )
                filtered: list[str] = []
                for img_url in candidate_images:
                    if not isinstance(img_url, str) or not img_url.startswith("http"):
                        continue
                    low = img_url.lower()
                    if any(bad in low for bad in ("avatar", "logo", "favicon", "banner", "author", "header", "icon", "placeholder", "badge", "button")):
                        continue
                    filtered.append(img_url)

                # Educational domains first
                sorted_candidates = sorted(
                    filtered,
                    key=lambda u: 0 if any(d in u.lower() for d in edu_domains) else 1
                )

                for candidate in sorted_candidates:
                    if _is_image_reachable(candidate, timeout=2.5):
                        return candidate
            except Exception:
                continue
    except Exception:
        pass

    # Tier 2: SOTA AI Educational Diagram Synthesis (Pollinations Flux High-Resolution)
    try:
        labels_clause = f"with clearly labeled text callouts pointing to: {', '.join(labels[:10])}. " if labels else "with neat labels and pointer lines. "
        view_clause = f"showing {view}. " if view else ""
        academic_prompt = (
            f"Clean educational textbook diagram of {clean_subj}, {view_clause}{labels_clause}"
            "Detailed scientific illustration, sharp anatomical cross-section, clean white background, "
            "crisp vector line art, high contrast, bold legible English text labels, "
            "official NCERT Cambridge university biology physics textbook diagram style, 4k high resolution"
        )
        poll_url = (
            f"https://image.pollinations.ai/prompt/{urllib.parse.quote(academic_prompt)}?model=flux&width=1024&height=768&nologo=true"
        )
        return poll_url
    except Exception:
        return None


def looks_like_mermaid(code: str) -> bool:
    c = (code or "").strip()
    return (
        bool(c)
        and len(c) < 4000
        and "<" not in c
        and c.split()[0].lower() in ("flowchart", "graph")
    )

_ALLOWED_FUNCS = {
    "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "exp": sp.exp, "log": sp.log,
    "sqrt": sp.sqrt, "Abs": sp.Abs, "abs": sp.Abs, "pi": sp.pi, "E": sp.E,
}
_X = sp.Symbol("x")
_EXPR_OK = re.compile(r"^[0-9a-zA-Z+\-*/^(). ,_]*$")

BRAND = "#4f46e5"
PALETTE = [BRAND, "#0e9f6e", "#d97706", "#dc2626"]


def wants_diagram(text: str) -> bool:
    if not text:
        return False
    # If the student asks for a textbook page or chapter scan, rely on the textbook service (real PDF scan)
    if re.search(r"\bpage\s*\d+\b|\btextbook\s*page\b|\bchapter\s*\d+\s*page\b|\bmilestone\b", text, re.IGNORECASE):
        return False
    return bool(_DIAGRAM_HINT.search(text or ""))


def _parse_expr(raw: str) -> sp.Expr | None:
    raw = (raw or "").strip()
    if not raw or len(raw) > 120 or not _EXPR_OK.match(raw):
        return None
    try:
        e = sp.sympify(raw.replace("^", "**"), locals=_ALLOWED_FUNCS)
    except Exception:
        return None
    if not e.free_symbols <= {_X}:
        return None  # only x may appear — nothing else sneaks in
    return e


def render_figure(raw_spec: str) -> str | None:
    """Validate the LLM's JSON spec and render a PNG. Returns a data URL or None."""
    m = re.search(r"\{.*\}", raw_spec or "", re.DOTALL)
    if not m:
        return None
    try:
        spec = json.loads(m.group(0))
    except Exception:
        return None
    if not isinstance(spec, dict):
        return None
    if not (spec.get("needed") or spec.get("kind") == "plot"):
        return None

    try:
        x_min = float(spec.get("x_min", -10))
        x_max = float(spec.get("x_max", 10))
    except Exception:
        x_min, x_max = -10.0, 10.0
    if not (np.isfinite(x_min) and np.isfinite(x_max)) or x_max <= x_min:
        x_min, x_max = -10.0, 10.0
    if x_max - x_min > 1000:
        x_max = x_min + 1000

    curves = [c for c in spec.get("curves", []) if isinstance(c, dict)][:3]
    xs = np.linspace(x_min, x_max, 500)
    plotted = []
    for c in curves:
        e = _parse_expr(str(c.get("expr", "")))
        if e is None:
            continue
        try:
            f = sp.lambdify(_X, e, modules=["numpy"])
            ys = np.asarray(f(xs), dtype=float)
            if ys.ndim == 0:  # constant expression
                ys = np.full_like(xs, float(ys))
            ys[~np.isfinite(ys)] = np.nan
        except Exception:
            continue
        if np.all(np.isnan(ys)):
            continue
        plotted.append((str(c.get("label", ""))[:60], ys))
    if not plotted:
        return None

    fig, ax = plt.subplots(figsize=(5.4, 3.7), dpi=115)
    try:
        for i, (label, ys) in enumerate(plotted):
            ax.plot(xs, ys, color=PALETTE[i % len(PALETTE)], linewidth=2.2,
                    label=label or None)
        for p in [p for p in spec.get("points", []) if isinstance(p, dict)][:5]:
            try:
                px, py = float(p["x"]), float(p["y"])
            except Exception:
                continue
            ax.plot([px], [py], "o", color="#23232a", markersize=5, zorder=5)
            lbl = str(p.get("label", ""))[:30]
            if lbl:
                ax.annotate(lbl, (px, py), textcoords="offset points",
                            xytext=(7, 7), fontsize=8.5, color="#23232a")
        ax.axhline(0, color="#c9c7c2", linewidth=1)
        ax.axvline(0, color="#c9c7c2", linewidth=1)
        ax.grid(True, alpha=0.28, linewidth=0.6)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        try:
            if spec.get("title"):
                ax.set_title(str(spec["title"])[:80], fontsize=11)
            ax.set_xlabel(str(spec.get("xlabel", "x"))[:30], fontsize=9.5)
            ax.set_ylabel(str(spec.get("ylabel", "y"))[:30], fontsize=9.5)
        except Exception:
            pass  # a bad mathtext label must not kill the figure
        if any(lbl for lbl, _ in plotted):
            ax.legend(fontsize=9, frameon=False)
        ax.tick_params(labelsize=8.5)
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="white")
    finally:
        plt.close(fig)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


