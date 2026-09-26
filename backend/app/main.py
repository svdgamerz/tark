"""Tark backend — FastAPI app (Phase 0).

Endpoints:
  GET  /health   liveness + whether the DB is wired
  POST /chat     run a teaching mode through the router and STREAM the reply (SSE)
  POST /verify   SymPy correctness seam (§7) — callable now, not yet enforcing

Importing this module calls get_settings(), which fails fast if a provider key is
missing (CLAUDE.md §1/§6) — uvicorn will refuse to start with a clear message.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import urllib.parse
from collections.abc import AsyncIterator

logger = logging.getLogger("tark.main")

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from app.auth.router import create_auth_router
from app.chats.router import create_chats_router
from app.chats.store import ConversationStore
from app.tasks.router import create_task_router
from app.tasks.store import TaskStore
from app.social.router import create_social_router
from app.social.store import SocialStore
from app.social.connection_manager import SocialConnectionManager
from app.auth.security import decode_token
from app.cas.router import router as cas_router
from app.grader.router import router as grader_router
from app.lens.router import router as lens_router
from app.auth.store import UserStore
from app.agents.planner import INTENT_HINT, Plan, make_plan
from app.config.models import (
    DEFAULT_MODEL_ID,
    GEMINI_FLASH,
    Provider,
    allowed_models,
    attempts_for,
    get_model,
)
from app.config.settings import get_settings
from app.correctness import engine as correctness
from app.correctness.checker import check_arithmetic
from app.diagrams.render import (
    ROUTER_SYSTEM_PROMPT,
    fetch_educational_image,
    looks_like_mermaid,
    render_figure,
    sanitize_svg,
    schematic_prompt,
    svg_to_data_url,
    wants_diagram,
)
from app.improve.store import ImprovementStore
from app.learner.store import LearnerStore
from app.tts.gemini import synthesize as tts_synthesize
from app.oral_eval import evaluate_oral
from app.correctness.compute import EXTRACT_SYSTEM_PROMPT, compute_block
from app.db.supabase_client import SessionStore
from app.modes import get_mode_prompt
from app.rag.retrieve import (
    CONFIDENT_SCORE,
    grounding_prompt,
    hits_are_generated,
    list_curriculum,
    normalize_board,
    normalize_grade,
    normalize_subject,
    retrieve,
    retrieve_chapter_grounding,
    retrieve_multi,
)
from app.schools.store import SchoolStore
from app.search.tavily import TavilySearchClient, format_web_context
from app.router.base import Message
from app.router.router import ModelRouter
from app.router.prompt_engineer import PromptOptimizer
from app.simulations import (
    detect_simulation_candidate,
    generate_custom_simulation_html,
    get_catalog,
    get_catalog_item,
    save_custom_catalog_item,
)

settings = get_settings()  # validates keys at import → fail-fast (§1/§6)
router = ModelRouter(settings)
sessions = SessionStore(settings)
tavily_search = TavilySearchClient(settings.tavily_api_keys)
prompt_optimizer = PromptOptimizer(settings)

app = FastAPI(title="Tark", version="0.0.1-phase0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Backend-managed auth (username/email/password + 6-digit email code via Brevo).
# NOTE: app.include_router() is broken under this FastAPI 0.138 / Starlette 1.3.1
# combo (it collapses a router's routes into a single null route), so attach the
# already-prefixed routes directly — which works correctly.
user_store = UserStore()
app.router.routes.extend(create_auth_router(settings, user_store).routes)

chat_store = ConversationStore()
app.router.routes.extend(create_chats_router(settings, chat_store).routes)

task_store = TaskStore()
app.router.routes.extend(create_task_router(settings, task_store, prompt_optimizer).routes)

social_store = SocialStore()
social_ws_manager = SocialConnectionManager()
app.router.routes.extend(create_social_router(settings, social_store, user_store, social_ws_manager).routes)
app.router.routes.extend(cas_router.routes)
app.router.routes.extend(grader_router.routes)
app.router.routes.extend(lens_router.routes)

improve_store = ImprovementStore()
learner_store = LearnerStore()

# School → board lookup for the onboarding autocomplete.
school_store = SchoolStore()


# --- Request/response schemas (Pydantic, per CLAUDE.md §10) ---
class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = ""  # may be empty when an image is attached


class ChatRequest(BaseModel):
    mode: str = Field(default="teacher")
    messages: list[ChatTurn] = Field(min_length=1)
    model: str | None = None  # which model the user picked (defaults to Acharya)
    # Optional curriculum context (RAG). Used only by grounded models (Acharya).
    board: str | None = None
    grade: str | None = None
    subject: str | None = None
    image: str | None = None  # data URL of an attached image (multimodal / vision)
    exam: str | None = None
    tutoring_style: str | None = None
    language: str | None = None
    weak_subjects: list[str] | None = None
    goal: str | None = None
    task_id: int | None = None
    milestone_id: str | None = None
    milestone_title: str | None = None
    milestone_notes: str | None = None
    milestone_index: int | None = None
    milestone_total: int | None = None
    chapter_confirmation: str | None = None
    textbook_source: str | None = None
    page_number: int | None = None
    chapter: str | None = None
    is_exam_workout: bool | None = None


def _is_admin(authorization: str | None) -> bool:
    if not authorization or not isinstance(authorization, str) or not authorization.lower().startswith("bearer "):
        return False
    payload = decode_token(authorization.split(" ", 1)[1], settings.token_secret)
    if not payload:
        return False
    return str(payload.get("email", "")).lower() in settings.admin_email_set


def _email_opt(authorization: str | None) -> str:
    """The caller's email from the token, or 'anon' — used to scope learning."""
    if authorization and isinstance(authorization, str) and authorization.lower().startswith("bearer "):
        payload = decode_token(authorization.split(" ", 1)[1], settings.token_secret)
        if payload and payload.get("email"):
            return str(payload["email"]).lower()
    return "anon"


def _scope(board: str | None, grade: str | None, subject: str | None) -> str:
    return f"{board or ''}|{grade or ''}|{subject or ''}".lower()


def _parse_data_url(data_url: str) -> tuple[str | None, str]:
    """Split a 'data:image/png;base64,XXXX' URL into (base64, mime)."""
    if not data_url or "," not in data_url:
        return None, "image/jpeg"
    header, b64 = data_url.split(",", 1)
    mime = "image/jpeg"
    if header.startswith("data:") and ";" in header:
        mime = header[5:].split(";", 1)[0] or mime
    return b64, mime


async def _consolidate_directives(existing: list[str], new: str) -> list[str]:
    """Smart Improver: merge a fresh directive into the existing ones — combining
    duplicates, generalizing specifics, dropping contradictions — so the learned
    memory stays compact and compounds instead of piling up."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        return [*existing, new][:4]
    system = (
        "You maintain a tutor's short list of teaching improvements for ONE student "
        "on ONE topic. Merge the notes below into AT MOST 4 concise, GENERAL "
        "directives: combine duplicates and similar ones, generalize specifics into "
        "reusable guidance, and drop any older note that a newer one contradicts. "
        "One directive per line, imperative voice, no numbering, no preamble."
    )
    user = (
        "Existing notes:\n" + "\n".join(f"- {d}" for d in existing)
        + f"\n\nNew note:\n- {new}"
    )
    raw = ""
    try:
        async for kind, payload in router.stream(
            attempts=attempts, system_prompt=system,
            messages=[Message(role="user", content=user)],
        ):
            if kind == "token":
                raw += payload
    except Exception:
        return [*existing, new][:4]
    lines = [ln.strip(" -•\t0123456789.") for ln in raw.splitlines() if ln.strip()]
    lines = [ln for ln in lines if ln]
    return lines[:4] or [*existing, new][:4]


async def _self_critique(question: str, answer: str) -> str:
    """RSI step: the tutor critiques its own failed answer and writes itself a
    concrete directive for doing better next time (a different model, for an
    independent perspective)."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        attempts = attempts_for(get_model(DEFAULT_MODEL_ID))
    system = (
        "You improve an AI tutor. A student marked the tutor's answer as unhelpful. "
        "In ONE or TWO sentences, write a concrete directive telling the tutor how to "
        "answer THIS kind of question better next time — target the real weakness "
        "(clarity, level, missing steps, wrong emphasis, or a factual slip). Start with "
        "an imperative verb. Output ONLY the directive, no preamble or quotes."
    )
    user = f"Question:\n{question}\n\nUnhelpful answer:\n{answer}"
    raw = ""
    async for kind, payload in router.stream(
        attempts=attempts, system_prompt=system,
        messages=[Message(role="user", content=user)],
    ):
        if kind == "token":
            raw += payload
    return raw.strip().strip('"')[:400]


