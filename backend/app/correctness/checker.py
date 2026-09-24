"""Arithmetic guard (CLAUDE.md §7.3).

Scans a finished answer for explicit numeric equalities like "12 × 8 = 94" and,
where verification disagrees, returns a correction note to append. The model explains
the method; verification is the authority on the number — if they differ, verification wins.

Uses native Rust engine (`tark_core`) for high-speed, zero-allocation checking
with transparent fallback to SymPy.
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger("tark.correctness")

try:
    import tark_core
    _HAVE_RUST = True
    logger.info("tark_core native Rust acceleration module active")
except ImportError:
    _HAVE_RUST = False

# Fallback regex and imports if Rust module is not available
_EQ = re.compile(r"(\d[\d \t()+\-*/×÷^]{0,40}\d)[ \t]*=[ \t]*(-?\d[\d,]*)")
_OP = re.compile(r"[+\-*/×÷^]")


def _normalize(expr: str) -> str:
    return (
        expr.replace("×", "*").replace("÷", "/").replace("^", "**").replace(",", "")
    ).strip()


def check_arithmetic(text: str, max_report: int = 3) -> str:
    """Return a correction note (or "") for any wrong integer arithmetic."""
    if _HAVE_RUST:
        return tark_core.check_arithmetic(text, max_report)

    # Pure Python / SymPy fallback (lazy imported to save 60MB+ RAM when unused)
    import sympy as sp

    issues: list[str] = []
    seen: set[tuple[str, str]] = set()

    for m in _EQ.finditer(text):
        lhs_raw, rhs_raw = m.group(1), m.group(2)
        if not _OP.search(lhs_raw):
            continue  # needs an operator → it's a computation, not "5 = 5"
        # Skip if the RHS is really a decimal / fraction / percent (rounding is fuzzy).
        if text[m.end() : m.end() + 1] in (".", "/", "%"):
            continue
        key = (lhs_raw.strip(), rhs_raw.strip())
        if key in seen:
            continue
        seen.add(key)
        try:
            lv = sp.sympify(_normalize(lhs_raw))
            rv = sp.Integer(int(_normalize(rhs_raw)))
        except Exception:
            continue
        if not getattr(lv, "is_integer", False):
            continue  # only trust exact integer results
        if sp.Integer(lv) != rv:
            issues.append(f"{lhs_raw.strip()} = {rhs_raw.strip()} → actually {lv}")
            if len(issues) >= max_report:
                break

    if not issues:
        return ""
    return "\n\n**Mathematical verification:** " + "; ".join(issues) + "."
