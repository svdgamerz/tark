"""Interactive Visual Simulations Engine (Virtualization).

Provides curriculum-aligned interactive simulations with live variable sliders,
pedagogical readouts, and HTML5 canvas animations for physics, math, chemistry, and biology.
"""
from __future__ import annotations

import re
import json
import asyncio
import logging
from typing import Any

from app.simulations.grounding import find_textbook_grounding_for_topic

logger = logging.getLogger(__name__)

# Matchers for core curriculum simulations
_SIM_TRIGGERS: list[tuple[str, str, str, str, str, dict[str, float]]] = [
    # Physics Built-ins
    (
        "projectile",
        r"\b(projectile|trajectory|launch angle|time of flight|horizontal range|cannonball|parabolic motion)\b",
        "Projectile Motion Simulator",
        "Physics - Mechanics",
        "Parabolic 2D Kinematics",
        {"angle": 45, "speed": 25, "gravity": 9.8},
    ),
    (
        "pendulum",
        r"\b(pendulum|oscillat|time period.*pendulum|simple harmonic motion|shm|bob)\b",
        "Simple Pendulum & Energy Exchange",
        "Physics - Oscillations",
        "Simple Harmonic Motion & Energy Conservation",
        {"length": 1.5, "angle": 30, "gravity": 9.8},
    ),
    (
        "ohms_law",
        r"\b(ohm'?s law|v\s*=\s*i\s*r|electric circuit|resistor.*voltage|current and resistance|lightbulb.*circuit)\b",
        "Ohm's Law & Circuit Lab",
        "Physics - Electricity",
        "Voltage, Resistance & Electric Current (V = IR)",
        {"voltage": 9, "resistance": 15},
    ),
    (
        "waves",
        r"\b(double[- ]slit|interference.*light|young'?s double|fringe width|wave optics|fringe pattern)\b",
        "Wave Interference & Double-Slit Pattern",
        "Physics - Wave Optics",
        "Young's Double Slit Experiment & Fringe Spacing",
        {"wavelength": 550, "slitDist": 0.25, "screenDist": 1.2},
    ),
    (
        "gas_law",
        r"\b(ideal gas|boyle'?s law|charles'?s law|pv\s*=\s*nrt|gas pressure|piston.*gas|gas cylinder)\b",
        "Ideal Gas Law & Piston Chamber",
        "Chemistry / Physics - Thermodynamics",
        "Boyle's, Charles's & Ideal Gas Law (PV = nRT)",
        {"temp": 300, "volume": 5, "moles": 1.0},
    ),
    (
        "quadratic",
        r"\b(quadratic.*curve|parabola|vertex.*parabola|roots.*quadratic|ax\^?2|quadratic function)\b",
        "Quadratic Curves & Roots Explorer",
        "Mathematics - Algebra",
        "Parabola Properties, Vertex & Discriminant",
        {"a": 1, "b": -2, "c": -3},
    ),
    (
        "ray_optics",
        r"\b(convex lens|concave lens|ray optics|lens formula|1/v|ray diagram.*lens|thin lens)\b",
        "Geometric Optics & Ray Tracing",
        "Physics - Optics",
        "Thin Lens Equation & Image Formation",
        {"focal": 15, "objDist": 30, "objHeight": 25},
    ),
    # Chemistry Built-ins
    (
        "titration",
        r"\b(titrat|acid[- ]base|ph curve|neutraliz|equivalence point|burette|phenolphthalein)\b",
        "Acid-Base Titration Curve & pH",
        "Chemistry - Analytical",
        "Strong Acid - Strong Base Titration (HCl + NaOH)",
        {"vAdded": 18, "cAcid": 0.1, "cBase": 0.1},
    ),
    (
        "atomic_orbitals",
        r"\b(bohr'?s? (?:atom|model)|energy level|balmer|lyman|paschen|spectral (?:line|series)|electron jump)\b",
        "Bohr Hydrogen Atom & Spectral Lines",
        "Chemistry / Physics - Quantum",
        "Bohr Postulates & Photon Energy Transitions",
        {"nInitial": 3, "nFinal": 2},
    ),
    (
        "electrolysis",
        r"\b(electrolysis|hoffman voltameter|split.*water|water electrolysis|anode.*cathode.*(?:hydrogen|oxygen))\b",
        "Electrolysis of Water & Faraday",
        "Chemistry - Electrochemistry",
        "Hoffman Voltameter: 2H2O -> 2H2 + O2 (2:1 Ratio)",
        {"voltage": 6, "current": 2.0, "timeElapsed": 25},
    ),
    # Physics Electromagnetism
    (
        "magnetic_fields",
        r"\b(bar magnet|magnetic dipole|field lines.*magnet|compass.*magnet|magnetic field.*dipole)\b",
        "Magnetic Field Lines & Dipole",
        "Physics - Magnetism",
        "Bar Magnet Vector Field & Compass Orientation",
        {"strength": 25, "compassX": 65, "compassY": -45},
    ),
    (
        "em_induction",
        r"\b(faraday'?s law|electromagnetic induction|induced emf|lenz'?s law|magnet.*coil|solenoid.*induction)\b",
        "Electromagnetic Induction & Faraday's Law",
        "Physics - Electromagnetism",
        "Faraday's & Lenz's Law: EMF = -N(dΦ/dt)",
        {"turns": 200, "speed": 3, "magnetStrength": 1.5},
    ),
    # Biology Built-ins
    (
        "mitosis",
        r"\b(mitosis|cell division|prophase|metaphase|anaphase|telophase|spindle fiber|chromatid.*separat)\b",
        "Cell Division (Stages of Mitosis)",
        "Biology - Cell Biology",
        "Somatic Equational Division (2n -> 2n)",
        {"stage": 2},
    ),
    (
        "circulatory_heart",
        r"\b(human heart|double circulation|atrium.*ventricle|cardiac cycle|systole|diastole|heart.*blood flow|ecg.*heart)\b",
        "Heart & Double Circulation System",
        "Biology - Human Physiology",
        "4-Chamber Cardiac Cycle & Pulmonary/Systemic Loops",
        {"bpm": 72, "strokeVol": 70},
    ),
    (
        "dna_replication",
        r"\b(dna replication|replication fork|okazaki|helicase|dna polymerase|base pairing|leading strand|lagging strand)\b",
        "DNA Replication & Base Pairing",
        "Biology - Genetics & Molecular Biology",
        "Semi-Conservative Replication Fork & Polymerase III",
        {"speed": 40, "proofreading": 99},
    ),
    (
        "photosynthesis",
        r"\b(photosynthesis|thylakoid|light reaction|photolysis|photosystem|atp synthase|chloroplast.*light)\b",
        "Photosynthesis & Light Reactions",
        "Biology - Plant Physiology",
        "Thylakoid Membrane Z-Scheme & ATP Synthase",
        {"lightIntensity": 80, "co2Level": 400},
    ),
    (
        "chemical_bonding",
        r"\b(chemical bond|covalent bond|ionic bond|lennard[- ]jones|molecular orbital|electron sharing|inter-?nuclear distance|electronegativity diff)\b",
        "Chemical Bonding (Ionic vs Covalent)",
        "Chemistry - Chemical Structure",
        "Lennard-Jones Potential & Orbital Electron Overlap",
        {"distance": 74, "bondMode": 1, "enDiff": 0.4},
    ),
    (
        "neuron_action_potential",
        r"\b(action potential|neuron.*potential|synapse|synaptic|neurotransmitter|depolariz.*axon|hodgkin|resting potential.*-70)\b",
        "Neuron Action Potential & Synapse",
        "Biology - Neurobiology",
        "Axon Voltage-Gated Channels & Synaptic Exocytosis",
        {"stimulus": -50, "caLevel": 70},
    ),
    (
        "osmosis",
        r"\b(osmosis|semi[- ]permeable|water potential|hypotonic|hypertonic|isotonic|plasmolysis|osmotic pressure|turgor pressure|u[- ]tube.*membrane|reverse osmosis)\b",
        "Osmosis & Water Potential Lab",
        "Biology - Cell Physiology",
        "Semipermeable Membrane & Water Potential (Ψ = Ψs + Ψp)",
        {"mode": 0, "cLeft": 0.05, "cRight": 0.85, "poreSize": 1.2, "appliedP": 0},
    ),
]


