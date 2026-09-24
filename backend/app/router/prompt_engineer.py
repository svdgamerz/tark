"""Dedicated Autonomous Prompt Engineering Layer.

Uses an isolated Groq API key and high-speed open-weight models (qwen/qwen3.8-27b
and openai/gpt-oss-120b) to convert raw student queries into rigorous, high-yield
academic prompts before sending them to the downstream tutor.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from openai import AsyncOpenAI

from app.config.settings import Settings

logger = logging.getLogger("tark.prompt_engineer")

PROMPT_ENGINEER_SYSTEM_INSTRUCTION = """You are a master pedagogical prompt engineer and instructional architect.
Convert raw student doubts into an authoritative, high-yield academic query for a STEM tutor.

CRITICAL RULES:
1. Write the prompt as a direct student question or academic instruction (e.g. 'Explain...', 'Break down the mechanism of...', 'Derive...', 'Provide an intuitive first-principles explanation of...').
2. NEVER write meta-roleplay instructions such as 'You are an expert...', 'Act as a...', 'As a tutor...', or introductory conversational filler.
3. If the student asks for an image, picture, drawing, diagram, or visual illustration, you MUST retain the visual request and specify the key components, labels, and structures to highlight.
4. State the exact physical, chemical, or biological laws, mechanisms, and core principles involved.
5. For conceptual questions (biology, qualitative physics/chemistry), instruct the tutor to ground the explanation in vivid real-world intuition, everyday analogies, and clear step-by-step physical mechanisms. For quantitative calculations, ask for clean LaTeX display math ($$...$$).
6. Calibrate depth and terminology with the student's target exam (e.g. JEE, NEET, CBSE, ICSE) and grade level.
7. Instruct the tutor to highlight real-world applications and conclude with an engaging intuition check.
8. Instruct the tutor to keep the response tightly structured, concise (under 350 words), and focused—using compact contrast cards/bullets, avoiding sprawling textbook walls of text, horizontal divider lines (`---`), robotic numbered headers, and raw ASCII pipe tables.

Output ONLY the engineered prompt (2 to 4 concise sentences).
Do NOT output conversational preambles (e.g. 'Here is your prompt:'), explanations, or quotation marks."""

SKIP_KEYWORDS = {
    "hi", "hello", "hey", "hola", "namaste", "good morning", "good afternoon",
    "good evening", "thanks", "thank you", "bye", "goodbye", "ok", "okay",
    "k", "yes", "no", "sure", "got it"
}


class PromptOptimizer:
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.prompt_engineer_api_key or settings.groq_api_key
        self.primary_model = settings.prompt_engineer_model or "qwen/qwen3.8-27b"
        self.fallback_model = "openai/gpt-oss-20b"
        self._client: AsyncOpenAI | None = None

        if self.api_key:
            self._client = AsyncOpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.api_key,
                timeout=2.5,
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