async def _verify_against_source(question: str, answer: str, excerpts: str) -> str:
    """Smart Checker: compare the tutor's answer to the textbook it was grounded
    on, and flag anything that CONTRADICTS the book (catches the model drifting
    from the source). Runs on Groq — a different provider than the Teacher."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        return ""
    system = (
        "You compare a tutor's answer against the textbook excerpt it must be based "
        "on. If the answer states something that CONTRADICTS or is clearly refuted by "
        "the excerpt, reply with ONE short line starting 'CONTRADICTION:' and the fix. "
        "If the answer is consistent with the excerpt (elaborating beyond it is fine), "
        "reply exactly 'OK'. Do not nitpick wording or completeness."
    )
    user = (
        f"TEXTBOOK EXCERPT:\n{excerpts[:3000]}\n\n"
        f"STUDENT QUESTION:\n{question}\n\nTUTOR ANSWER:\n{answer}"
    )
    raw = ""
    async for kind, payload in router.stream(
        attempts=attempts, system_prompt=system,
        messages=[Message(role="user", content=user)],
    ):
        if kind == "token":
            raw += payload
    raw = raw.strip()
    if raw[:12].upper().startswith("CONTRADICT"):
        fix = raw.split(":", 1)[1].strip() if ":" in raw else raw
        return f"\n\n**Textbook verification:** {fix}"
    return ""


async def _cross_check(question: str, answer: str) -> str:
    """Independent second-model fact-check (CLAUDE.md §7.4). Uses a DIFFERENT model
    family than the tutor (Llama), so the two rarely share the same blind spot.
    Returns a correction note if it finds a definite error, else ""."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        return ""
    system = (
        "You are an independent fact-checker, NOT the original tutor. Check the "
        "tutor's answer ONLY for clear factual or conceptual errors. If you find a "
        "definite error, reply with ONE short line starting 'CORRECTION:' and the "
        "fix. If the answer is accurate, reply exactly 'OK'. Ignore style and depth."
    )
    user = f"Student question:\n{question}\n\nTutor's answer:\n{answer}"
    raw = ""
    async for kind, payload in router.stream(
        attempts=attempts, system_prompt=system,
        messages=[Message(role="user", content=user)],
    ):
        if kind == "token":
            raw += payload
    raw = raw.strip()
    if raw[:10].upper().startswith("CORRECTION"):
        fix = raw.split(":", 1)[1].strip() if ":" in raw else raw
        return f"\n\n**Independent verification:** {fix}"
    return ""


async def _verified_computations(message: str) -> str:
    """Tool-use SymPy pass 1: ask the model for the calculations, then run them
    through SymPy and return a verified-results block to inject into the prompt.
    Uses a different provider (Groq) than the main answer, so maths questions
    don't burn the Gemini free-tier quota twice per turn."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        attempts = attempts_for(get_model(DEFAULT_MODEL_ID))
    raw = ""
    async for kind, payload in router.stream(
        attempts=attempts,
        system_prompt=EXTRACT_SYSTEM_PROMPT,
        messages=[Message(role="user", content=message)],
    ):
        if kind == "token":
            raw += payload
    return compute_block(raw)


async def _llm_text(system: str, user: str, model_id: str) -> str:
    """One accumulated completion on the given registry model (with failover)."""
    try:
        attempts = attempts_for(get_model(model_id))
    except KeyError:
        return ""
    raw = ""
    async for kind, payload in router.stream(
        attempts=attempts, system_prompt=system,
        messages=[Message(role="user", content=user)],
    ):
        if kind == "token":
            raw += payload
    return raw


async def _make_figure(question: str) -> dict | None:
    """Diagram agent (§11) — routed by figure type:
      plot      → constrained JSON spec → SymPy + Matplotlib (PNG)
      flow      → Mermaid source, rendered by the client (strict mode, no HTML)
      image     → authentic textbook diagram (Tavily/OpenStax/Britannica/Wikimedia) or AI scientific illustration (Flux)
      schematic → educational image engine fallback
    Any failure → no figure."""
    spec = {}
    m = None
    try:
        # First attempt with llama-70b (ultra-fast Groq hardware, preserves Gemini quota); fallback to gemini-flash
        raw = ""
        for mid in ("llama-70b", "gemini-flash"):
            try:
                raw = await asyncio.wait_for(
                    _llm_text(ROUTER_SYSTEM_PROMPT, question, mid),
                    timeout=5.0,
                )
                if raw and "{" in raw:
                    break
            except Exception:
                continue

        m = re.search(r"\{.*\}", raw or "", re.DOTALL)
        if m:
            spec = json.loads(m.group(0))
    except Exception as e:
        logger.warning(f"Diagram routing non-fatal warning: {e}")

    kind = str(spec.get("kind", "")).lower()

    if kind == "plot" and m:
        url = await run_in_threadpool(render_figure, m.group(0))
        return {"event": "figure", "data_url": url} if url else None

    if kind == "flow":
        code = str(spec.get("mermaid", ""))
        if looks_like_mermaid(code):
            return {"event": "figure_mermaid", "code": code}
        return None

    if kind in ("image", "schematic"):
        subject = str(spec.get("subject", "")).strip()[:120]
        labels = [str(l).strip() for l in spec.get("labels", []) if str(l).strip()]
        view = str(spec.get("view", "")).strip()[:150]
        search_query = str(spec.get("search_query", "")).strip()[:150]
        url = await run_in_threadpool(
            fetch_educational_image,
            subject,
            question,
            labels,
            view,
            search_query,
        )
        if url:
            return {"event": "figure", "data_url": url}

    # Direct fallback: if the student asked for an image/diagram/figure, attempt educational image fetch directly
    url = await run_in_threadpool(fetch_educational_image, "", question)
    if url:
        return {"event": "figure", "data_url": url}

    return None



FOLLOWUP_SYSTEM_PROMPT = (
    "You are an expert pedagogical assistant. Given a student's question and the tutor's answer, "
    "generate exactly 3 or 4 smart, contextual follow-up exploration options that a student would want to ask next.\n"
    "Tailor them specifically to the exact topic, concept, difficulty level, and formulas in the discussion.\n"
    "Types of follow-ups to consider:\n"
    "1. Deeper conceptual variation or edge case (e.g., 'Incorporate Friction', 'Evaluate Complex Roots')\n"
    "2. Targeted practice problem or concept check on this exact skill (e.g., 'Practice Problem')\n"
    "3. Step-by-step breakdown, formula derivation, or geometric visualization (e.g., 'Derive Formula', 'Show Diagram')\n"
    "4. Intuitive real-world analogy or simpler explanation (e.g., 'Simpler Example', 'Physical Intuition')\n\n"
    "Output ONLY a valid JSON array of objects with keys 'label' and 'prompt'. Do NOT include any emojis or decorative symbols.\n"
    "- 'label': Concise 2-4 word title (e.g., 'Practice Problem', 'Derive Formula', 'Simpler Example')\n"
    "- 'prompt': Natural student question to submit\n"
    "JSON array only, no preamble or extra text."
)


async def _generate_followup_suggestions(
    question: str, answer: str, subject: str | None = None
) -> list[dict]:
    """Generate 3-4 dynamic, contextual follow-up chips based on the turn's Q&A."""
    if not question.strip() or not answer.strip():
        return []
    try:
        attempts = attempts_for(get_model("gemini-flash"))
    except KeyError:
        attempts = attempts_for(get_model(DEFAULT_MODEL_ID))

    user_text = f"Student Question:\n{question[:1000]}\n\nTutor Answer:\n{answer[:2000]}"
    raw = ""
    try:
        async for kind, payload in router.stream(
            attempts=attempts,
            system_prompt=FOLLOWUP_SYSTEM_PROMPT,
            messages=[Message(role="user", content=user_text)],
        ):
            if kind == "token":
                raw += payload
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            if isinstance(data, list):
                valid = []
                for item in data[:4]:
                    if isinstance(item, dict) and "label" in item and "prompt" in item:
                        label_clean = re.sub(r"[^\w\s\-\+\/\(\)\:\,\.]", "", str(item["label"])).strip()
                        valid.append({
                            "label": label_clean[:30] or "Follow-up",
                            "prompt": str(item["prompt"]).strip()[:300],
                        })
                return valid
    except Exception as e:
        logger.warning(f"Follow-up suggestions generation non-fatal error: {e}")

    return []