def detect_simulation_candidate(text: str) -> dict[str, Any] | None:
    """Detect if a user prompt matches one of the high-yield built-in simulation templates."""
    if not text:
        return None

    # Check against known curriculum models
    for sim_type, pattern, title, subject, concept, default_params in _SIM_TRIGGERS:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "id": f"sim_{sim_type}_{abs(hash(text)) % 10000}",
                "type": sim_type,
                "title": title,
                "subject": subject,
                "concept": concept,
                "description": f"Interactive model for {concept}. Adjust sliders to explore the concept in real time.",
                "params": default_params,
            }

    return None


CUSTOM_SIM_SYSTEM_PROMPT = """You are a world-class principal educational simulation architect, computational physicist, and visual science engineer.
The student needs a high-fidelity, photorealistic, interactive laboratory simulation for a STEM curriculum topic.

Generate a COMPLETE, self-contained single-page HTML5 application with embedded CSS and JavaScript that runs directly inside an iframe.
CRITICAL MANDATE: The simulation must look and feel like an authentic, premium virtual laboratory experiment—NOT a crude or simplistic cartoon. It must be dynamically alive at 60 FPS immediately upon load with ZERO lag.

VISUAL & ARCHITECTURAL SPECIFICATIONS:
1. Photorealistic Laboratory Rendering & Physical Depth:
   - Laboratory Backdrop: Dark professional workbench theme (#080d1a or #0b1120) with a subtle scientific grid/optical breadboard overlay.
   - 3D Volumetric Shading & Real Material Properties:
     * METALS & SPRINGS: Springs must NEVER be single 2D zig-zag lines. Draw coiled helical 3D springs with overlapping front/back passes, cylindrical lighting gradients (steel/chrome with specular highlight streak and shadow depth), hanging brass/cast-iron slotted weights with metallic sheen, suspension clamps, and realistic centimeter ruler scales.
     * SPHERES & MASSES: Use off-center radial gradients (createRadialGradient(x - r*0.35, y - r*0.35, 1, x, y, r)) with bright specular hotspots, ambient gradient, and soft contact drop-shadows beneath them.
     * VOLUMETRIC GLASSWARE & FLUIDS: Beakers, flasks, and U-tubes must have realistic glass rim reflections (rgba(255,255,255,0.45)), fluid meniscus curvature, wave dynamics at the liquid surface, and rising effervescent bubbles with light refraction.
     * OPTICS & LIGHT RAYS: Render beams with glowing additive blending (ctx.globalCompositeOperation = 'lighter'), soft Gaussian aura, realistic glass prism refraction, and chromatic dispersion into rainbow spectral bands.
     * BIOLOGY & ORGANELLES: Phospholipid bilayers with double-headed hydrophilic spheres, fluid membrane elastic deformation, realistic organelle textures, and Brownian movement of cytoplasmic vesicles.
     * VECTORS & FIELDS: Real-time dynamic vector arrows (Force in Amber #f59e0b, Velocity in Sky Blue #38bdf8, Acceleration in Pink #f472b6) with sleek arrowheads and live magnitude readouts.

2. Silky-Smooth 60 FPS Physics Engine (ZERO LAG):
   - AUTO-PLAY ON LOAD: The animation loop MUST start running immediately on page load (`let isPlaying = true;`). The canvas must NEVER be frozen or static when opened.
   - Performance: Pre-allocate all particle pools and object arrays outside the loop. NEVER create new objects, strings, or arrays inside requestAnimationFrame.
   - Smooth Delta Time: Use `const dt = Math.min((now - lastTime) / 1000, 0.04);` for smooth, lag-free numerical integration (Euler/Verlet/RK4).
   - High-DPI Retina Crispness: Support `window.devicePixelRatio` so lines and curves are razor sharp on all displays.

3. Direct Interactive Manipulation (Grab & Drag):
   - Allow students to directly interact with the canvas via mouse and touch events (e.g. click and drag the spring mass to stretch/release it, drag the pendulum bob, rotate the prism, slide the piston).
   - Show dynamic cursor feedback (`cursor: grab` on hoverable items, `cursor: grabbing` while dragging).

4. Real-Time Instrumentation & Readouts HUD:
   - Digital telemetry cards at the bottom displaying calculated physical quantities with exact standard units (e.g. N, m/s, m/s², J, V, A, Hz, Pa, mol/L).
   - Real-time textbook formula card (e.g. F = -k·x, PV = nRT, E = mc², v = f·λ).
   - Range sliders with live numeric badges, preset buttons to jump to key curriculum scenarios, Play/Pause toggle, and Reset.

5. Self-Contained & Secure:
   - Absolutely NO external scripts, NO CDN links, NO external images. Pure vanilla ES6+ and HTML5 Canvas API only.

6. Output Format:
   - Return ONLY the raw valid HTML document starting with <!DOCTYPE html> and ending with </html>.
   - Do NOT wrap in markdown fences (no ```html ... ```), no introductory or concluding text."""


