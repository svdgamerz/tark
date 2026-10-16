"""FastAPI router for Concept Mastery Graph & Skill Tree."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.mastery.graph import build_mastery_graph

router = APIRouter(prefix="/api/mastery", tags=["mastery"])


@router.get("/graph")
def api_get_mastery_graph(
    user_key: str = Query(default="guest", description="User identifier"),
    subject: Optional[str] = Query(default="All", description="Subject filter: All, Physics, Chemistry, Mathematics, Biology"),
    grade: Optional[str] = Query(default="All", description="Class/Grade filter: All, 10, 11, 12"),
):
    """Retrieve full STEM curriculum concept DAG nodes and edges with learner mastery states."""
    try:
        return build_mastery_graph(
            user_key=user_key,
            subject_filter=subject,
            grade_filter=grade,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
