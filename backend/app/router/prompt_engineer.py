"""Dedicated Autonomous Prompt Engineering Layer.

Uses an isolated Groq API key and high-speed open-weight models to convert
raw student queries into rigorous academic prompts — BUT ONLY when the query
is genuinely academic/exam-related with curriculum context.

Non-academic queries (coding, how-to, general knowledge, etc.) are ALWAYS
passed through unchanged to preserve natural response quality.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from openai import AsyncOpenAI

from app.config.settings import Settings

logger = logging.getLogger("tark.prompt_engineer")

PROMPT_ENGINEER_SYSTEM_INSTRUCTION = """You are a master pedagogical prompt engineer.
Convert a student's raw academic doubt into a clean, focused query for a tutor.

CRITICAL RULES:
1. Write the prompt as a direct student question (e.g. 'Explain...', 'Break down...', 'Derive...').
2. NEVER write meta-roleplay instructions ('You are an expert...', 'Act as a...').
3. State the exact physical, chemical, or biological laws/mechanisms involved.
4. Calibrate depth with the student's target exam and grade level.
5. Keep it concise — 2 to 4 sentences maximum.
6. If the student asks for a visual/diagram, retain that request.

Output ONLY the engineered prompt. No preamble, explanations, or quotation marks."""

SKIP_KEYWORDS = {
    "hi", "hello", "hey", "hola", "namaste", "good morning", "good afternoon",
    "good evening", "thanks", "thank you", "bye", "goodbye", "ok", "okay",
    "k", "yes", "no", "sure", "got it"
}

# Patterns that indicate NON-ACADEMIC queries — these must NEVER be transformed
_NON_ACADEMIC_PATTERNS = [
    # Programming / coding / tech
    re.compile(r"\b(install|setup|configure|deploy|docker|npm|pip|git|github|code|coding|programming|debug|compile|build|run|execute|terminal|command|bash|powershell|cmd|vscode|ide)\b", re.I),
    re.compile(r"\b(python|javascript|typescript|java|c\+\+|react|node|django|flask|fastapi|html|css|mongodb|mysql|postgres|sql|api|http|server|database|backend|frontend|fullstack|full.?stack)\b", re.I),
    re.compile(r"\b(error|bug|crash|exception|traceback|stack.?trace|undefined|null|nan|syntax|runtime)\b", re.I),
    # How-to / practical tasks
    re.compile(r"\b(how\s+to|how\s+do\s+i|how\s+can\s+i|steps\s+to|guide|tutorial|instructions|procedure)\b", re.I),
    # General knowledge / non-exam
    re.compile(r"\b(recipe|cook|travel|weather|news|movie|song|game|sport|fitness|health|diet|career|job|resume|interview|salary)\b", re.I),
    # Creative / writing
    re.compile(r"\b(write\s+a|create\s+a|draft|essay|poem|story|letter|email|message|speech|presentation|blog)\b", re.I),
    # System / OS / software
    re.compile(r"\b(windows|linux|mac|ubuntu|android|ios|app|application|software|download|update|upgrade|uninstall)\b", re.I),
]

# Patterns that indicate genuinely academic/exam queries worth enhancing
_ACADEMIC_SIGNALS = [
    re.compile(r"\b(explain|define|derive|prove|theorem|law|principle|formula|equation|reaction|mechanism|process)\b", re.I),
    re.compile(r"\b(physics|chemistry|biology|maths?|mathematics|science|geography|history|economics|accountancy|civics)\b", re.I),
    re.compile(r"\b(ncert|cbse|icse|igcse|jee|neet|board|exam|syllabus|textbook|chapter|class\s*\d|grade\s*\d)\b", re.I),
    re.compile(r"\b(photosynthesis|mitosis|meiosis|electromagnet|refraction|diffraction|osmosis|respiration|digestion)\b", re.I),
    re.compile(r"\b(newton|boyle|charles|ohm|faraday|mendel|darwin|archimedes|pythagoras|euclid)\b", re.I),
]


def _is_academic_query(text: str, context: dict[str, Any] | None = None) -> bool:
    """Determine if a query is genuinely academic and would benefit from prompt engineering."""
    low = text.lower().strip()
    ctx = context or {}

    # If the query matches ANY non-academic pattern, skip immediately
    for pat in _NON_ACADEMIC_PATTERNS:
        if pat.search(low):
            return False

    # Must have BOTH academic signal AND curriculum context to qualify
    has_academic_signal = any(pat.search(low) for pat in _ACADEMIC_SIGNALS)
    has_curriculum_context = bool(ctx.get("board") or ctx.get("grade") or ctx.get("exam"))

    return has_academic_signal and has_curriculum_context


class PromptOptimizer:
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.prompt_engineer_api_key or settings.groq_api_key
        # Use verified fast Groq model IDs (tested active)
        self.primary_model = "openai/gpt-oss-120b"
        self.fallback_model = "openai/gpt-oss-20b"
        self._client: AsyncOpenAI | None = None

        if self.api_key:
            self._client = AsyncOpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.api_key,
                timeout=4.0,
            )

    @property
    def is_available(self) -> bool:
        return self._client is not None

    async def optimize(
        self,
        query: str,
        context: dict[str, Any] | None = None,
    ) -> tuple[str, bool]:
        """Transform a raw student query into an engineered pedagogical prompt.

        Returns:
            (resulting_prompt, was_optimized)
        """
        trimmed = query.strip()
        if not trimmed or not self.is_available:
            return query, False

        # Skip trivial greetings or small-talk
        if trimmed.lower() in SKIP_KEYWORDS or (len(trimmed.split()) <= 1 and trimmed.lower().isalpha()):
            return query, False

        # Skip direct factual, navigational, or chapter-name queries
        low = trimmed.lower()
        if (
            re.search(r"\b(name|title|which|what)\s+(is|of)?\s*(the\s+)?(\d+\w*|\w+)?\s*chapter\b", low)
            or re.search(r"\bchapter\s*\d+\s*(name|title)\b", low)
            or re.search(r"\b(list|give me|tell me)\s+(the\s+)?(all\s+)?chapters\b", low)
            or re.search(r"\b(syllabus|curriculum|table of contents|index)\b", low)
        ):
            return query, False

        # CORE GATE: Only enhance genuinely academic queries with curriculum context
        if not _is_academic_query(trimmed, context):
            return query, False

        # Assemble rich pedagogical context
        ctx = context or {}
        context_lines = []
        if ctx.get("exam"):
            context_lines.append(f"Target Exam: {ctx['exam']}")
        if ctx.get("grade"):
            context_lines.append(f"Class/Grade: Class {ctx['grade']}")
        if ctx.get("board"):
            context_lines.append(f"Curriculum Board: {ctx['board']}")
        if ctx.get("subject"):
            context_lines.append(f"Subject: {ctx['subject']}")
        if ctx.get("tutoring_style"):
            context_lines.append(f"Preferred Tutoring Style: {ctx['tutoring_style']}")
        if ctx.get("language") and ctx["language"].lower() != "english":
            context_lines.append(f"Language Medium: {ctx['language']}")
        if ctx.get("weak_subjects"):
            context_lines.append(f"Student Struggling In: {', '.join(ctx['weak_subjects'])}")
        if ctx.get("goal"):
            context_lines.append(f"Learning Goal: {ctx['goal']}")

        user_content = f"STUDENT'S RAW QUERY:\n{trimmed}"
        if context_lines:
            user_content += "\n\nSTUDENT PROFILE CONTEXT:\n" + "\n".join(context_lines)

        messages = [
            {"role": "system", "content": PROMPT_ENGINEER_SYSTEM_INSTRUCTION},
            {"role": "user", "content": user_content},
        ]

        # Execute with primary model, fast failover, and timeout guard
        for model_name in [self.primary_model, self.fallback_model]:
            try:
                assert self._client is not None
                response = await asyncio.wait_for(
                    self._client.chat.completions.create(
                        model=model_name,
                        messages=messages,  # type: ignore
                        temperature=0.3,
                        max_tokens=250,
                    ),
                    timeout=3.5,
                )
                if response.choices and response.choices[0].message.content:
                    engineered = response.choices[0].message.content.strip()
                    if engineered.startswith('"') and engineered.endswith('"') and len(engineered) > 2:
                        engineered = engineered[1:-1].strip()
                    if engineered:
                        logger.info(f"Prompt engineered successfully with {model_name}")
                        return engineered, True
            except asyncio.TimeoutError:
                logger.warning(f"Prompt optimization timed out with model {model_name}, trying next...")
                continue
            except Exception as e:
                logger.warning(f"Prompt optimization failed on {model_name}: {e}")
                continue

        # Safe fallback: return original prompt unchanged
        return query, False