async def _expand_query(message: str) -> list[str]:
    """Smart Retriever: rewrite a student's casual question into 2 textbook-worded
    search queries (technical terms a book would use). Only called when the raw
    question failed to ground — so it costs nothing on clear questions."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        return []
    system = (
        "You improve textbook search. Rewrite the student's question as 2 short "
        "search queries using the TECHNICAL TERMS a textbook chapter would use "
        "(not the student's casual words). One query per line, no numbering, "
        "no explanations, max 8 words each."
    )
    raw = ""
    try:
        async for kind, payload in router.stream(
            attempts=attempts, system_prompt=system,
            messages=[Message(role="user", content=message)],
        ):
            if kind == "token":
                raw += payload
    except Exception:
        return []
    lines = [ln.strip(" -•\t0123456789.") for ln in raw.splitlines() if ln.strip()]
    return [ln for ln in lines if ln][:3]


async def _refine_plan(plan: Plan, message: str) -> Plan:
    """Planner escalation: for an ambiguous message, a fast model decides whether
    it's small talk or a real question. Only called when rules can't tell."""
    try:
        attempts = attempts_for(get_model("llama-70b"))
    except KeyError:
        return plan
    system = (
        "Classify the student's message with ONE word: GREETING if it is a "
        "greeting, thanks, or small talk; LESSON if it is a study question, topic, "
        "or a follow-up to a lesson. Reply with only that word."
    )
    raw = ""
    try:
        async for kind, payload in router.stream(
            attempts=attempts, system_prompt=system,
            messages=[Message(role="user", content=message)],
        ):
            if kind == "token":
                raw += payload
    except Exception:
        return plan
    if "GREET" in raw.upper():
        return Plan("chat", needs_grounding=False, needs_computation=False,
                    difficulty="easy")
    return Plan("lesson", needs_grounding=True,
                needs_computation=plan.needs_computation, difficulty=plan.difficulty)


class VerifyRequest(BaseModel):
    expression: str
    claimed: str | None = None


# --- Routes ---
@app.get("/")
@app.head("/")
@app.get("/ping")
@app.head("/ping")
async def root_ping() -> Response:
    """Ultra-lightweight 0-byte ping endpoint for cron-job.org and uptime monitors."""
    return Response(status_code=204, headers={"Content-Length": "0"})


@app.get("/health")
@app.head("/health")
async def health() -> dict:
    return {"status": "ok", "db": sessions.enabled}


@app.get("/curriculum")
async def curriculum() -> dict:
    """Syllabi (board/grade/subject) currently indexed — for the UI picker."""
    return {"items": list_curriculum()}


@app.get("/schools")
async def schools(q: str = "") -> dict:
    """Type-ahead school search → board (for onboarding autocomplete)."""
    return {"items": await run_in_threadpool(school_store.search, q)}


@app.get("/models")
async def list_models(authorization: str | None = Header(default=None)) -> dict:
    """Models the caller may use (admins also see admin-tier models)."""
    is_admin = _is_admin(authorization)
    return {
        "default": DEFAULT_MODEL_ID,
        "models": [
            {"id": m.id, "label": m.label, "grounded": m.grounded,
             "tier": m.tier, "description": m.description}
            for m in allowed_models(is_admin)
        ],
    }


@app.post("/chat")
async def chat(
    req: ChatRequest, authorization: str | None = Header(default=None)
) -> StreamingResponse:
    try:
        system_prompt = get_mode_prompt(req.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Inject student personalization & learning profile
    profile_instructions: list[str] = []
    if req.exam:
        profile_instructions.append(
            f"• Target Exam / Milestone: {req.exam}. Tailor problem complexity, high-yield shortcuts, standard question patterns, and depth to this exam."
        )
    if req.goal:
        goal_map = {
            "concept": "Deep conceptual mastery and theoretical foundations",
            "exam": "High-yield scoring, exam patterns, and mark maximization",
            "homework": "Homework guidance and quick step-by-step doubt clearing",
            "olympiad": "Challenging multi-concept problems and advanced olympiad thinking",
        }
        profile_instructions.append(f"• Primary Learning Focus: {goal_map.get(req.goal, req.goal)}")
    if req.tutoring_style:
        style_map = {
            "step_by_step": "Step-by-Step Teacher — Break down every step and calculation clearly with derivations, formulas, and structured numbered steps.",
            "socratic_step_by_step": (
                "Step-by-Step Socratic Coach — NEVER reveal or dump the full solution, calculation, or final answer at once. "
                "For any problem, guide the student one micro-step at a time: "
                "First, ask what values are given and what needs to be solved. "
                "Then, ask which governing formula applies (providing a gentle hint). "
                "Prompt the student to attempt step 1 before proceeding to step 2. Be patient, encouraging, and celebrate small breakthroughs."
            ),
            "teach_acharya": (
                "Teach Acharya (Feynman Technique) — ROLE REVERSAL MODE: The student is the teacher and Acharya is the curious learner! "
                "When the student brings a topic or concept, enthusiastically ask them: "
                "'Teach it to me as if I am in 5th grade! In your own words, how does it work?' "
                "When the student explains, listen attentively: "
                "1. Praise what they explained accurately and clearly. "
                "2. Spot any missing prerequisites, subtle misconceptions, or skipped steps. "
                "3. Ask 1-2 sharp follow-up questions to help them uncover the missing link themselves. "
                "4. Provide an encouraging 'Feynman Mastery Score' (e.g., 8.5/10) with specific tips to make their mental model rock-solid."
            ),
            "socratic": "Socratic Coach — Ask guiding questions, give strategic hints, and prompt the student to deduce the answer before revealing it directly.",
            "quick_direct": "Quick & Direct — Provide crisp, high-yield, exam-oriented bullet points, formula cards, and direct answers without unnecessary filler.",
            "analogies_eli5": "Everyday Analogies & ELI5 — Use relatable real-world stories, visual mental models, and intuitive physical examples.",
        }
        profile_instructions.append(f"• Tutoring Style: {style_map.get(req.tutoring_style, req.tutoring_style)}")
    if req.language and req.language.lower() != "english":
        lang_map = {
            "hinglish": "Hinglish — Explain concepts naturally using a friendly mix of Hindi and English (conversational Indian student style, e.g. 'Pehle hum identify karenge given values ko, then we apply formula...'), while retaining standard English scientific and mathematical terms.",
            "hindi": "Hindi (हिन्दी) — Explain concepts in clear, easy-to-understand Hindi, writing standard English technical terms and formulas in brackets where helpful.",
            "marathi": "Marathi (मराठी) — Explain concepts in clear, easy-to-understand Marathi, writing standard technical terms and formulas in brackets where helpful.",
        }
        profile_instructions.append(f"• Language Medium: {lang_map.get(req.language.lower(), req.language)}")
    if req.weak_subjects:
        profile_instructions.append(
            f"• Student's Weak Areas / Extra Help Needed In: {', '.join(req.weak_subjects)}. Pay extra attention when explaining these topics, break them down from fundamental principles, and provide proactive checks for understanding."
        )

    if profile_instructions:
        system_prompt += (
            "\n\nSTUDENT PERSONALIZATION & PROFILE DIRECTIVES:\n"
            + "\n".join(profile_instructions)
            + "\nAlways calibrate your explanation depth, tone, terminology, exam tips, and language medium according to this profile."
        )

    # Active Study Schedule & Milestone calibration:
    if req.milestone_title:
        m_idx = req.milestone_index or 1
        m_tot = req.milestone_total or 1
        schedule_instructions = [
            f"ACTIVE STUDY SCHEDULE DIRECTIVE (Milestone {m_idx} of {m_tot}):",
            f"• Milestone Topic: {req.milestone_title}",
        ]
        if req.milestone_notes:
            schedule_instructions.append(f"• Milestone Target Syllabus: {req.milestone_notes}")
        if req.chapter_confirmation:
            schedule_instructions.append(f"• Confirmed Syllabus Context: {req.chapter_confirmation}")
        schedule_instructions.append(
            "• CLASSROOM TEACHER DAY-1 PEDAGOGY (CRITICAL - STRICTLY ENFORCED):\n"
            "  1. CHAPTER OPENING (Day 1 in class):\n"
            "     - Welcome the student warmly to this milestone/chapter.\n"
            "     - Open like an authentic, inspiring teacher: share an intuitive real-world hook or mystery ('Why do we study this? Where do we see this in everyday life?').\n"
            "     - Teach ONLY the first fundamental building block or concept (Concept 1). Keep it concise, intuitive, and grounded in textbook definitions.\n"
            "     - Provide ONE simple, vivid worked mini-example illustrating this first concept.\n"
            "     - End your response with ONE friendly, low-stakes check question to see if they understand before moving forward.\n"
            "     - ABSOLUTE RULE: NEVER dump or summarize the whole chapter in one response! Do NOT explain subsequent formulas, sub-topics, or advanced problems yet. Stop and wait for the student's answer!\n"
            "  2. MICRO-LESSON PROGRESSION (Follow-up turns):\n"
            "     - Validate their response warmly. If correct, praise and smoothly introduce the NEXT sub-concept.\n"
            "     - If confused or incorrect, give an everyday analogy or intuitive hint without scolding.\n"
            "     - Proceed one concept at a time with a check question per turn until the milestone is completed."
        )
        system_prompt += "\n\n" + "\n".join(schedule_instructions)

    # Page-by-page textbook mastery grounding & photo embedding:
    eff_source = req.textbook_source
    eff_page = req.page_number
    if not eff_page and req.milestone_title:
        m_page = re.search(r"\bpage\s*(\d+)\b", req.milestone_title, re.IGNORECASE)
        if m_page:
            eff_page = int(m_page.group(1))

    if eff_page and not eff_source and (req.board or req.exam):
        from app.textbook_service import get_chapters_for_subject
        b_name = req.board or req.exam or ""
        chs = get_chapters_for_subject(b_name, req.grade or "10", req.subject or "Physics")
        if chs:
            eff_source = chs[0].get("source")

    is_page_request = bool(eff_page or (req.milestone_title and re.search(r"\bpage\s*\d+\b", req.milestone_title, re.I)))
    p_num = eff_page or 1
    b_str = req.board or ""
    g_str = req.grade or ""
    s_str = req.subject or ""
    c_str = req.chapter or req.milestone_title or ""

    page_text = ""
    if eff_source:
        from app.textbook_service import get_pdf_page_text
        page_text = get_pdf_page_text(eff_source, p_num, chapter=c_str)

    if is_page_request:
        if eff_source and page_text:
            # Case A: Scanned PDF in local database
            page_img_tag = f"![Textbook Page {p_num}](/api/textbook/page-image?source={urllib.parse.quote(eff_source)}&page={p_num}&chapter={urllib.parse.quote(c_str)})"
            grounding_text = f"• Source Textbook: {eff_source}\n• Active Page: Page {p_num}\n• EXACT SCANNED TEXT OF PAGE {p_num}:\n\"\"\"\n{page_text}\n\"\"\""
        else:
            # Case B: Synthesized authentic curriculum study card (Sanskrit, Marathi, custom curriculum)
            b_q = urllib.parse.quote(b_str)
            g_q = urllib.parse.quote(g_str)
            s_q = urllib.parse.quote(s_str)
            c_q = urllib.parse.quote(c_str)
            page_img_tag = f"![Textbook Page {p_num}](/api/textbook/page-image?board={b_q}&grade={g_q}&subject={s_q}&chapter={c_q}&page={p_num})"
            grounding_text = f"• Curriculum Context: {b_str} Class {g_str} • Subject: {s_str} • Chapter: {c_str} • Page {p_num}\n• High-Definition Curriculum Study Card Generated: `{page_img_tag}`"

        system_prompt += (
            f"\n\nTEXTBOOK PAGE-BY-PAGE GUIDED MASTERING DIRECTIVE:\n"
            f"{grounding_text}\n"
            f"• Mandatory Page Image Tag: `{page_img_tag}`\n\n"
            "CRITICAL DAY-1 PEDAGOGY & PAGE TEACHING DIRECTIVES:\n"
            "1. INITIATING THE LESSON / PAGE:\n"
            f"   - Your response MUST START immediately with the textbook page image Markdown tag on its own line:\n"
            f"     {page_img_tag}\n"
            f"   - Warmly greet the student and EXPLICITLY state the complete context: Board ({b_str or 'Curriculum'}), Grade (Class {g_str or '10'}), Subject ({s_str or 'Subject'}), Chapter ({c_str or 'Chapter 1'}), and Page {p_num}.\n"
            "2. REAL-WORLD HOOK:\n"
            "   - Share a fascinating, intuitive real-world hook or cultural context introducing this page/chapter.\n"
            "3. STEP-BY-STEP CONCEPT 1 BREAKDOWN:\n"
            "   - Teach ONLY Concept 1 (or the first shloka/section/definition) from this page first. If language/Sanskrit, provide word-by-word sandhi/meaning, translation, and grammatical essence; if science/math, provide step-by-step logic and clear formulas.\n"
            "   - Give a clear worked mini-example.\n"
            "4. PHYSICAL TEXTBOOK UPLOAD INVITATION:\n"
            "   - Mention warmly: 'If you want to study line-by-line from your exact physical school book edition, you can snap and upload a photo anytime using the attachment button below!'\n"
            "5. INTERACTIVE CHECKPOINT:\n"
            "   - End with ONE friendly check question based on Concept 1 to verify understanding before advancing to the next concept or page."
        )

    spec = get_model(req.model)
    if spec.tier == "admin" and not _is_admin(authorization):
        raise HTTPException(status_code=403, detail="This model is for admins only.")

    messages = [Message(role=t.role, content=t.content) for t in req.messages]
    last_user = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    # Multimodal: attach an uploaded image to the latest user turn (Gemini vision).
    vision = False
    if req.image:
        b64, mime = _parse_data_url(req.image)
        if b64:
            vision = True
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == "user":
                    txt = messages[i].content or (
                        "Please read this image and help me understand and solve it."
                    )
                    messages[i] = Message(
                        role="user", content=txt, image_data=b64, image_mime=mime
                    )
                    break

    # Planner agent: decide who on the team needs to work (rules; a fast LLM only
    # for genuinely ambiguous messages).
    plan = make_plan(last_user, req.subject)
    if plan.ambiguous and not vision:
        plan = await _refine_plan(plan, last_user)
    if vision:
        # A photo is always a lesson; the text agents don't apply to pixels.
        plan = Plan("lesson", needs_grounding=False, needs_computation=False,
                    difficulty="easy", intent="doubt")
        system_prompt += (
            "\n\nThe student has attached a PHOTO (likely a homework problem, "
            "diagram, or textbook page). Read it carefully, state what is being asked, "
            "then teach them how to work through it step by step — guide, don't just "
            "give the final answer."
        )

    if plan.intent == "chapter_start" and not req.milestone_title:
        system_prompt += (
            "\n\nCLASSROOM TEACHER PROTOCOL (CHAPTER START - STRICT PEDAGOGY):\n"
            "The student is asking to learn or start a chapter. Behave like an authentic classroom teacher on Day 1:\n"
            "1. Welcome the student warmly and introduce the chapter with an engaging real-world curiosity hook ('Why do we study this?').\n"
            "2. Teach ONLY the first fundamental building block (Concept 1) with an intuitive definition.\n"
            "3. Provide ONE clear, vivid mini-example.\n"
            "4. Ask ONE interactive check question to confirm understanding before moving forward.\n"
            "5. ABSOLUTE RULE: NEVER dump or summarize the whole chapter in one monologue! Cover only Concept 1 and stop to wait for their answer."
        )
    if req.is_exam_workout or "Daily 3-Question Memory Workout" in last_user or ("Spaced Repetition" in last_user and "Question 1" in last_user):
        system_prompt += (
            "\n\nDAILY EXAM MEMORY WORKOUT (SPACED REPETITION QUIZMASTER DIRECTIVE):\n"
            "The student is running their daily rapid-recall workout to cement their exam syllabus into long-term memory.\n"
            "1. Present exactly ONE high-yield exam question at a time (e.g., '🎯 Question 1 of 3: ...').\n"
            "2. Questions must be high-yield: core formulas, fundamental laws/theorems, essential definitions, or common board exam traps.\n"
            "3. If this is the start of the workout, warmly greet them, identify the syllabus topic, and pose Question 1.\n"
            "4. When the student answers: evaluate their answer accurately with marks breakdown, praise what's right, highlight any missing keywords required by official marking schemes, and immediately ask Question 2 (and then Question 3).\n"
            "5. After Question 3, award their final Workout Score (e.g. 3/3), summarize key memory takeaways, and share a quick boost of exam confidence!\n"
            "Keep the session snappy, energetic, and highly motivating!"
        )

    # Dedicated Autonomous Prompt Engineering Layer (Isolated Key):
    # Only optimize individual doubts/questions; do NOT mutate active study schedules or Day-1 chapter starts!
    engineered_query = last_user
    was_engineered = False
    if last_user and not req.image and not req.milestone_title and plan.intent not in ("chapter_start", "chat"):
        student_ctx = {
            "exam": req.exam,
            "grade": req.grade,
            "board": req.board,
            "subject": req.subject,
            "tutoring_style": req.tutoring_style,
            "language": req.language,
            "weak_subjects": req.weak_subjects,
            "goal": req.goal,
        }
        try:
            engineered_query, was_engineered = await prompt_optimizer.optimize(last_user, student_ctx)
            if was_engineered:
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].role == "user":
                        messages[i] = Message(
                            role="user",
                            content=engineered_query,
                            image_data=messages[i].image_data,
                            image_mime=messages[i].image_mime,
                        )
                        break
        except Exception as e:
            logger.warning(f"Prompt optimization non-fatal exception: {e}")

    # Diagram agent (§11): spec + render a figure in PARALLEL with the answer, so
    # graph questions gain a figure without slowing the first token.
    figure_task: asyncio.Task | None = None
    if plan.kind != "chat" and not vision and wants_diagram(last_user):
        figure_task = asyncio.create_task(_make_figure(last_user))
        system_prompt += (
            "\n\nA properly rendered diagram is being generated separately and will "
            "be attached below your answer. Therefore you MUST NOT output any diagram "
            "code yourself: no ``` code fences, no mermaid, no `graph`/`flowchart` "
            "syntax, no SVG, no ASCII art. Just explain in clear prose and refer to "
            "'the diagram below' naturally."
        )

    source_items: list[str] = []  # citations, sent as a structured event
    source_excerpts = ""  # the textbook text, for the Checker to verify against
    grounded_generated = False  # grounded on AI-generated (low-trust) content?
    hits = None  # top retrieval hits (also used for the learner model's topic)
    if not vision and plan.kind != "chat" and spec.grounded and (req.board or req.grade or req.exam):
        eff_board = normalize_board(req.board)
        eff_grade = normalize_grade(req.grade)
        eff_subject = normalize_subject(req.subject)

        if req.exam:
            candidate_board = normalize_board(req.exam)
            if candidate_board and (not eff_board or eff_board not in ("CBSE (NCERT)", "ICSE (CISCE)", "Maharashtra State Board (Balbharati)", "IGCSE (Cambridge)")):
                eff_board = candidate_board
            if not eff_grade:
                match_grade = re.search(r"\b(?:class|grade)\s*(\d{1,2})\b", req.exam, re.IGNORECASE)
                if match_grade:
                    eff_grade = match_grade.group(1)

        ctx_bits = []
        if eff_grade:
            ctx_bits.append(f"Class {eff_grade}")
        if eff_board:
            ctx_bits.append(f"the {eff_board} board")
        if ctx_bits:
            system_prompt += (
                "\n\nLEARNER CONTEXT: The student is in "
                + " following ".join(ctx_bits)
                + ". Pitch the explanation at that level and follow that board's syllabus."
            )

        # Chapter-focused retrieval priority:
        # If studying an active milestone or starting a chapter, ground specifically in the chapter's introduction & core principles!
        if eff_board and (req.milestone_title or plan.intent == "chapter_start"):
            ch_query = req.milestone_title or last_user
            if req.milestone_notes:
                ch_query += " " + req.milestone_notes
            try:
                hits = await run_in_threadpool(
                    retrieve_chapter_grounding,
                    ch_query,
                    board=eff_board,
                    grade=eff_grade,
                    subject=eff_subject,
                )
            except Exception as e:
                logger.warning(f"Chapter RAG retrieval non-fatal failure: {e}")

        # Standard question retrieval fallback if chapter retrieval yielded nothing or not applicable
        if not hits and eff_board:
            try:
                hits = await run_in_threadpool(
                    retrieve, last_user,
                    board=eff_board, grade=eff_grade, subject=eff_subject,
                )
                if not hits or hits[0].score < CONFIDENT_SCORE:
                    expanded = await _expand_query(last_user)
                    if expanded:
                        better = await run_in_threadpool(
                            retrieve_multi, [last_user, *expanded],
                            board=eff_board, grade=eff_grade, subject=eff_subject,
                        )
                        if better and (not hits or better[0].score > hits[0].score):
                            hits = better
            except Exception as e:
                logger.warning(f"RAG retrieval non-fatal failure: {e}")

        if hits:
            grounded_generated = hits_are_generated(hits)
            if is_page_request:
                system_prompt += "\n\nSUPPLEMENTARY OFFICIAL SYLLABUS CONTEXT:\n" + "\n\n".join(f"[{h.citation}]:\n{h.text}" for h in hits)
            else:
                system_prompt += grounding_prompt(hits)
            source_excerpts = "\n\n".join(h.text for h in hits)
            for h in hits:
                if h.citation not in source_items:
                    source_items.append(h.citation)

        # Web Search Fallback (Tavily): If no local curriculum hits exist, search the web
        # (Budget-guarded to strictly preserve the monthly 1,000 requests limit).
        if not hits and settings.tavily_api_key:
            web_results = await run_in_threadpool(tavily_search.search, last_user)
            if web_results:
                web_prompt, web_cites = format_web_context(web_results)
                system_prompt += web_prompt
                for cite in web_cites:
                    if cite not in source_items:
                        source_items.append(cite)

    # Planner: adapt the Teacher's style to what the student actually wants
    # (a worked example, a simpler re-explanation, practice questions, …).
    if plan.kind != "chat":
        hint = INTENT_HINT.get(plan.intent, "")
        if hint:
            system_prompt += "\n\nTEACHING FOCUS: " + hint

    # Learner model (§3, "it adapts"): track this student's mastery of the topic
    # (the grounded chapter) and teach known-weak topics more carefully.
    learner_key = _email_opt(authorization)
    if plan.kind != "chat" and hits and learner_key != "anon":
        top = hits[0]
        subject = top.subject or req.subject or "General"
        chapter = top.chapter or ""
        ch_disp = f"Chapter {chapter}" if chapter.isdigit() else chapter
        topic_label = f"{subject} · {ch_disp}" if chapter else subject
        topic_key = f"{req.board}|{req.grade}|{subject}|{chapter}".lower()
        try:
            prior = await run_in_threadpool(learner_store.get, learner_key, topic_key)
            if prior and (prior["strength"] < 0.4 or prior["struggles"] >= 2):
                system_prompt += (
                    "\n\nLEARNER NOTE: This student has struggled with this topic before "
                    "— teach it extra carefully, use a concrete everyday example, keep it "
                    "simple, and check their understanding at the end."
                )
            struggled = plan.intent in ("simpler", "doubt")
            await run_in_threadpool(
                learner_store.record, learner_key, topic_key, topic_label,
                struggled=struggled,
            )
        except Exception as e:
            logger.warning(f"Learner store tracking non-fatal error: {e}")

    # Solver agent — tool-use SymPy (§7.1): compute the numbers with SymPy FIRST,
    # then let the Teacher explain using the verified values (best-effort).
    if plan.needs_computation:
        try:
            system_prompt += await asyncio.wait_for(_verified_computations(last_user), timeout=2.0)
        except Exception:
            pass  # never block the answer on the pre-pass

    # Improver agent: apply what this student's 👎 feedback has taught us (skip for
    # greetings — the Planner said no lesson work is needed).
    directives = []
    if plan.kind != "chat":
        try:
            directives = await run_in_threadpool(
                improve_store.for_context,
                _email_opt(authorization),
                _scope(req.board, req.grade, req.subject),
            )
        except Exception as e:
            logger.warning(f"Improvement store lookup non-fatal error: {e}")
    if directives:
        system_prompt += (
            "\n\nLEARNED FROM THIS STUDENT'S FEEDBACK (apply every one of these to "
            "improve your answer):\n" + "\n".join(f"- {d}" for d in directives)
        )

    # Phase 0: record the session (best-effort; runs off the event loop so the
    # synchronous Supabase call doesn't block streaming, and never fails the request).
    await run_in_threadpool(sessions.create_session, req.mode)

    attempts = attempts_for(spec)
    if vision:
        # Only Gemini reads images here — don't fail over to text-only models.
        attempts = [(Provider.GEMINI, GEMINI_FLASH)]
    elif plan.difficulty == "hard" and spec.id == DEFAULT_MODEL_ID:
        # Planner: hand HARD questions to a fast, powerful high-capacity reasoner first
        strong = (Provider.GROQ, "llama-3.3-70b-versatile")
        attempts = [strong, *(a for a in attempts if a != strong)]

    async def event_stream() -> AsyncIterator[bytes]:
        answer = ""
        try:
            if was_engineered:
                yield _sse({
                    "type": "prompt_engineered",
                    "original": last_user,
                    "engineered": engineered_query,
                })

            async for kind, payload in router.stream(
                attempts=attempts, system_prompt=system_prompt, messages=messages
            ):
                if kind == "token":
                    answer += payload
                    yield _sse({"type": "token", "text": payload})
                elif kind == "reset":
                    # Tell the client to clear the partial answer (mid-stream failover).
                    answer = ""
                    yield _sse({"type": "reset"})
            # SymPy arithmetic guard (§7.3): if the model's own calculation is
            # wrong, append a correction — SymPy is authoritative on the number.
            try:
                correction = await run_in_threadpool(check_arithmetic, answer)
                if correction:
                    yield _sse({"type": "token", "text": correction})
            except Exception as e:
                logger.warning(f"Arithmetic guard non-fatal error: {e}")

            # Cross-check (§7.4): answers grounded on AI-generated (low-trust) notes
            # get an independent second-model fact-check before the citation.
            if grounded_generated and answer.strip():
                try:
                    note = await _cross_check(last_user, answer)
                    if note:
                        yield _sse({"type": "token", "text": note})
                except Exception:
                    pass  # never block the answer on the checker
            # Checker (§7): for real-textbook answers, verify the answer doesn't
            # contradict the source passage (silent unless it finds a real drift).
            elif source_excerpts and len(answer) > 200:
                try:
                    note = await _verify_against_source(
                        last_user, answer, source_excerpts
                    )
                    if note:
                        yield _sse({"type": "token", "text": note})
                except Exception:
                    pass
            # Code-rendered figure (§11) — finished in parallel with the answer.
            if figure_task is not None:
                try:
                    fig = await asyncio.wait_for(figure_task, timeout=15)
                    if fig and fig.get("event") == "figure":
                        yield _sse({"type": "figure", "data_url": fig["data_url"]})
                    elif fig and fig.get("event") == "figure_mermaid":
                        yield _sse({"type": "figure_mermaid", "code": fig["code"]})
                except Exception:
                    pass  # no figure is always an acceptable outcome
            if source_items:  # structured citations for the "View sources" menu
                yield _sse({"type": "sources", "items": source_items[:4]})

            # Dynamic AI follow-up suggestions tailored to the specific question and answer
            if answer.strip():
                try:
                    suggestions = await asyncio.wait_for(
                        _generate_followup_suggestions(last_user, answer, req.subject),
                        timeout=5.0,
                    )
                    if suggestions:
                        yield _sse({"type": "suggestions", "items": suggestions})
                except Exception as e:
                    logger.warning(f"Error yielding suggestions: {e}")

            # Interactive Visual Simulation (Virtualization):
            # If the student's question matches a core curriculum simulation concept, stream it directly!
            try:
                sim_cand = detect_simulation_candidate(last_user)
                if sim_cand:
                    yield _sse({"type": "simulation", "sim": sim_cand})
            except Exception as e:
                logger.warning(f"Simulation candidate detection error: {e}")

            yield _sse({"type": "done"})
        except Exception as e:  # surface provider failure to the client cleanly
            if figure_task is not None:
                figure_task.cancel()
            logger.error(f"Stream error in event_stream: {e}", exc_info=True)
            if answer.strip():
                # Answer was already delivered to the student — do not inject an error banner!
                yield _sse({"type": "done"})
            else:
                yield _sse({"type": "error", "message": str(e)})


    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/learner")
async def learner(authorization: str | None = Header(default=None)) -> dict:
    """The student's mastery map — powers the Progress panel + revision list."""
    user_key = _email_opt(authorization)
    if user_key == "anon":
        return {"topics": []}
    topics = await run_in_threadpool(learner_store.summary, user_key)
    return {"topics": topics}


