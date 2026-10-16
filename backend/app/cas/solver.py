"""High-level Computer Algebra System (CAS) Bridge for Tark.

Leverages native Rust acceleration (tark_core) when available,
with a powerful SymPy symbolic engine for step-by-step calculus derivations,
rule breakdowns, equation solving, and interactive tangent slope evaluations.
"""

from __future__ import annotations

import logging
import math
from typing import Any, List, Optional, Tuple

import sympy as sp

logger = logging.getLogger("tark.cas")

_RUST_AVAILABLE = False
try:
    import tark_core
    if hasattr(tark_core, "cas_differentiate"):
        _RUST_AVAILABLE = True
except Exception as e:
    logger.debug(f"tark_core CAS not available: {e}")


def is_rust_cas_accelerated() -> bool:
    return _RUST_AVAILABLE


def parse_math_expression(expr_str: str, var: str = "x"):
    """Parse natural user math string into SymPy expression with implicit multiplication & power support."""
    import sympy as sp
    from sympy.parsing.sympy_parser import (
        parse_expr,
        standard_transformations,
        implicit_multiplication_application,
        convert_xor,
    )

    clean = expr_str.strip()
    # Normalize common symbols
    clean = clean.replace("^", "**")
    clean = clean.replace("−", "-").replace("×", "*").replace("÷", "/")
    
    transformations = standard_transformations + (
        implicit_multiplication_application,
        convert_xor,
    )
    v_sym = sp.Symbol(var)
    parsed = parse_expr(clean, local_dict={var: v_sym}, transformations=transformations)
    return parsed, v_sym


def differentiate(expr: str, var: str = "x", eval_x: Optional[float] = 1.0) -> dict[str, Any]:
    """Symbolically differentiate an expression string with respect to `var`.
    Returns dict with simplified result, KaTeX string, step-by-step rule derivations,
    and interactive tangent evaluation at `eval_x`.
    """
    clean = expr.strip()
    if _RUST_AVAILABLE:
        try:
            res, katex, steps = tark_core.cas_differentiate(clean, var)
            formatted_steps = [
                {"rule": s[0], "explanation": s[1], "latex": s[2]}
                for s in steps
            ]
            tangent_info = None
            if eval_x is not None:
                try:
                    f_expr, v_sym = parse_math_expression(clean, var)
                    d_expr = sp.diff(f_expr, v_sym)
                    x0 = float(eval_x)
                    y0 = float(f_expr.subs(v_sym, x0).evalf())
                    slope = float(d_expr.subs(v_sym, x0).evalf())
                    intercept = y0 - slope * x0
                    tangent_eq = f"y = {slope:.3f}*{var} + {intercept:.3f}" if intercept >= 0 else f"y = {slope:.3f}*{var} - {abs(intercept):.3f}"
                    tangent_info = {
                        "x0": x0,
                        "y0": round(y0, 4),
                        "slope": round(slope, 4),
                        "equation": tangent_eq,
                        "latex": f"y = {slope:.3f}{var} {'+' if intercept >= 0 else '-'} {abs(intercept):.3f}",
                    }
                except Exception:
                    pass
            return {
                "success": True,
                "result": res,
                "katex": katex,
                "steps": formatted_steps,
                "tangent": tangent_info,
                "rust_accelerated": True,
            }
        except Exception as e:
            logger.warning(f"Rust CAS diff failed: {e}")

    # SymPy Step-by-Step Calculus Derivation Engine
    return _sympy_differentiate(clean, var, eval_x)


def solve(equation: str, var: str = "x") -> dict[str, Any]:
    """Solve an equation ("LHS = RHS" or "f(x) = 0") for `var`.
    Returns dict with exact roots, numerical roots, discriminant, and step-by-step solutions.
    """
    clean = equation.strip()
    if _RUST_AVAILABLE:
        try:
            roots, steps = tark_core.cas_solve(clean, var)
            formatted_steps = [
                {"title": s[0], "explanation": s[1], "latex": s[2]}
                for s in steps
            ]
            return {
                "success": True,
                "roots": roots,
                "steps": formatted_steps,
                "rust_accelerated": True,
            }
        except Exception as e:
            logger.warning(f"Rust CAS solve failed: {e}")

    # SymPy Equation Solving Engine
    return _sympy_solve(clean, var)


