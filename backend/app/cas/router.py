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
    calculate_riemann_sum,
    calculate_taylor_series,
    calculate_surface_3d,
    calculate_electric_field,
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


class RiemannRequest(BaseModel):
    expr: str = Field(default="x^2", description="Function f(x)")
    var: str = Field(default="x", description="Variable")
    a: float = Field(default=0.0, description="Lower integration bound")
    b: float = Field(default=4.0, description="Upper integration bound")
    n: int = Field(default=10, description="Number of rectangle partitions")
    method: str = Field(default="midpoint", description="Partition type: left, right, midpoint, trapezoid")


class TaylorRequest(BaseModel):
    expr: str = Field(default="sin(x)", description="Function f(x)")
    var: str = Field(default="x", description="Variable")
    x0: float = Field(default=0.0, description="Expansion center point")
    order: int = Field(default=5, description="Polynomial degree n")
    x_min: float = Field(default=-4.0, description="Minimum x bound")
    x_max: float = Field(default=4.0, description="Maximum x bound")


class Surface3DRequest(BaseModel):
    expr: str = Field(default="sin(sqrt(x^2 + y^2) - t)", description="3D function z = f(x, y, t)")
    x_min: float = Field(default=-3.0, description="Min x")
    x_max: float = Field(default=3.0, description="Max x")
    y_min: float = Field(default=-3.0, description="Min y")
    y_max: float = Field(default=3.0, description="Max y")
    resolution: int = Field(default=25, description="Grid resolution")
    t: float = Field(default=0.0, description="Time parameter for animation")


class ElectricFieldRequest(BaseModel):
    charges: list[dict[str, float]] = Field(
        default=[{"x": -1.5, "y": 0.0, "q": 1.0}, {"x": 1.5, "y": 0.0, "q": -1.0}],
        description="Array of point charges with x, y, and q"
    )
    x_min: float = Field(default=-4.0, description="Min x")
    x_max: float = Field(default=4.0, description="Max x")
    y_min: float = Field(default=-4.0, description="Min y")
    y_max: float = Field(default=4.0, description="Max y")
    grid_size: int = Field(default=15, description="Grid resolution")


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


@router.post("/riemann_sum")
def cas_riemann_sum(req: RiemannRequest):
    try:
        return calculate_riemann_sum(
            expr_str=req.expr,
            var=req.var,
            a=req.a,
            b=req.b,
            n=req.n,
            method=req.method,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/taylor")
def cas_taylor(req: TaylorRequest):
    try:
        return calculate_taylor_series(
            expr_str=req.expr,
            var=req.var,
            x0=req.x0,
            order=req.order,
            x_min=req.x_min,
            x_max=req.x_max,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/surface_3d")
def cas_surface_3d(req: Surface3DRequest):
    try:
        return calculate_surface_3d(
            expr_str=req.expr,
            x_min=req.x_min,
            x_max=req.x_max,
            y_min=req.y_min,
            y_max=req.y_max,
            resolution=req.resolution,
            t_val=req.t,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/electric_field")
def cas_electric_field(req: ElectricFieldRequest):
    try:
        return calculate_electric_field(
            charges=req.charges,
            x_min=req.x_min,
            x_max=req.x_max,
            y_min=req.y_min,
            y_max=req.y_max,
            grid_size=req.grid_size,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