async def generate_custom_simulation_html(question: str, context: str = "") -> dict[str, Any] | None:
    """Generate a custom interactive HTML5 Canvas simulation grounded in official textbooks."""
    from app.main import _llm_text

    # Search indexed textbooks (NCERT, ICSE, State Boards) for official curriculum grounding
    grounding = find_textbook_grounding_for_topic(question)
    tb_section = ""
    citations = []
    if grounding.get("found"):
        citations = grounding.get("citations", [])
        tb_section = (
            f"\n\nOFFICIAL CURRICULUM TEXTBOOK GROUNDING & APPARATUS (from {', '.join(citations)}):\n"
            f"{grounding['grounding_text']}\n"
            f"IMPORTANT: Faithfully model the official textbook apparatus, physical laws, and variables described above in your simulation."
        )

    prompt = (
        f"Scientific Topic to simulate: {question.strip()}\n"
        f"Pedagogical Context: {context.strip()[:600] if context else 'Standard STEM curriculum laboratory experiment'}"
        f"{tb_section}\n\n"
        f"INSTRUCTION: Create an authentic, photorealistic, 60 FPS interactive HTML5 canvas simulation of this topic. "
        f"Include realistic 3D-shaded apparatus, fluid/spring physics, active auto-playing animation on load, direct mouse/touch drag manipulation, live digital sensors, and textbook formulas."
    )
    raw_html = ""

    # Prioritize Gemini 2.5 Flash for high-fidelity photorealistic simulations, fallback to Llama-70B on Groq
    for mid in ("gemini-flash", "llama-70b", "qwen-27b"):
        try:
            logger.info(f"Generating photorealistic simulation with {mid} for topic: {question[:40]}...")
            raw_html = await asyncio.wait_for(
                _llm_text(CUSTOM_SIM_SYSTEM_PROMPT, prompt, mid),
                timeout=40.0,
            )
            if raw_html and len(raw_html.strip()) > 500:
                break
        except Exception as e:
            logger.warning(f"Simulation generation failed on {mid}: {e}")
            continue

    if not raw_html:
        return None

    # Clean any accidental markdown code blocks
    clean_html = re.sub(r"^```(?:html)?\s*", "", raw_html.strip(), flags=re.IGNORECASE)
    clean_html = re.sub(r"```\s*$", "", clean_html.strip())

    # Verify basic HTML integrity
    lower_html = clean_html.lower()
    if "<html" not in lower_html or ("<canvas" not in lower_html and "<svg" not in lower_html and "<script" not in lower_html):
        logger.warning("Generated HTML did not meet minimum canvas/svg requirements")
        return None

    desc = f"Interactive model for {question}. Adjust sliders to observe real-time behavior."
    if citations:
        desc = f"Curriculum-grounded simulation for {question}, aligned with {', '.join(citations[:2])}."

    return {
        "id": f"sim_custom_{abs(hash(question)) % 100000}",
        "type": "custom_html",
        "title": f"Lab: {question[:40]}",
        "subject": "Interactive Virtual Lab",
        "concept": question[:60],
        "description": desc,
        "htmlContent": clean_html,
        "html_content": clean_html,
        "textbook_sources": citations,
        "grounded": bool(grounding.get("found") or citations),
    }
