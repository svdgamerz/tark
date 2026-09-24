"""FastAPI router for High-Throughput Exam & Homework Grading."""

from __future__ import annotations

import time
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/grader", tags=["grader"])


class SubmissionItem(BaseModel):
    student_id: str
    question_id: str
    student_answer: str
    expected_answer: str
    question_type: str = Field(default="exact", description="'numeric', 'symbolic', or 'exact'")
    tolerance: float = 0.01


class BatchGradeRequest(BaseModel):
    submissions: list[SubmissionItem]


@router.post("/batch")
def grade_batch(req: BatchGradeRequest) -> dict[str, Any]:
    t0 = time.perf_counter()
    results = []
    passed = 0

    for sub in req.submissions:
        qtype = sub.question_type.lower()
        is_correct = False
        feedback = ""

        if qtype == "numeric":
            try:
                s_val = float(sub.student_answer.strip())
                e_val = float(sub.expected_answer.strip())
                diff = abs(s_val - e_val)
                rel_diff = diff / abs(e_val) if abs(e_val) > 1e-12 else diff
                tol = sub.tolerance
                if diff <= tol or rel_diff <= tol:
                    is_correct = True
                    feedback = f"Correct within tolerance ({tol})"
                else:
                    feedback = f"Incorrect: got {s_val}, expected {e_val}"
            except Exception:
                feedback = "Failed to parse numeric value"
        elif qtype == "symbolic":
            # Normalized symbolic check
            s_norm = sub.student_answer.replace(" ", "").lower()
            e_norm = sub.expected_answer.replace(" ", "").lower()
            is_correct = (s_norm == e_norm)
            feedback = "Correct symbolic match" if is_correct else f"Incorrect: expected '{sub.expected_answer}'"
        else:
            is_correct = (sub.student_answer.strip().lower() == sub.expected_answer.strip().lower())
            feedback = "Exact match" if is_correct else "Mismatch"

        if is_correct:
            passed += 1

        results.append({
            "student_id": sub.student_id,
            "question_id": sub.question_id,
            "is_correct": is_correct,
            "score": 1.0 if is_correct else 0.0,
            "feedback": feedback,
        })

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    total = len(req.submissions)
    pass_rate = (passed / total * 100.0) if total > 0 else 100.0

    return {
        "total_submissions": total,
        "passed_count": passed,
        "pass_rate": pass_rate,
        "elapsed_ms": elapsed_ms,
        "results": results,
    }