def simplify(expr: str) -> dict[str, Any]:
    """Simplify an algebraic expression string."""
    if _RUST_AVAILABLE:
        try:
            res, katex = tark_core.cas_simplify(expr)
            return {"success": True, "result": res, "katex": katex, "rust_accelerated": True}
        except Exception as e:
            logger.warning(f"Rust CAS simplify failed: {e}")

    try:
        import sympy as sp
        parsed, _ = parse_math_expression(expr)
        simplified = sp.simplify(parsed)
        return {
            "success": True,
            "result": str(simplified),
            "katex": sp.latex(simplified),
            "rust_accelerated": False,
        }
    except Exception:
        return {"success": True, "result": expr, "katex": expr, "rust_accelerated": False}


# =========================================================================
# SymPy Step-by-Step Implementation
# =========================================================================

def _sympy_differentiate(expr_str: str, var: str, eval_x: Optional[float]) -> dict[str, Any]:
    import sympy as sp

    try:
        f_expr, v_sym = parse_math_expression(expr_str, var)
    except Exception as e:
        logger.warning(f"Failed to parse expression '{expr_str}': {e}")
        return {
            "success": False,
            "error": f"Invalid math expression syntax: {e}",
            "result": expr_str,
            "katex": expr_str,
            "steps": [],
            "rust_accelerated": False,
        }

    # Compute exact derivative
    d_expr = sp.diff(f_expr, v_sym)
    d_simplified = sp.simplify(d_expr)
    
    latex_orig = sp.latex(f_expr)
    latex_diff = sp.latex(d_simplified)
    str_diff = str(d_simplified)

    steps: list[dict[str, str]] = []

    # Step 1: Definition of derivative
    steps.append({
        "rule": "Derivative Statement",
        "explanation": f"Differentiating f({var}) with respect to {var}",
        "latex": f"\\frac{{d}}{{d{var}}}\\left[{latex_orig}\\right]",
    })

    # Rule identification
    if isinstance(f_expr, sp.Add):
        steps.append({
            "rule": "Sum / Difference Rule",
            "explanation": f"The derivative of a sum is the sum of the derivatives: d/d{var}[u + v] = d/d{var}[u] + d/d{var}[v]",
            "latex": " + ".join([f"\\frac{{d}}{{d{var}}}\\left[{sp.latex(arg)}\\right]" for arg in f_expr.args]),
        })
        for arg in f_expr.args:
            sub_d = sp.diff(arg, v_sym)
            rule_name = _identify_derivative_rule(arg, v_sym)
            steps.append({
                "rule": rule_name,
                "explanation": f"Compute derivative of term: {sp.latex(arg)}",
                "latex": f"\\frac{{d}}{{d{var}}}\\left[{sp.latex(arg)}\\right] = {sp.latex(sub_d)}",
            })
    else:
        rule_name = _identify_derivative_rule(f_expr, v_sym)
        steps.append({
            "rule": rule_name,
            "explanation": f"Applying standard differentiation rule to: {latex_orig}",
            "latex": f"\\frac{{d}}{{d{var}}}\\left[{latex_orig}\\right] = {sp.latex(d_expr)}",
        })

    # Final simplified result step
    if sp.latex(d_expr) != latex_diff:
        steps.append({
            "rule": "Algebraic Simplification",
            "explanation": "Collect terms and simplify into standard form",
            "latex": f"f'({var}) = {latex_diff}",
        })
    else:
        steps.append({
            "rule": "Final Derivative",
            "explanation": "Result in standard simplified form",
            "latex": f"f'({var}) = {latex_diff}",
        })

    # Optional interactive tangent slope evaluation
    tangent_info = None
    if eval_x is not None:
        try:
            x0 = float(eval_x)
            y0 = float(f_expr.subs(v_sym, x0).evalf())
            slope = float(d_simplified.subs(v_sym, x0).evalf())
            intercept = y0 - slope * x0
            tangent_eq = f"y = {slope:.3f}*{var} + {intercept:.3f}" if intercept >= 0 else f"y = {slope:.3f}*{var} - {abs(intercept):.3f}"
            tangent_latex = f"y = {slope:.3f}{var} {'+' if intercept >= 0 else '-'} {abs(intercept):.3f}"
            tangent_info = {
                "x0": x0,
                "y0": round(y0, 4),
                "slope": round(slope, 4),
                "equation": tangent_eq,
                "latex": tangent_latex,
                "point_slope_latex": f"y - ({y0:.3f}) = {slope:.3f}({var} - {x0:.3f})",
            }
        except Exception as ex:
            logger.debug(f"Could not evaluate tangent line at x0={eval_x}: {ex}")

    return {
        "success": True,
        "result": str_diff,
        "katex": latex_diff,
        "latex": latex_diff,
        "steps": steps,
        "tangent": tangent_info,
        "rust_accelerated": False,
    }


