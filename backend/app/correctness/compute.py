"""Tool-use SymPy (CLAUDE.md §7.1): the model sets up the maths, SymPy computes.

Two-pass flow (orchestrated in main.py for maths questions):
  1) EXTRACT — the model lists the exact calculations as JSON ops.
  2) COMPUTE — SymPy evaluates/solves them here (safely, via sympify — no eval).
The verified results are injected into the teaching prompt, so the model explains
using SymPy's numbers instead of doing the arithmetic itself.
"""
from __future__ import annotations

import json
import re

import sympy as sp

EXTRACT_SYSTEM_PROMPT = (
    "You extract the exact calculations needed to answer a student's maths "
    "question. Reply with ONLY a JSON array (max 5 items). Each item is "
    '{"type":"evaluate"|"solve","expr":"..."}.\n'
    "- expr must be valid SymPy: use * for multiply, ** for power, sqrt(...), etc.\n"
    '- "solve": expr is an equation containing = and one unknown, '
    'e.g. "2*x + 4 = 10".\n'
    '- "evaluate": a numeric/symbolic expression, e.g. "248 + 376" '
    '(write "15% of 200" as "0.15*200").\n'
    "If the question needs no calculation, reply []. JSON only, no explanation."
)

_MATH_HINT = re.compile(
    r"\d\s*[-+*/×÷^]\s*\d|solve|calculate|evaluate|simplif|factor|equation|"
    r"\bsum\b|product|how many|area|perimeter|volume|average|percent"
)


def looks_like_math(text: str, subject: str | None) -> bool:
    low = text.lower()
    if _MATH_HINT.search(low):
        return True
    return bool(subject and "math" in subject.lower() and re.search(r"\d", text))


def _run_op(op: dict) -> str | None:
    expr = str(op.get("expr", "")).strip()
    if not expr or len(expr) > 200:
        return None
    try:
        if str(op.get("type", "")).lower() == "solve" and "=" in expr:
            lhs, rhs = expr.split("=", 1)
            eq = sp.Eq(sp.sympify(lhs), sp.sympify(rhs))
            syms = sorted(eq.free_symbols, key=str)
            if not syms:
                return None
            sols = sp.solve(eq, syms[0])
            return f"{expr}  →  {syms[0]} = {sols}"
        val = sp.simplify(sp.sympify(expr))
        return f"{expr} = {val}"
    except Exception:
        return None


def _parse_ops(raw: str) -> list[dict]:
    m = re.search(r"\[.*\]", raw.strip(), re.DOTALL)
    if not m:
        return []
    try:
        data = json.loads(m.group(0))
    except Exception:
        return []
    return [o for o in data if isinstance(o, dict)][:5]


def compute_block(raw_ops_json: str) -> str:
    """Turn the model's extracted ops (JSON text) into a verified-results block."""
    results = [r for op in _parse_ops(raw_ops_json) if (r := _run_op(op))]
    if not results:
        return ""
    return (
        "\n\nVERIFIED COMPUTATIONS (a maths engine computed these — use these exact "
        "values in your explanation and do NOT recompute them yourself):\n"
        + "\n".join(f"- {r}" for r in results)
    )
