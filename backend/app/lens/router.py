"""FastAPI router for Tark Lens mechanistic interpretability and activation steering."""

from __future__ import annotations

import math
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/lens", tags=["lens"])


class SteerRequest(BaseModel):
    prompt: str = Field(..., description="Student input to analyze with Logit Lens")
    anti_sycophancy: float = Field(default=1.5, ge=0.0, le=5.0)
    math_rigor: float = Field(default=1.0, ge=0.0, le=5.0)
    socratic: float = Field(default=1.0, ge=0.0, le=5.0)


@router.post("/analyze")
def analyze_prompt(req: SteerRequest) -> dict[str, Any]:
    # Simulates 12-layer residual stream logit lens projection
    vocab = ["Conservation", "Kinetic", "Newton", "Entropy", "Momentum", "Equilibrium"]
    layers = []

    # Model confidence in truth increases with layer depth and anti-sycophancy steering
    for l in range(12):
        prog = l / 11.0
        entropy = max(0.18, 3.4 * (1.0 - prog * 0.88))
        prob = min(0.98, 0.2 + prog * 0.75)
        truth = min(0.99, max(0.05, (prog * 0.75) + (req.anti_sycophancy * 0.12)))

        layers.append({
            "layer": l,
            "top_token": vocab[1 if l > 6 else (2 if l > 3 else 0)],
            "probability": round(prob, 4),
            "entropy": round(entropy, 4),
            "truth_confidence": round(truth, 4),
        })

    is_sycophancy_risk = any(word in req.prompt.lower() for word in ["right?", "isn't it?", "agree?", "5, right"])

    return {
        "prompt": req.prompt,
        "anti_sycophancy_multiplier": req.anti_sycophancy,
        "math_rigor_multiplier": req.math_rigor,
        "socratic_multiplier": req.socratic,
        "sycophancy_risk_detected": is_sycophancy_risk,
        "truth_confidence_final": layers[-1]["truth_confidence"],
        "layers": layers,
    }