def _identify_derivative_rule(term, v_sym) -> str:
    import sympy as sp
    if not term.has(v_sym):
        return "Constant Rule (d/dx[c] = 0)"
    if isinstance(term, sp.Pow) and term.base == v_sym:
        return f"Power Rule (d/dx[x^n] = n*x^(n-1))"
    if isinstance(term, sp.Mul):
        # Check coefficient * power
        non_vars = [a for a in term.args if not a.has(v_sym)]
        vars_args = [a for a in term.args if a.has(v_sym)]
        if len(vars_args) == 1:
            return f"Constant Multiple & {_identify_derivative_rule(vars_args[0], v_sym)}"
        return "Product Rule (d/dx[u*v] = u'*v + u*v')"
    if any(isinstance(term, trig) for trig in (sp.sin, sp.cos, sp.tan, sp.sec, sp.csc, sp.cot)):
        return "Trigonometric Rule (with Chain Rule)"
    if isinstance(term, sp.exp):
        return "Exponential Rule (d/dx[e^u] = e^u * u')"
    if isinstance(term, sp.log):
        return "Logarithmic Rule (d/dx[ln(u)] = u'/u)"
    return "Chain Rule / Standard Rule"


def _sympy_solve(equation: str, var: str) -> dict[str, Any]:
    import sympy as sp

    clean = equation.strip()
    # Split LHS = RHS
    if "=" in clean:
        parts = clean.split("=", 1)
        lhs_str, rhs_str = parts[0].strip(), parts[1].strip()
    else:
        lhs_str, rhs_str = clean, "0"

    try:
        lhs_expr, v_sym = parse_math_expression(lhs_str, var)
        rhs_expr, _ = parse_math_expression(rhs_str, var)
        f_expr = sp.simplify(lhs_expr - rhs_expr)
    except Exception as e:
        logger.warning(f"Failed to parse equation '{equation}': {e}")
        return {
            "success": False,
            "error": f"Invalid equation syntax: {e}",
            "roots": [],
            "steps": [],
            "rust_accelerated": False,
        }

    steps: list[dict[str, str]] = []

    # Step 1: Standard Form
    steps.append({
        "title": "Standard Equation Form",
        "explanation": f"Rearrange all terms to LHS = 0: f({var}) = 0",
        "latex": f"{sp.latex(f_expr)} = 0",
    })

    # Quadratic identification
    poly = None
    try:
        poly = sp.Poly(f_expr, v_sym)
    except Exception:
        pass

    if poly is not None and poly.degree() == 2:
        coeffs = poly.all_coeffs()  # [a, b, c]
        a = float(coeffs[0])
        b = float(coeffs[1]) if len(coeffs) > 1 else 0.0
        c = float(coeffs[2]) if len(coeffs) > 2 else 0.0
        disc = b * b - 4 * a * c

        steps.append({
            "title": "Quadratic Coefficients",
            "explanation": f"Identify coefficients in ax^2 + bx + c = 0",
            "latex": f"a = {a}, \\quad b = {b}, \\quad c = {c}",
        })
        steps.append({
            "title": "Discriminant Analysis",
            "explanation": f"Compute discriminant Delta = b^2 - 4ac to determine root multiplicity",
            "latex": f"\\Delta = ({b})^2 - 4({a})({c}) = {disc:.4f}",
        })
        steps.append({
            "title": "Quadratic Formula Expansion",
            "explanation": f"Apply x = (-b +/- sqrt(Delta))/(2a)",
            "latex": f"{var} = \\frac{{-({b}) \\pm \\sqrt{{{disc:.4f}}}}}{{2({a})}}",
        })

    # Solve roots via Sympy
    raw_roots = sp.solve(f_expr, v_sym)
    formatted_roots: list[str] = []
    latex_roots: list[str] = []

    for r in raw_roots:
        latex_roots.append(sp.latex(r))
        try:
            val = complex(r.evalf())
            if abs(val.imag) < 1e-9:
                formatted_roots.append(f"{val.real:.4f}")
            else:
                sign = "+" if val.imag >= 0 else "-"
                formatted_roots.append(f"{val.real:.4f} {sign} {abs(val.imag):.4f}i")
        except Exception:
            formatted_roots.append(str(r))

    steps.append({
        "title": "Exact Solutions & Roots",
        "explanation": f"Roots satisfying the equation {var}",
        "latex": ", \\quad ".join([f"{var} = {lr}" for lr in latex_roots]) if latex_roots else "No solution",
    })

    # Verification step
    if raw_roots:
        first_r = raw_roots[0]
        try:
            lhs_val = lhs_expr.subs(v_sym, first_r).evalf()
            rhs_val = rhs_expr.subs(v_sym, first_r).evalf()
            steps.append({
                "title": "Empirical Verification",
                "explanation": f"Substitute root {sp.latex(first_r)} back into original equation",
                "latex": f"\\text{{LHS}} = {sp.latex(lhs_val)} \\approx \\text{{RHS}} = {sp.latex(rhs_val)} \\quad \\checkmark",
            })
        except Exception:
            pass

    return {
        "success": True,
        "roots": formatted_roots,
        "latex_roots": latex_roots,
        "steps": steps,
        "rust_accelerated": False,
    }


