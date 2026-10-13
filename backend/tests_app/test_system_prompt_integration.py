"""Verify system prompt generation for technical vs academic queries."""
import asyncio
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.modes.teacher import TEACHER_SYSTEM_PROMPT
from app.router.prompt_engineer import _is_academic_query
from app.config.models import get_model


def test_technical_query_prompt():
    query = "how to install mongodb"
    ctx = {"board": "CBSE", "grade": "10", "exam": "CBSE 10th", "tutoring_style": "step_by_step"}
    
    is_academic = _is_academic_query(query, ctx)
    assert not is_academic, f"Expected non-academic, got {is_academic}"

    # Build prompt as main.py does
    system_prompt = TEACHER_SYSTEM_PROMPT
    spec_check = get_model("acharya")
    has_curriculum = bool(ctx.get("board") or ctx.get("grade") or ctx.get("exam"))

    if spec_check.id == "acharya" and has_curriculum and is_academic:
        system_prompt += "\n\nACHARYA ACADEMIC MODE"

    profile_instructions = []
    if ctx.get("exam") and is_academic:
        profile_instructions.append(f"• Target Exam / Milestone: {ctx['exam']}")
    if ctx.get("tutoring_style"):
        profile_instructions.append("• Tutoring Style: Step-by-Step Teacher (1. 2. 3.)")
    if profile_instructions:
        system_prompt += "\n\nSTUDENT PERSONALIZATION & PROFILE DIRECTIVES:\n" + "\n".join(profile_instructions)

    # Assertions
    assert "Exam Trap" not in system_prompt
    assert "Quick Intuition Check" not in system_prompt
    assert "ACHARYA ACADEMIC MODE" not in system_prompt
    assert "Target Exam" not in system_prompt
    assert "BAN ON RAW BULLET-POINT DUMPS" in system_prompt
    assert "ENGAGING DIRECT LEAD" in system_prompt
    print("✅ test_technical_query_prompt PASSED")


def test_academic_query_prompt():
    query = "explain newtons third law"
    ctx = {"board": "CBSE", "grade": "10", "exam": "CBSE 10th", "tutoring_style": "step_by_step"}
    
    is_academic = _is_academic_query(query, ctx)
    assert is_academic, f"Expected academic, got {is_academic}"

    # Build prompt as main.py does
    system_prompt = TEACHER_SYSTEM_PROMPT
    spec_check = get_model("acharya")
    has_curriculum = bool(ctx.get("board") or ctx.get("grade") or ctx.get("exam"))

    if spec_check.id == "acharya" and has_curriculum and is_academic:
        system_prompt += "\n\nACHARYA ACADEMIC MODE"

    profile_instructions = []
    if ctx.get("exam") and is_academic:
        profile_instructions.append(f"• Target Exam / Milestone: {ctx['exam']}")
    if profile_instructions:
        system_prompt += "\n\nSTUDENT PERSONALIZATION & PROFILE DIRECTIVES:\n" + "\n".join(profile_instructions)

    # Assertions
    assert "Exam Trap" not in system_prompt
    assert "ACHARYA ACADEMIC MODE" in system_prompt
    assert "Target Exam / Milestone: CBSE 10th" in system_prompt
    print("✅ test_academic_query_prompt PASSED")


if __name__ == "__main__":
    test_technical_query_prompt()
    test_academic_query_prompt()
    print("\nAll integration prompt tests passed!")
