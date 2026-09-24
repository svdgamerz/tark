"""Teaching-mode registry. Each mode is a system-prompt constant (CLAUDE.md §8).

Prompts are never inlined in handlers — they live here as named constants and are
looked up by mode name. Add a mode = add a file + one entry in MODES.
"""
from __future__ import annotations

from app.modes.socratic import SOCRATIC_SYSTEM_PROMPT
from app.modes.teacher import TEACHER_SYSTEM_PROMPT

MODES: dict[str, str] = {
    "teacher": TEACHER_SYSTEM_PROMPT,
    "socratic": SOCRATIC_SYSTEM_PROMPT,
}


def get_mode_prompt(mode: str) -> str:
    try:
        return MODES[mode]
    except KeyError:
        raise ValueError(
            f"Unknown mode '{mode}'. Available: {', '.join(MODES)}"
        ) from None
