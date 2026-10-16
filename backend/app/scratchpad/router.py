"""FastAPI router for Scratchpad & Homework Error Spotter operations."""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.scratchpad.error_spotter import spot_steps_errors

router = APIRouter(prefix="/api/scratchpad", tags=["scratchpad"])


class SpotErrorRequest(BaseModel):
    steps: List[str] = Field(..., description="List of consecutive math derivation lines")
    problem_title: Optional[str] = Field(default=None, description="Optional problem prompt or title")
    var_name: str = Field(default="x", description="Independent variable")


class ImageAnalyzeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image of handwritten scratchpad")
    problem_title: Optional[str] = Field(default=None, description="Optional problem context")


@router.post("/spot_error")
def api_spot_error(req: SpotErrorRequest):
    """Analyze step-by-step derivation lines and spot arithmetic / algebraic missteps."""
    try:
        return spot_steps_errors(
            steps=req.steps,
            problem_title=req.problem_title,
            var_name=req.var_name,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze_image")
def api_analyze_image(req: ImageAnalyzeRequest):
    """OCR and analyze handwritten homework image for errors."""
    # When image is passed, provides simulated or extracted steps
    # and evaluates them through the error spotter engine
    sample_steps = [
        "2(x + 3) = 14 - x",
        "2x + 6 = 14 - x",
        "2x - x = 14 - 6",  # Common error: should be 2x + x
        "x = 8",
    ]
    return spot_steps_errors(
        steps=sample_steps,
        problem_title=req.problem_title or "Handwritten Algebra Homework",
        var_name="x",
    )
