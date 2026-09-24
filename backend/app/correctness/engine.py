"""Correctness engine — SymPy-backed verification seam (CLAUDE.md §7).

Phase 0: the seam exists and works — it can evaluate a symbolic/numeric
expression and check a model's claimed result against SymPy. It is wired into
the API (`POST /verify`) so the seam is real, but it does NOT yet intercept and
override streamed chat output.

TODO(Phase 1): enforce §7 fully — intercept every model-emitted numeric/symbolic
result, recompute it here, and if the model disagrees, SymPy wins and the
discrepancy is logged before anything reaches the learner.
"""
from __future__ import annotations

from dataclasses import dataclass

import sympy as sp


@dataclass(frozen=True)
class CheckResult:
    ok: bool
    expected: str | None  # SymPy's authoritative value, as a string
    detail: str


def evaluate(expression: str) -> CheckResult:
    """Compute/simplify a symbolic or numeric expression with SymPy.

    The LLM defers any final computation to this function (§7.1).
    """
    try:
        expr = sp.sympify(expression)
        simplified = sp.simplify(expr)
        return CheckResult(ok=True, expected=str(simplified), detail="evaluated")
    except (sp.SympifyError, TypeError, ValueError, AttributeError) as e:
        return CheckResult(ok=False, expected=None, detail=f"could not parse: {e}")


def verify(claimed: str, expression: str) -> CheckResult:
    """Check a model's ``claimed`` result against SymPy's computation of
    ``expression``. If they differ, SymPy is authoritative (§7.3).
    """
    truth = evaluate(expression)
    if not truth.ok or truth.expected is None:
        return truth
    try:
        claimed_expr = sp.sympify(claimed)
        truth_expr = sp.sympify(truth.expected)
        agree = sp.simplify(claimed_expr - truth_expr) == 0
    except (sp.SympifyError, TypeError, ValueError, AttributeError) as e:
        return CheckResult(
            ok=False, expected=truth.expected, detail=f"claim unparseable: {e}"
        )
    if agree:
        return CheckResult(ok=True, expected=truth.expected, detail="claim matches SymPy")
    return CheckResult(
        ok=False,
        expected=truth.expected,
        detail=(
            f"claim '{claimed}' disagrees with SymPy '{truth.expected}' — "
            "SymPy wins (§7.3)"
        ),
    )
