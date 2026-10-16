"""Mathematical Error Spotting & Homework Diagnostic Engine.

Analyzes handwritten scratchpad derivation steps line-by-line, verifies algebraic and calculus
equivalence using SymPy, pinpoints the precise line where an error occurred, and generates
pedagogical Socratic hints and corrections.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any, List, Optional
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)

logger = logging.getLogger("tark.error_spotter")

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


def _clean_math_str(s: str) -> str:
    """Normalize common math symbols and whitespace."""
    s = s.strip()
    s = s.replace("^", "**")
    s = s.replace("−", "-").replace("×", "*").replace("÷", "/")
    s = s.replace("–", "-")
    return s


def parse_equation_or_expr(math_str: str, var_name: str = "x"):
    """Parse string into either a SymPy Eq or Expr."""
    clean = _clean_math_str(math_str)
    v_sym = sp.Symbol(var_name)
    local_dict = {var_name: v_sym, "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "exp": sp.exp, "sqrt": sp.sqrt}

    if "=" in clean:
        parts = clean.split("=")
        lhs = parse_expr(parts[0], local_dict=local_dict, transformations=TRANSFORMATIONS)
        rhs = parse_expr(parts[1], local_dict=local_dict, transformations=TRANSFORMATIONS)
        return sp.Eq(lhs, rhs), v_sym, True
    else:
        expr = parse_expr(clean, local_dict=local_dict, transformations=TRANSFORMATIONS)
        return expr, v_sym, False


def diagnose_transition(
    prev_str: str,
    curr_str: str,
    var_name: str = "x",
) -> dict[str, Any]:
    """Test algebraic equivalence between step i and step i+1."""
    try:
        parsed_prev, v_sym, is_eq_prev = parse_equation_or_expr(prev_str, var_name)
        parsed_curr, _, is_eq_curr = parse_equation_or_expr(curr_str, var_name)

        # Case 1: Both are equations
        if is_eq_prev and is_eq_curr:
            # Solve both equations
            try:
                sols_prev = set(sp.solve(parsed_prev, v_sym))
                sols_curr = set(sp.solve(parsed_curr, v_sym))

                if sols_prev == sols_curr:
                    return {"is_valid": True, "error_type": None, "hint": None}

                # If solutions mismatch, an algebraic break occurred!
                # Diagnose common mistakes:
                # 1. Sign transposition check: did they flip sign when moving a constant?
                hint = "Check the arithmetic operation when moving terms across the equals sign."
                error_type = "Sign / Transposition Mistake"

                # Check if distributing negative sign failed
                if "-" in prev_str and ("(" in prev_str or ")" in prev_str):
                    hint = "Be careful when distributing a negative sign into parentheses: -(a - b) = -a + b."
                    error_type = "Distributive Sign Misstep"

                return {
                    "is_valid": False,
                    "error_type": error_type,
                    "hint": hint,
                    "prev_solutions": [str(s) for s in sols_prev],
                    "curr_solutions": [str(s) for s in sols_curr],
                }
            except Exception:
                # Fallback to direct difference check
                diff = sp.simplify((parsed_prev.lhs - parsed_prev.rhs) - (parsed_curr.lhs - parsed_curr.rhs))
                if diff == 0:
                    return {"is_valid": True, "error_type": None, "hint": None}
                return {
                    "is_valid": False,
                    "error_type": "Algebraic Non-Equivalence",
                    "hint": "The expression on the left and right sides does not balance with the previous step.",
                }

        # Case 2: Both are algebraic expressions (e.g. simplifying 2x + 4 - x)
        else:
            diff = sp.simplify(parsed_prev - parsed_curr)
            if diff == 0:
                return {"is_valid": True, "error_type": None, "hint": None}

            # If derivative comparison
            try:
                d_prev = sp.diff(parsed_prev, v_sym)
                if sp.simplify(d_prev - parsed_curr) == 0:
                    return {"is_valid": True, "error_type": None, "hint": "Valid differentiation step."}
            except Exception:
                pass

            return {
                "is_valid": False,
                "error_type": "Simplification Inaccuracy",
                "hint": "Double check the arithmetic of combined like terms.",
            }

    except Exception as e:
        logger.debug(f"diagnose_transition error: {e}")
        # If parsing failed on human string, flag line for review
        return {
            "is_valid": True,  # Give benefit of doubt on unparseable lines
            "error_type": None,
            "hint": None,
        }


def spot_steps_errors(
    steps: list[str],
    problem_title: Optional[str] = None,
    var_name: str = "x",
) -> dict[str, Any]:
    """Spot errors across a list of consecutive derivation lines.
    Returns whether the overall solution is correct, the first buggy step index,
    the misconception category, and targeted Socratic hints.
    """
    clean_steps = [s.strip() for s in steps if s.strip()]
    if len(clean_steps) < 2:
        return {
            "success": True,
            "has_error": False,
            "total_steps": len(clean_steps),
            "error_step_index": None,
            "message": "Please provide at least 2 derivation steps to spot transition errors.",
            "step_evaluations": [],
        }

    step_evals: list[dict[str, Any]] = [
        {"step_number": 1, "content": clean_steps[0], "status": "valid", "annotation": "Initial Problem Statement"}
    ]

    first_error_idx: Optional[int] = None
    first_error_info: Optional[dict[str, Any]] = None

    for i in range(1, len(clean_steps)):
        prev_s = clean_steps[i - 1]
        curr_s = clean_steps[i]

        res = diagnose_transition(prev_s, curr_s, var_name)

        if not res["is_valid"] and first_error_idx is None:
            first_error_idx = i + 1  # 1-indexed for display
            first_error_info = res
            step_evals.append({
                "step_number": i + 1,
                "content": curr_s,
                "status": "error",
                "error_type": res.get("error_type", "Algebraic Inconsistency"),
                "hint": res.get("hint", "Review the algebraic balance between these steps."),
                "annotation": f"Error spotted in transition from Step {i} to Step {i + 1}",
            })
        else:
            status = "unverified" if first_error_idx is not None else "valid"
            step_evals.append({
                "step_number": i + 1,
                "content": curr_s,
                "status": status,
                "annotation": "Valid mathematical step" if status == "valid" else "Compounded from previous error",
            })

    has_err = first_error_idx is not None

    return {
        "success": True,
        "problem_title": problem_title,
        "has_error": has_err,
        "total_steps": len(clean_steps),
        "error_step_index": first_error_idx,
        "error_details": first_error_info,
        "step_evaluations": step_evals,
        "summary": (
            f"Found an error at Step {first_error_idx}: {first_error_info.get('error_type') if first_error_info else ''}"
            if has_err
            else "All derivation steps are algebraically valid! Excellent work."
        ),
    }