class FeedbackRequest(BaseModel):
    question: str = ""
    answer: str = ""
    rating: str  # "up" | "down"
    board: str | None = None
    grade: str | None = None
    subject: str | None = None


@app.post("/feedback")
async def feedback(
    req: FeedbackRequest, authorization: str | None = Header(default=None)
) -> dict:
    """Recursive self-improvement: a 👎 makes the tutor critique its own answer and
    store a directive that improves this student's future answers on the topic."""
    if req.rating == "down" and req.answer.strip():
        directive = await _self_critique(req.question, req.answer)
        if directive:
            user_key = _email_opt(authorization)
            scope = _scope(req.board, req.grade, req.subject)
            existing = await run_in_threadpool(
                improve_store.for_context, user_key, scope, 10
            )
            if existing:
                # Smart Improver: consolidate instead of piling up.
                merged = await _consolidate_directives(existing, directive)
                await run_in_threadpool(improve_store.replace, user_key, scope, merged)
                return {"ok": True, "learned": directive, "total": len(merged)}
            await run_in_threadpool(
                improve_store.add, user_key, scope, directive, req.question
            )
            return {"ok": True, "learned": directive, "total": 1}
    return {"ok": True}


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None


@app.post("/tts")
async def tts(req: TTSRequest) -> Response:
    """Natural read-aloud voice via Gemini TTS. 503 on failure → the client
    falls back to the browser's built-in voice."""
    wav = await tts_synthesize(req.text, settings.gemini_api_key, req.voice or "Aoede")
    if not wav:
        raise HTTPException(status_code=503, detail="TTS unavailable")
    return Response(content=wav, media_type="audio/wav")


