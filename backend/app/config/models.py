"""THE single source of truth for task → model routing (CLAUDE.md §6).

Never hardcode a model id anywhere else in the codebase. To swap a model, edit
this file only. Every model here is on a FREE tier (Gemini Flash; an open NIM
model). Adding/removing a provider does not require touching the router.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Provider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    NIM = "nim"
    GROQ = "groq"
    OPENROUTER = "openrouter"
    MISTRAL = "mistral"
    CEREBRAS = "cerebras"
    SAMBANOVA = "sambanova"


# OpenAI-compatible base URLs (Gemini is handled by its own SDK adapter).
PROVIDER_BASE_URLS: dict[Provider, str] = {
    Provider.OPENAI: "https://api.openai.com/v1",
    Provider.NIM: "https://integrate.api.nvidia.com/v1",
    Provider.GROQ: "https://api.groq.com/openai/v1",
    Provider.OPENROUTER: "https://openrouter.ai/api/v1",
    Provider.MISTRAL: "https://api.mistral.ai/v1",
    Provider.CEREBRAS: "https://api.cerebras.ai/v1",
    Provider.SAMBANOVA: "https://api.sambanova.ai/v1",
}


class Task(str, Enum):
    # Lecture / Socratic / general chat — fast, generous free quota.
    CHAT = "chat"
    # Multimodal homework / diagram reading (vision) — same Gemini Flash.
    VISION = "vision"
    # Hard reasoning (proofs, multi-step) — a large open NIM model.
    HEAVY_REASONING = "heavy_reasoning"


# Local embedding model for RAG (fastembed / ONNX, 384-dim). Local = no API rate
# limits and free for both indexing AND every user query — the right fit for a
# free, public, small-scale product. (Gemini's free embedding tier caps at 100
# requests/min, which a real user load would hit.)
EMBED_MODEL = "BAAI/bge-small-en-v1.5"


# gemini-flash-latest is Google's dynamic alias that always points to the active
# Flash model supported across both legacy and newly provisioned AI Studio keys.
GEMINI_FLASH = "gemini-flash-latest"
# Gemini text-to-speech (read-aloud). Free-tier flash TTS works on this key; the
# pro TTS model is paywalled (429). Voice/adapter live in app/tts/.
GEMINI_TTS = "gemini-2.5-flash-preview-tts"
# Heavy reasoning + failover model on NVIDIA NIM. NIM's public catalog rotates:
# the `deepseek-ai/deepseek-v4-pro` id from the build.nvidia.com snippet does not
# respond on integrate.api.nvidia.com (it hangs), and the deepseek-r1/v3 / qwen
# ids 404 for this key. `meta/llama-3.3-70b-instruct` is confirmed working and is
# explicitly sanctioned by CLAUDE.md §6 (a large open Llama/DeepSeek/Qwen-class
# model). To switch back to a DeepSeek model, change only this line — the NIM
# adapter auto-enables the DeepSeek `thinking` flag when the id contains "deepseek".
NIM_HEAVY = "meta/llama-3.3-70b-instruct"


# Primary task → (provider, model_id).
TASK_MODEL_MAP: dict[Task, tuple[Provider, str]] = {
    Task.CHAT: (Provider.GEMINI, GEMINI_FLASH),
    Task.VISION: (Provider.GEMINI, GEMINI_FLASH),
    Task.HEAVY_REASONING: (Provider.NIM, NIM_HEAVY),
}

# Failover target when a provider is exhausted/unavailable (CLAUDE.md §6).
FAILOVER_MODEL: dict[Provider, tuple[Provider, str]] = {
    Provider.GEMINI: (Provider.NIM, NIM_HEAVY),
    Provider.NIM: (Provider.GEMINI, GEMINI_FLASH),
}


# --- User-facing model switcher (all tested working on the current keys) ---
@dataclass(frozen=True)
class ModelSpec:
    id: str          # stable id used by the API + frontend
    label: str       # display name in the switcher
    provider: Provider
    model: str       # the provider's model id
    tier: str        # "public" (anyone) or "admin" (admins only)
    grounded: bool   # uses curriculum RAG (only "Acharya")
    description: str


MODELS: list[ModelSpec] = [
    ModelSpec("acharya", "Acharya", Provider.GEMINI, GEMINI_FLASH, "public", True,
              "Tark's core tutor — tailored to your school syllabus and textbooks."),
    ModelSpec("gemini-flash", "Gemini Flash", Provider.GEMINI, GEMINI_FLASH, "public", False,
              "Fast and versatile reasoning model."),
    ModelSpec("gpt-4o-mini", "GPT-4o Mini", Provider.OPENAI, "gpt-4o-mini", "public", False,
              "Fast and responsive model for everyday learning."),
    ModelSpec("gpt-4o", "GPT-4o", Provider.OPENAI, "gpt-4o", "public", False,
              "High-accuracy flagship model for deep conceptual understanding."),
    ModelSpec("llama-70b", "GPT-OSS 120B", Provider.GROQ, "openai/gpt-oss-120b", "public", False,
              "Ultra-fast high-capacity model on Groq hardware."),
    ModelSpec("qwen-27b", "Qwen 27B", Provider.GROQ, "qwen/qwen3.8-27b", "public", False,
              "Fast open-weight model for STEM problem solving."),
    ModelSpec("mistral-large", "Mistral Large", Provider.MISTRAL, "mistral-large-latest", "public", False,
              "Comprehensive model for detailed step-by-step answers."),
    ModelSpec("deepseek-v32", "DeepSeek V3.2", Provider.SAMBANOVA, "DeepSeek-V3.2", "public", False,
              "Advanced reasoning model for complex STEM problems."),
    ModelSpec("deepseek-r1", "DeepSeek R1", Provider.OPENROUTER, "deepseek/deepseek-r1", "admin", False,
              "Deep reasoning model for advanced proofs and derivations."),
    ModelSpec("claude-35-sonnet", "Claude 3.5 Sonnet", Provider.OPENROUTER, "anthropic/claude-3.5-sonnet", "public", False,
              "Exceptional model for step-by-step pedagogical explanations."),
]

MODELS_BY_ID: dict[str, ModelSpec] = {m.id: m for m in MODELS}
DEFAULT_MODEL_ID = "acharya"

# If a chosen model fails (429/error), fall back through these in order — four
# independent providers, each with its own free quota, so Acharya keeps answering
# even when one or two are exhausted. Deduped against the chosen model.
FALLBACK_CHAIN: list[tuple[Provider, str]] = [
    (Provider.GEMINI, GEMINI_FLASH),
    (Provider.GROQ, "openai/gpt-oss-120b"),
    (Provider.GROQ, "qwen/qwen3.8-27b"),
    (Provider.GROQ, "openai/gpt-oss-20b"),
    (Provider.OPENAI, "gpt-4o-mini"),
    (Provider.SAMBANOVA, "DeepSeek-V3.2"),
    (Provider.NIM, NIM_HEAVY),
    (Provider.MISTRAL, "mistral-large-latest"),
]


def get_model(model_id: str | None) -> ModelSpec:
    return MODELS_BY_ID.get(model_id or DEFAULT_MODEL_ID, MODELS_BY_ID[DEFAULT_MODEL_ID])


def allowed_models(is_admin: bool) -> list[ModelSpec]:
    return [m for m in MODELS if m.tier == "public" or is_admin]


def attempts_for(spec: ModelSpec) -> list[tuple[Provider, str]]:
    """Ordered (provider, model) attempts: the chosen model, then fallbacks."""
    plan = [(spec.provider, spec.model)]
    for pm in FALLBACK_CHAIN:
        if pm not in plan:
            plan.append(pm)
    return plan
