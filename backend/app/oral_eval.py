"""Oral recitation evaluation — Gemini-powered assessment of a student's
spoken answer against a reference text.

Uses the Gemini Flash model (same key already configured for chat) to
intelligently compare paraphrased answers, identify covered vs. missed
key points, and return structured feedback.
"""
from __future__ import annotations

import json
import logging
import re

from google import genai
from google.genai import types

from app.config.models import GEMINI_FLASH
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

_EVAL_SYSTEM = (
    "You are Tark, an encouraging and rigorous AI oral exam assessor for school students. "
    "You evaluate a student's spoken recitation of an answer against the reference/ideal answer. "
    "Be fair — accept paraphrased correct content, and do NOT penalize minor wording differences. "
    "Crucially: evaluate whether the student understood the core concepts, principles, and cause-and-effect mechanisms. "
    "Never penalize a student for not reciting mathematical formulas, LaTeX markup, or step-by-step arithmetic numbers aloud. "
    "Focus on conceptual clarity, key scientific terminology, and accurate definitions. "
    "Respond ONLY with a valid JSON object — no markdown, no code fences, no extra text."
)


def _clean_math_for_oral_eval(text: str) -> str:
    """Pre-sanitize raw LaTeX and equations into clean concept text for LLM comparison."""
    if not text:
        return ""
    # Drop code blocks
    s = re.sub(r"```[\s\S]*?```", "", text)
    # Convert units first (both standard, escaped spaces, and exponent outside text block)
    s = re.sub(r"(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?1\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?1\}\s*\}|m[\s\u202F\u00A0]*s⁻¹", "m/s", s, flags=re.IGNORECASE)
    s = re.sub(r"(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?2\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?2\}\s*\}|m[\s\u202F\u00A0]*s⁻²|m/s\^2", "m/s²", s, flags=re.IGNORECASE)
    s = re.sub(r"\\text\{\s*kg\s*\}", "kg", s, flags=re.IGNORECASE)
    s = re.sub(r"\\text\{\s*N\s*\}", "N", s)

    # Convert variables
    s = re.sub(r"\\muk\b|\\mu_k\b", "coefficient of kinetic friction (μ)", s)
    s = re.sub(r"\\mus\b|\\mu_s\b", "coefficient of static friction (μ)", s)
    s = re.sub(r"\\mu\b", "friction coefficient (μ)", s)
    s = re.sub(r"F\{\\text\{fr\}\}|F_\{?\\text\{fr\}\}?|F_?fr\b", "friction force", s, flags=re.IGNORECASE)

    # Loop to unwrap nested text, boxed, and fractions
    for _ in range(4):
        s = re.sub(r"\\text\{([^{}]*)\}", r"\1", s)
        s = re.sub(r"\\boxed\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", r"\1", s)
        s = re.sub(r"\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", r"(\1 / \2)", s)
        s = re.sub(r"\{([^{}]+)\}", r"\1", s)

    # Clean stray LaTeX keywords, backslashes, spacing, and math fences
    s = re.sub(r"\\(?:quad|qquad|,|;|!|\s)", " ", s)
    s = re.sub(r"\$\$|\$|\\\[|\\\]|\\\(|\\\)", " ", s)
    s = re.sub(r"\\(?:boxed|text)\b", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _build_prompt(
    student_text: str,
    reference_text: str,
    subject: str,
    grade: str,
    board: str,
) -> str:
    clean_ref = _clean_math_for_oral_eval(reference_text)
    return (
        f"REFERENCE / IDEAL CONCEPT:\n\"\"\"\n{clean_ref[:3000]}\n\"\"\"\n\n"
        f"STUDENT'S SPOKEN ANSWER:\n\"\"\"\n{student_text[:2000]}\n\"\"\"\n\n"
        f"Context: Subject={subject or 'General'}, Grade={grade or 'School'}, Board={board or 'Curriculum'}.\n\n"
        "EVALUATE the student's conceptual grasp and return this exact JSON schema:\n"
        "{\n"
        '  "accuracy_score": <0-100 integer>,\n'
        '  "grade_label": "Mastered" | "Great Job" | "Good Effort" | "Needs Practice",\n'
        '  "key_points_covered": ["concept 1", "concept 2", ...],\n'
        '  "key_points_missing": ["concept 1", ...],\n'
        '  "matched_keywords": ["important_term1", "important_term2", ...],\n'
        '  "tutor_tip": "1 quick memorable tip or memory hook to easily remember the missing points",\n'
        '  "feedback_speech": "2-3 sentences of warm spoken feedback (no markdown, no asterisks, friendly conversational tone)",\n'
        '  "feedback_markdown": "### structured markdown feedback with bullet points"\n'
        "}\n\n"
        "Rules:\n"
        "- Score 90-100 if student covered all core concepts accurately in their own words\n"
        "- Score 70-89 if most concepts covered with minor omissions\n"
        "- Score 50-69 if partial conceptual coverage with gaps\n"
        "- Score below 50 if most core concepts missing\n"
        "- DO NOT penalize missing numerical formulas or calculations; assess physical/scientific understanding\n"
        "- matched_keywords: list 3-8 key scientific/academic terms the student successfully used\n"
        "- tutor_tip: provide a clear, encouraging memory trick or mnemonic for what was missed\n"
        "- feedback_speech must be warm and conversational for text-to-speech audio\n"
        "- Be encouraging and motivating for school students"
    )


def _fallback_heuristic(student_text: str, reference_text: str) -> dict:
    """Simple keyword-overlap fallback when the LLM call fails."""
    ref_words = set(re.findall(r"\b\w{4,}\b", reference_text.lower()))
    stu_words = set(re.findall(r"\b\w{4,}\b", student_text.lower()))
    # Remove common stop words
    stop = {"this", "that", "with", "from", "have", "been", "were", "they", "their",
            "will", "would", "could", "should", "about", "which", "when", "what",
            "there", "these", "those", "also", "each", "other", "such", "than",
            "into", "some", "only", "very", "just", "more", "most", "does"}
    ref_words -= stop
    stu_words -= stop

    matched = list(ref_words & stu_words)[:6]
    missed = list(ref_words - stu_words)[:4]
    total = max(1, len(matched) + len(missed))
    score = min(100, int(len(matched) / total * 100))

    if score >= 90:
        label = "Mastered"
    elif score >= 75:
        label = "Great Job"
    elif score >= 50:
        label = "Good Effort"
    else:
        label = "Needs Practice"

    return {
        "accuracy_score": score,
        "grade_label": label,
        "key_points_covered": [w.title() for w in matched] or ["Basic recitation attempt"],
        "key_points_missing": [w.title() for w in missed] or ["Review complete definition"],
        "matched_keywords": [w.lower() for w in matched],
        "tutor_tip": f"Try connecting {matched[0].title() if matched else 'the key ideas'} with the missing concepts on your next try!" if missed else "You have mastered all the main keywords! Keep up the momentum!",
        "feedback_speech": (
            f"You scored {score} percent. "
            f"You included {len(matched)} important terms. "
            "Keep practicing to cover all the key points!"
        ),
        "feedback_markdown": (
            f"### 🎙️ Recitation Check\n"
            f"- **Score**: {score}%\n"
            f"- **Matched**: {', '.join(w.title() for w in matched) or 'None'}\n"
            f"- **Review**: {', '.join(w.title() for w in missed) or 'All covered'}"
        ),
    }


async def evaluate_oral(
    student_text: str,
    reference_text: str,
    subject: str = "",
    grade: str = "",
    board: str = "",
) -> dict:
    """Evaluate student's spoken answer against reference using Gemini AI.

    Returns a dict with: accuracy_score, grade_label, key_points_covered,
    key_points_missing, matched_keywords, tutor_tip, feedback_speech, feedback_markdown.
    Falls back to heuristic keyword matching if Gemini fails.
    """
    if not student_text.strip():
        return {
            "accuracy_score": 0,
            "grade_label": "No Speech Detected",
            "key_points_covered": [],
            "key_points_missing": ["Please speak your answer aloud."],
            "matched_keywords": [],
            "tutor_tip": "Click the microphone and speak your answer out loud.",
            "feedback_speech": (
                "I didn't hear anything. Please click the microphone "
                "and recite your answer clearly!"
            ),
            "feedback_markdown": "⚠️ **No speech detected.** Please check your microphone and try again.",
        }

    settings = get_settings()
    keys = settings.gemini_api_keys
    if not keys:
        logger.warning("No Gemini API key — using heuristic oral evaluation")
        return _fallback_heuristic(student_text, reference_text)

    prompt = _build_prompt(student_text, reference_text, subject, grade, board)

    for k in keys:
        try:
            client = genai.Client(api_key=k)
            response = await client.aio.models.generate_content(
                model=GEMINI_FLASH,
                contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
                config=types.GenerateContentConfig(
                    system_instruction=_EVAL_SYSTEM,
                    temperature=0.3,  # Low temperature for consistent evaluation
                ),
            )
            raw = response.text or ""
            if raw:
                m = re.search(r"\{[\s\S]*\}", raw)
                if m:
                    result = json.loads(m.group(0))
                    score = max(0, min(100, int(result.get("accuracy_score", 50))))
                    return {
                        "accuracy_score": score,
                        "grade_label": result.get("grade_label", "Good Effort"),
                        "key_points_covered": result.get("key_points_covered", [])[:6],
                        "key_points_missing": result.get("key_points_missing", [])[:4],
                        "matched_keywords": result.get("matched_keywords", [])[:10],
                        "tutor_tip": result.get("tutor_tip", "Remember the core definition and its real-world effect!"),
                        "feedback_speech": result.get("feedback_speech", "Good effort! Keep practicing."),
                        "feedback_markdown": result.get("feedback_markdown", "### Assessment Complete\nGood attempt."),
                    }
        except Exception as e:
            logger.warning(f"Oral eval failed on Gemini key ending in ...{k[-6:] if len(k) >= 6 else k}: {e}")
            continue

    return _fallback_heuristic(student_text, reference_text)