class OralEvalRequest(BaseModel):
    student_text: str
    reference_text: str
    subject: str = ""
    grade: str = ""
    board: str = ""


@app.post("/api/evaluate-oral")
async def api_evaluate_oral(req: OralEvalRequest) -> dict[str, Any]:
    """Evaluate a student's spoken recitation against the reference answer.
    Used by the Talk Live oral practice feature."""
    return await evaluate_oral(
        student_text=req.student_text,
        reference_text=req.reference_text,
        subject=req.subject,
        grade=req.grade,
        board=req.board,
    )


@app.post("/verify")
async def verify(req: VerifyRequest) -> dict:
    """SymPy correctness seam (§7). Phase 0: callable, not yet enforcing on chat."""
    result = (
        correctness.verify(req.claimed, req.expression)
        if req.claimed is not None
        else correctness.evaluate(req.expression)
    )
    return {"ok": result.ok, "expected": result.expected, "detail": result.detail}


@app.get("/api/textbook/catalog")
def get_textbook_catalog() -> dict[str, Any]:
    """List available textbook curricula indexed in Tark."""
    from app.textbook_service import get_available_textbook_catalog
    catalog = get_available_textbook_catalog()
    return {"catalog": catalog}


@app.get("/api/textbook/chapters")
def get_textbook_chapters(board: str = "", grade: str = "", subject: str = "") -> dict[str, Any]:
    """Get chapters and start/end page numbers for a board/grade/subject."""
    from app.textbook_service import get_chapters_for_subject
    chapters = get_chapters_for_subject(board, grade, subject)
    return {"chapters": chapters}