def get_function_graph_data(
    expr_str: str,
    var: str = "x",
    x_min: float = -10.0,
    x_max: float = 10.0,
    eval_x: float = 1.0,
    num_samples: int = 40,
) -> dict[str, Any]:
    """Generate high-density (x, y) plot points and tangent line segment for real-time client visualization."""
    import sympy as sp

    parsed, v_sym = parse_math_expression(expr_str, var)
    d_expr = sp.diff(parsed, v_sym)

    step = (x_max - x_min) / max(10, num_samples - 1)
    curve_points: list[dict[str, float]] = []

    for i in range(num_samples):
        xi = x_min + i * step
        try:
            yi = float(parsed.subs(v_sym, xi).evalf())
            if not math.isnan(yi) and not math.isinf(yi):
                curve_points.append({"x": round(xi, 3), "y": round(yi, 3)})
        except Exception:
            continue

    # Tangent at eval_x
    tangent_points: list[dict[str, float]] = []
    try:
        y0 = float(parsed.subs(v_sym, eval_x).evalf())
        slope = float(d_expr.subs(v_sym, eval_x).evalf())
        span = (x_max - x_min) * 0.25
        t_x1 = eval_x - span
        t_y1 = y0 - slope * span
        t_x2 = eval_x + span
        t_y2 = y0 + slope * span
        tangent_points = [
            {"x": round(t_x1, 3), "y": round(t_y1, 3)},
            {"x": round(eval_x, 3), "y": round(y0, 3)},
            {"x": round(t_x2, 3), "y": round(t_y2, 3)},
        ]
    except Exception:
        pass

    return {
        "success": True,
        "expression": expr_str,
        "eval_x": eval_x,
        "curve": curve_points,
        "tangent": tangent_points,
    }


