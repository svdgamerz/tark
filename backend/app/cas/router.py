"""FastAPI router for Computer Algebra System (CAS) operations."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.cas.solver import (
    differentiate,
    solve,
    simplify,
    get_function_graph_data,
    is_rust_cas_accelerated,
)

router = APIRouter(prefix="/api/cas", tags=["cas"])


class DiffRequest(BaseModel):
    expr: str = Field(..., description="Algebraic expression to differentiate, e.g. 'x^3 + sin(x)'")
    var: str = Field(default="x", description="Independent variable")
    eval_x: Optional[float] = Field(default=1.0, description="Evaluation point for tangent line slope")


class SolveRequest(BaseModel):
    equation: str = Field(..., description="Equation to solve, e.g. 'x^2 - 5x + 6 = 0' or '2x + 10 = 0'")
    var: str = Field(default="x", description="Variable to solve for")


class StepByStepRequest(BaseModel):
    input_str: str = Field(..., description="Mathematical expression or equation to solve step-by-step")
    var: str = Field(default="x", description="Variable of interest")
    eval_x: Optional[float] = Field(default=1.0, description="Optional evaluation point for tangent analysis")


class GraphDataRequest(BaseModel):
    expr: str = Field(..., description="Mathematical function to plot")
    var: str = Field(default="x", description="Independent variable")
    x_min: float = Field(default=-10.0, description="Minimum x bound")
    x_max: float = Field(default=10.0, description="Maximum x bound")
    eval_x: float = Field(default=1.0, description="Evaluation point for tangent line")


@router.get("/status")
def cas_status():
    return {
        "status": "online",
        "rust_accelerated": is_rust_cas_accelerated(),
    }


@router.post("/diff")
def cas_diff(req: DiffRequest):
    try:
        return differentiate(req.expr, req.var, req.eval_x)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/solve")
def cas_solve(req: SolveRequest):
    try:
        return solve(req.equation, req.var)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/step_by_step")
def cas_step_by_step(req: StepByStepRequest):
    try:
        if "=" in req.input_str:
            return {
                "type": "equation_solution",
                **solve(req.input_str, req.var)
            }
        else:
            return {
                "type": "calculus_derivative",
                **differentiate(req.input_str, req.var, req.eval_x)
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/graph_data")
def cas_graph_data(req: GraphDataRequest):
    try:
        return get_function_graph_data(
            expr_str=req.expr,
            var=req.var,
            x_min=req.x_min,
            x_max=req.x_max,
            eval_x=req.eval_x,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