@app.get("/api/textbook/page-image")
def get_textbook_page_image(
    source: str = "",
    page: int = 1,
    dpi: int = 150,
    board: str = "",
    grade: str = "",
    subject: str = "",
    chapter: str = "",
    topic: str = "",
) -> Response:
    """Render and stream a crisp high-res PNG image of a textbook page (from PDF or synthesized curriculum study card)."""
    from app.textbook_service import (
        render_pdf_page_png,
        render_generated_textbook_page_png,
        KNOWN_TEXTBOOK_MAP,
        normalize_board,
        normalize_grade,
        normalize_subject,
    )
    img_bytes = None
    if source:
        img_bytes = render_pdf_page_png(source, page, chapter=chapter, dpi=dpi)
    if not img_bytes and (board or subject):
        nb = normalize_board(board)
        ng = normalize_grade(grade)
        ns = normalize_subject(subject)
        resolved_src = KNOWN_TEXTBOOK_MAP.get((nb, ng, ns)) or KNOWN_TEXTBOOK_MAP.get((nb, ng, subject.strip()))
        if resolved_src:
            img_bytes = render_pdf_page_png(resolved_src, page, chapter=chapter, dpi=dpi)
    if not img_bytes:
        img_bytes = render_generated_textbook_page_png(
            board=board,
            grade=grade,
            subject=subject,
            chapter=chapter,
            page_number=page,
            topic=topic,
            dpi=dpi,
        )
    if not img_bytes:
        raise HTTPException(status_code=404, detail=f"Could not render page {page} image")
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
    )


