"""FastAPI router for Computer Algebra System (CAS) operations."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.cas.solver import differentiate, solve, is_rust_cas_accelerated

router = APIRouter(prefix="/api/cas", tags=["cas"])


class DiffRequest(BaseModel):
    expr: str = Field(..., description="Algebraic expression to differentiate, e.g. 'x^3 + sin(x)'")
    var: str = Field(default="x", description="Independent variable")


class SolveRequest(BaseModel):
    equation: str = Field(..., description="Equation to solve, e.g. 'x^2 - 5x + 6 = 0' or '2x + 10 = 0'")
    var: str = Field(default="x", description="Variable to solve for")


@router.get("/status")
def cas_status():
    return {
        "status": "online",
        "rust_accelerated": is_rust_cas_accelerated(),
    }


@router.post("/diff")
def cas_diff(req: DiffRequest):
    try:
        return differentiate(req.expr, req.var)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/solve")
def cas_solve(req: SolveRequest):
    try:
        return solve(req.equation, req.var)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