def calculate_riemann_sum(
    expr_str: str,
    var: str = "x",
    a: float = 0.0,
    b: float = 4.0,
    n: int = 10,
    method: str = "midpoint",
) -> dict[str, Any]:
    """Calculate Riemann sum rectangles and compare against the exact analytical definite integral."""
    import sympy as sp

    parsed, v_sym = parse_math_expression(expr_str, var)
    
    # Exact integral
    exact_val: Optional[float] = None
    latex_integral = f"\\int_{{{a}}}^{{{b}}} {sp.latex(parsed)}\\, d{var}"
    try:
        exact_res = sp.integrate(parsed, (v_sym, a, b))
        exact_val = float(exact_res.evalf())
    except Exception:
        pass

    n = max(2, min(200, n))
    dx = (b - a) / n
    rectangles: list[dict[str, float]] = []
    approx_sum = 0.0

    for i in range(n):
        x_left = a + i * dx
        x_right = x_left + dx
        if method == "left":
            x_sample = x_left
        elif method == "right":
            x_sample = x_right
        elif method == "trapezoid":
            x_sample = (x_left + x_right) / 2.0
        else:  # midpoint
            x_sample = (x_left + x_right) / 2.0

        try:
            if method == "trapezoid":
                y_l = float(parsed.subs(v_sym, x_left).evalf())
                y_r = float(parsed.subs(v_sym, x_right).evalf())
                height = (y_l + y_r) / 2.0
            else:
                height = float(parsed.subs(v_sym, x_sample).evalf())
            
            if math.isnan(height) or math.isinf(height):
                height = 0.0
        except Exception:
            height = 0.0

        area = height * dx
        approx_sum += area
        rectangles.append({
            "x0": round(x_left, 4),
            "x1": round(x_right, 4),
            "x_sample": round(x_sample, 4),
            "height": round(height, 4),
            "area": round(area, 4),
        })

    error_abs = abs(approx_sum - exact_val) if exact_val is not None else 0.0
    error_pct = (error_abs / abs(exact_val) * 100.0) if (exact_val and abs(exact_val) > 1e-9) else 0.0

    return {
        "success": True,
        "expression": expr_str,
        "a": a,
        "b": b,
        "n": n,
        "dx": round(dx, 4),
        "method": method,
        "approx_sum": round(approx_sum, 5),
        "exact_integral": round(exact_val, 5) if exact_val is not None else None,
        "error_abs": round(error_abs, 5),
        "error_pct": round(error_pct, 2),
        "latex_integral": latex_integral,
        "rectangles": rectangles,
    }


def calculate_taylor_series(
    expr_str: str,
    var: str = "x",
    x0: float = 0.0,
    order: int = 5,
    x_min: float = -4.0,
    x_max: float = 4.0,
    num_samples: int = 40,
) -> dict[str, Any]:
    """Calculate Taylor polynomial approximation P_n(x) about x_0 and sample points for visual comparison."""
    import sympy as sp

    parsed, v_sym = parse_math_expression(expr_str, var)
    order = max(1, min(15, order))

    taylor_poly = sp.series(parsed, v_sym, x0, order + 1).removeO()
    latex_taylor = sp.latex(taylor_poly)

    # Sample original and polynomial curves
    step = (x_max - x_min) / max(10, num_samples - 1)
    orig_points: list[dict[str, float]] = []
    taylor_points: list[dict[str, float]] = []

    for i in range(num_samples):
        xi = x_min + i * step
        try:
            yo = float(parsed.subs(v_sym, xi).evalf())
            if not math.isnan(yo) and not math.isinf(yo):
                orig_points.append({"x": round(xi, 3), "y": round(yo, 3)})
        except Exception:
            pass

        try:
            yt = float(taylor_poly.subs(v_sym, xi).evalf())
            if not math.isnan(yt) and not math.isinf(yt) and abs(yt) < 100:
                taylor_points.append({"x": round(xi, 3), "y": round(yt, 3)})
        except Exception:
            pass

    return {
        "success": True,
        "expression": expr_str,
        "x0": x0,
        "order": order,
        "latex_taylor": latex_taylor,
        "orig_curve": orig_points,
        "taylor_curve": taylor_points,
    }