def _sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode()


class VoiceRecitationRequest(BaseModel):
    target_concept: str
    student_transcript: str
    subject: str = ""
    grade: str = ""
    board: str = ""
    language: str = "en-IN"


@app.post("/api/voice/evaluate-recitation")
async def evaluate_recitation(req: VoiceRecitationRequest) -> dict[str, Any]:
    """Evaluate a student's spoken recitation against target concept/answer and return detailed oral critique + score."""
    if not req.student_transcript.strip():
        return {
            "accuracy_score": 0,
            "grade_label": "No Speech Detected",
            "key_points_covered": [],
            "key_points_missing": ["Please speak your answer aloud into the microphone."],
            "feedback_speech": "I didn't catch your voice. Please click the microphone and recite your answer aloud!",
            "feedback_markdown": "⚠️ **No speech detected.** Please check your microphone and speak clearly.",
            "target_summary": req.target_concept[:150],
        }

    eval_prompt = (
        "You are Tark, an encouraging, rigorous AI tutor conducting a live oral recitation / memory check with a student.\n"
        "The student is trying to recite or explain a key concept/answer from memory.\n\n"
        f"TARGET CONCEPT / IDEAL ANSWER:\n\"\"\"\n{req.target_concept}\n\"\"\"\n\n"
        f"STUDENT'S SPOKEN TRANSCRIPT:\n\"\"\"\n{req.student_transcript}\n\"\"\"\n\n"
        f"Context: Subject={req.subject or 'General STEM'}, Grade={req.grade or 'School'}, Board={req.board or 'Curriculum'}.\n\n"
        "YOUR EVALUATION TASKS:\n"
        "1. Calculate an Accuracy Score (0 to 100) based on conceptual fidelity, accuracy of definitions/formulas/laws, and completeness.\n"
        "2. List 2 to 4 key terms or concepts the student successfully COVERED.\n"
        "3. List 1 to 3 key terms or concepts the student MISSED or got slightly wrong.\n"
        "4. Generate a warm, concise 'feedback_speech' (2 to 3 sentences maximum, spoken-friendly, no markdown symbols or asterisks) that Tark will speak aloud directly to the student.\n"
        "5. Generate a structured 'feedback_markdown' containing bullet points with praise, corrections, and memory tips.\n"
        "6. Provide a concise 1-sentence 'target_summary' of the core rule.\n\n"
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "accuracy_score": 85,\n'
        '  "grade_label": "Mastered / Strong Attempt / Needs Review",\n'
        '  "key_points_covered": ["Covered point 1", "Covered point 2"],\n'
        '  "key_points_missing": ["Missed point 1"],\n'
        '  "feedback_speech": "Great job! You nailed the definition of inertia, but make sure to mention that mass is its quantitative measure next time.",\n'
        '  "feedback_markdown": "### 🎯 Oral Assessment Summary\\n- **Accuracy**: 85%\\n- **What you nailed**: ...\\n- **What to add**: ...",\n'
        '  "target_summary": "Inertia is the tendency of an object to resist changes in its velocity."\n'
        "}\n"
    )

    try:
        raw = await asyncio.wait_for(
            _llm_text(
                "You are an expert pedagogical oral exam assessor. Return ONLY valid JSON.",
                eval_prompt,
                "llama-70b",
            ),
            timeout=10.0,
        )
        m = re.search(r"\{[\s\S]*\}", raw or "")
        if m:
            res_json = json.loads(m.group(0))
            score = int(res_json.get("accuracy_score", 70))
            label = res_json.get("grade_label") or ("Mastered" if score >= 85 else ("Good Attempt" if score >= 60 else "Needs Review"))
            return {
                "accuracy_score": max(0, min(100, score)),
                "grade_label": label,
                "key_points_covered": res_json.get("key_points_covered", []),
                "key_points_missing": res_json.get("key_points_missing", []),
                "feedback_speech": res_json.get("feedback_speech", "Good effort! Keep practicing to master all key terms."),
                "feedback_markdown": res_json.get("feedback_markdown", "### Assessment Completed\nGood attempt on this recitation."),
                "target_summary": res_json.get("target_summary", req.target_concept[:150]),
            }
    except Exception as e:
        logger.warning(f"Voice evaluation LLM error: {e}")

    # Fallback heuristic evaluation if LLM times out
    target_words = set(re.findall(r"\b\w{4,}\b", req.target_concept.lower()))
    spoken_words = set(re.findall(r"\b\w{4,}\b", req.student_transcript.lower()))
    matched = list(target_words.intersection(spoken_words))[:5]
    missed = list(target_words.difference(spoken_words))[:4]
    ratio = len(matched) / max(1, len(matched) + len(missed))
    score = int(ratio * 100)
    label = "Mastered" if score >= 80 else ("Good Attempt" if score >= 50 else "Needs Review")

    return {
        "accuracy_score": score,
        "grade_label": label,
        "key_points_covered": [f"Mentioned: {w.title()}" for w in matched] or ["Good vocal clarity"],
        "key_points_missing": [f"Missing keyword: {w.title()}" for w in missed] or ["Review the full definition"],
        "feedback_speech": f"You scored {score} percent accuracy. You covered several key terms. Keep practicing to memorize the full definition!",
        "feedback_markdown": f"### 🎙️ Heuristic Recitation Check\n- **Estimated Accuracy**: {score}%\n- **Matched Key Terms**: {', '.join(matched) if matched else 'None'}\n- **Suggested Keywords to Include**: {', '.join(missed) if missed else 'None'}",
        "target_summary": req.target_concept[:150],
    }


class SimulationRequest(BaseModel):
    question: str = ""
    answer: str = ""
    topic: str = ""
    subject: str = ""
    context: str = ""


@app.get("/simulations/catalog")
@app.get("/api/simulations/catalog")
async def get_simulations_catalog() -> dict[str, Any]:
    """Return the curated simulation catalog for the Virtual Lab."""
    return {"catalog": get_catalog()}


def infer_subject_for_simulation(topic: str, text: str = "", citations: list[str] | None = None) -> str:
    """Classify scientific topic into standard STEM subject tabs."""
    combined = f"{topic} {text} {' '.join(citations or [])}".lower()
    for c in (citations or []):
        cl = c.lower()
        if "physics" in cl:
            return "Physics"
        if "chem" in cl:
            return "Chemistry"
        if "bio" in cl:
            return "Biology"
        if "math" in cl:
            return "Mathematics"

    bio_kw = ["heart", "blood", "circulation", "cardiac", "mitosis", "meiosis", "dna", "rna", "photosynthesis", "plant", "respiration", "neuron", "synapse", "cell", "osmosis", "organ", "genetics", "ecology", "enzyme", "digestive", "kidney", "nephron", "biology"]
    chem_kw = ["acid", "base", "ph", "titration", "bond", "ionic", "covalent", "mole", "molar", "reaction", "electron", "orbital", "element", "periodic", "compound", "electrolysis", "salt", "redox", "oxidation", "reduction", "catalyst", "equilibrium", "solution", "chemistry"]
    phys_kw = ["projectile", "motion", "pendulum", "gravity", "velocity", "acceleration", "force", "lens", "optics", "refraction", "reflection", "circuit", "ohm", "voltage", "current", "wave", "interference", "slit", "gas law", "thermodynamics", "piston", "pressure", "magnetic", "induction", "physics", "shm", "spring", "hooke"]
    math_kw = ["quadratic", "parabola", "algebra", "calculus", "derivative", "integral", "matrix", "geometry", "trigonometry", "sin", "cos", "tan", "polygon", "vector", "polynomial", "graph", "coordinate", "probability", "statistics", "mathematics"]

    scores = {
        "Biology": sum(1 for kw in bio_kw if re.search(r"\b" + kw, combined)),
        "Chemistry": sum(1 for kw in chem_kw if re.search(r"\b" + kw, combined)),
        "Physics": sum(1 for kw in phys_kw if re.search(r"\b" + kw, combined)),
        "Mathematics": sum(1 for kw in math_kw if re.search(r"\b" + kw, combined)),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Physics"


@app.get("/simulations/catalog/{sim_id}")
@app.get("/api/simulations/catalog/{sim_id}")
async def get_simulation_detail(sim_id: str) -> dict[str, Any]:
    """Retrieve full simulation data for a catalog entry (generates custom_html on the fly if needed)."""
    item = get_catalog_item(sim_id)
    if not item:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if item.get("builtin_type"):
        return {
            "simulation": {
                "id": item["id"],
                "type": item["builtin_type"],
                "title": item["title"],
                "subject": item["subject"],
                "concept": item["category"],
                "description": item["description"],
                "params": item.get("default_params", {}),
            }
        }

    # If already has cached/saved HTML content from textbook discovery
    if item.get("html_content") or item.get("htmlContent"):
        html_code = item.get("html_content") or item.get("htmlContent")
        return {
            "simulation": {
                "id": item["id"],
                "type": "custom_html",
                "title": item["title"],
                "subject": item["subject"],
                "concept": item.get("category", item["title"]),
                "description": item["description"],
                "html_content": html_code,
                "htmlContent": html_code,
                "textbook_sources": item.get("textbook_sources", []),
            }
        }

    # Custom HTML simulation: generate using pre-crafted prompt
    prompt = item.get("generation_prompt") or item["title"]
    sim = await generate_custom_simulation_html(prompt, context=item.get("description", ""))
    if not sim:
        raise HTTPException(status_code=500, detail="Failed to generate interactive simulation")

    sim["id"] = item["id"]
    sim["title"] = item["title"]
    sim["subject"] = item["subject"]
    sim["concept"] = item["category"]
    sim["description"] = item["description"]
    return {"simulation": sim}


@app.post("/simulations/generate")
@app.post("/api/simulation/generate")
@app.post("/api/simulations/generate")
async def generate_simulation_endpoint(req: SimulationRequest) -> dict[str, Any]:
    """Generate or retrieve an interactive simulation (virtualization) for a given topic."""
    target_text = (req.topic or req.question or "").strip()
    if not target_text:
        raise HTTPException(status_code=400, detail="Topic or question is required")

    # 1. Check built-in candidates first for instant zero-latency loading
    sim = detect_simulation_candidate(target_text)
    if not sim and req.answer:
        sim = detect_simulation_candidate(req.answer[:300])
    if sim:
        return {"sim": sim, "simulation": sim}

    # 2. Synthesize custom interactive HTML5 Canvas simulation via LLM with curriculum grounding
    try:
        custom_sim = await generate_custom_simulation_html(
            target_text,
            context=req.context or req.answer or req.subject or "",
        )
        if custom_sim:
            citations = custom_sim.get("textbook_sources", [])
            grounded = bool(custom_sim.get("grounded") or citations)

            # Classify subject into official STEM categories
            subject = req.subject if req.subject in ["Physics", "Chemistry", "Biology", "Mathematics"] else infer_subject_for_simulation(target_text, custom_sim.get("description", ""), citations)
            custom_sim["subject"] = subject

            # When Tark/Acharya finds the lab in textbooks (or generates a grounded curriculum lab),
            # persist and automatically add that lab to the catalog under that particular subject!
            emoji_map = {"Physics": "⚡", "Chemistry": "🧪", "Biology": "🔬", "Mathematics": "📐"}
            clean_title = re.sub(r"^Lab:\s*", "", custom_sim["title"]).strip().title()

            catalog_item = {
                "id": custom_sim["id"],
                "title": clean_title,
                "subject": subject,
                "category": f"Curriculum Lab • {subject}",
                "emoji": emoji_map.get(subject, "🔬"),
                "difficulty": "Intermediate",
                "description": custom_sim["description"],
                "builtin_type": None,
                "html_content": custom_sim.get("htmlContent") or custom_sim.get("html_content"),
                "textbook_sources": citations,
                "is_custom": True,
                "grounded": grounded,
            }

            saved_item = save_custom_catalog_item(catalog_item)
            logger.info(f"Dynamically added grounded lab '{clean_title}' to {subject} catalog.")

            return {
                "sim": custom_sim,
                "simulation": custom_sim,
                "added_to_catalog": True,
                "grounded_in_textbooks": grounded,
                "catalog_item": saved_item,
            }
    except Exception as e:
        logger.warning(f"Error generating custom simulation: {e}")

    # 3. Graceful fallback to default interactive physics lab
    fallback = detect_simulation_candidate("projectile trajectory")
    return {"sim": fallback, "simulation": fallback}


@app.post("/api/simulations/compute")
async def compute_simulation_endpoint(request: Request) -> dict[str, Any]:
    """Execute high-speed numerical simulation physics via Rust (tark_core) or Python fallback."""
    from app.simulations import solver
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    sim_type = payload.get("type", "double_pendulum")
    params = payload.get("params", {})

    if sim_type == "double_pendulum":
        traj = solver.solve_double_pendulum(
            theta1=float(params.get("theta1", 1.57)),
            theta2=float(params.get("theta2", 1.57)),
            omega1=float(params.get("omega1", 0.0)),
            omega2=float(params.get("omega2", 0.0)),
            num_steps=int(params.get("steps", 10000)),
            sample_stride=int(params.get("stride", 10)),
        )
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "trajectory": traj}
    elif sim_type == "nbody":
        bodies = params.get("bodies", [])
        if not bodies:
            bodies = [
                (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1000.0),
                (10.0, 0.0, 0.0, 0.0, 10.0, 0.0, 1.0),
            ]
        dt = float(params.get("dt", 0.001))
        steps = int(params.get("steps", 500))
        final_bodies, energy = solver.solve_nbody_gravity(bodies, dt, steps)
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "bodies": final_bodies, "energy": energy}
    elif sim_type == "heat_diffusion":
        grid_size = int(params.get("grid_size", 64))
        steps = int(params.get("steps", 100))
        grid, max_t = solver.solve_heat_diffusion(grid_size=grid_size, steps=steps)
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "grid": grid, "max_temp": max_t}
    elif sim_type == "lorenz":
        steps = int(params.get("steps", 50000))
        mle = solver.solve_lorenz_chaos(steps=steps)
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "lyapunov_exponent": mle}
    elif sim_type == "roots":
        coeffs = params.get("coeffs", [-1.0, 0.0])
        roots = solver.solve_polynomial_roots(coeffs)
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "roots": roots}
    elif sim_type == "fermi_dirac":
        eta = float(params.get("eta", 0.0))
        val = solver.solve_fermi_dirac(eta)
        return {"type": sim_type, "rust_accelerated": solver.is_rust_accelerated(), "value": val}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown simulation type: {sim_type}")