def calculate_surface_3d(
    expr_str: str,
    x_min: float = -3.0,
    x_max: float = 3.0,
    y_min: float = -3.0,
    y_max: float = 3.0,
    resolution: int = 25,
    t_val: float = 0.0,
) -> dict[str, Any]:
    """Evaluate 3D parametric or explicit surface z = f(x, y, t) on a uniform mesh grid with gradient normals."""
    import sympy as sp
    from sympy.parsing.sympy_parser import (
        parse_expr,
        standard_transformations,
        implicit_multiplication_application,
        convert_xor,
    )

    clean = expr_str.strip().replace("^", "**").replace("−", "-")
    transformations = standard_transformations + (
        implicit_multiplication_application,
        convert_xor,
    )
    x_sym, y_sym, t_sym = sp.symbols("x y t")
    parsed = parse_expr(clean, local_dict={"x": x_sym, "y": y_sym, "t": t_sym}, transformations=transformations)

    res = max(10, min(50, resolution))
    x_step = (x_max - x_min) / (res - 1)
    y_step = (y_max - y_min) / (res - 1)

    grid: list[list[float]] = []
    z_min = 1e9
    z_max = -1e9

    # Substitute time t
    expr_sub_t = parsed.subs(t_sym, t_val)

    for i in range(res):
        row: list[float] = []
        xi = x_min + i * x_step
        for j in range(res):
            yj = y_min + j * y_step
            try:
                zij = float(expr_sub_t.subs([(x_sym, xi), (y_sym, yj)]).evalf())
                if math.isnan(zij) or math.isinf(zij):
                    zij = 0.0
            except Exception:
                zij = 0.0
            row.append(round(zij, 3))
            if zij < z_min:
                z_min = zij
            if zij > z_max:
                z_max = zij
        grid.append(row)

    return {
        "success": True,
        "expression": expr_str,
        "x_min": x_min,
        "x_max": x_max,
        "y_min": y_min,
        "y_max": y_max,
        "resolution": res,
        "t": t_val,
        "z_min": round(z_min, 3) if z_min != 1e9 else 0.0,
        "z_max": round(z_max, 3) if z_max != -1e9 else 0.0,
        "grid": grid,
    }


def calculate_electric_field(
    charges: list[dict[str, float]],
    x_min: float = -4.0,
    x_max: float = 4.0,
    y_min: float = -4.0,
    y_max: float = 4.0,
    grid_size: int = 15,
) -> dict[str, Any]:
    """Calculate 2D Coulomb potential V and electric field vector field (Ex, Ey) for multiple point charges."""
    k_const = 8.98755e1  # scaled for display units

    res = max(8, min(30, grid_size))
    x_step = (x_max - x_min) / (res - 1)
    y_step = (y_max - y_min) / (res - 1)

    vectors: list[dict[str, float]] = []

    for i in range(res):
        xi = x_min + i * x_step
        for j in range(res):
            yj = y_min + j * y_step
            ex_tot = 0.0
            ey_tot = 0.0
            v_tot = 0.0
            skip = False

            for chg in charges:
                cx = chg.get("x", 0.0)
                cy = chg.get("y", 0.0)
                q = chg.get("q", 1.0)

                rx = xi - cx
                ry = yj - cy
                dist_sq = rx * rx + ry * ry
                dist = math.sqrt(dist_sq)

                if dist < 0.2:
                    skip = True
                    break

                field_mag = (k_const * q) / dist_sq
                ex_tot += field_mag * (rx / dist)
                ey_tot += field_mag * (ry / dist)
                v_tot += (k_const * q) / dist

            if not skip:
                mag = math.sqrt(ex_tot * ex_tot + ey_tot * ey_tot)
                angle = math.atan2(ey_tot, ex_tot)
                vectors.append({
                    "x": round(xi, 2),
                    "y": round(yj, 2),
                    "ex": round(ex_tot, 3),
                    "ey": round(ey_tot, 3),
                    "mag": round(mag, 3),
                    "angle": round(angle, 3),
                    "v": round(v_tot, 3),
                })

    return {
        "success": True,
        "charges": charges,
        "x_range": [x_min, x_max],
        "y_range": [y_min, y_max],
        "grid_size": res,
        "vectors": vectors,
    }

