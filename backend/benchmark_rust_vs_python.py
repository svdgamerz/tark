import os
import sys
import time
import tracemalloc

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import tark_core
import sympy as sp
import re

_EQ = re.compile(r"(\d[\d \t()+\-*/×÷^]{0,40}\d)[ \t]*=[ \t]*(-?\d[\d,]*)")
_OP = re.compile(r"[+\-*/×÷^]")

def _normalize(expr: str) -> str:
    return (
        expr.replace("×", "*").replace("÷", "/").replace("^", "**").replace(",", "")
    ).strip()

def check_arithmetic_python_sympy(text: str, max_report: int = 3) -> str:
    issues: list[str] = []
    seen: set[tuple[str, str]] = set()

    for m in _EQ.finditer(text):
        lhs_raw, rhs_raw = m.group(1), m.group(2)
        if not _OP.search(lhs_raw):
            continue
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
            continue
        if sp.Integer(lv) != rv:
            issues.append(f"{lhs_raw.strip()} = {rhs_raw.strip()} → actually {lv}")
            if len(issues) >= max_report:
                break

    if not issues:
        return ""
    return "\n\n**Mathematical verification:** " + "; ".join(issues) + "."


def run_benchmark():
    test_text = """
    Step 1: Simplify the inner term: 25 * 4 = 100.
    Step 2: Add the constant offset: 100 + 45 = 145.
    Step 3: Multiply by the scaling factor: 145 * 2 = 280.  (Wait, 145 * 2 = 290)
    Step 4: Verify previous equation: 12 × 8 = 94.
    Step 5: Compute exponent: 2 ^ 10 = 1024.
    Step 6: Division check: 1000 ÷ 8 = 125.
    Step 7: Another false equation: 7 * 6 = 43.
    """

    iterations = 200

    print("=" * 65)
    print("      TARK BENCHMARK: RUST (tark_core) vs PYTHON (SymPy)")
    print("=" * 65)

    # 1. Warm-up
    _ = tark_core.check_arithmetic(test_text, 3)
    _ = check_arithmetic_python_sympy(test_text, 3)

    # 2. Benchmark Python (SymPy)
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(iterations):
        py_res = check_arithmetic_python_sympy(test_text, 3)
    t1 = time.perf_counter()
    py_current, py_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    py_total_ms = (t1 - t0) * 1000
    py_per_call_us = (py_total_ms / iterations) * 1000

    # 3. Benchmark Rust (tark_core)
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(iterations):
        rust_res = tark_core.check_arithmetic(test_text, 3)
    t1 = time.perf_counter()
    rust_current, rust_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    rust_total_ms = (t1 - t0) * 1000
    rust_per_call_us = (rust_total_ms / iterations) * 1000

    speedup = py_total_ms / rust_total_ms if rust_total_ms > 0 else 0

    print(f"Iterations:                 {iterations}")
    print(f"Python (SymPy) Total Time:  {py_total_ms:.2f} ms ({py_per_call_us:.1f} µs/call)")
    print(f"Rust (tark_core) Total Time:{rust_total_ms:.2f} ms ({rust_per_call_us:.1f} µs/call)")
    print(f"Speedup Factor:             {speedup:.1f}x FASTER with Rust 🚀")
    print("-" * 65)
    print(f"Python Heap Allocated:      {py_peak / 1024:.1f} KB during test")
    print(f"Rust Heap Allocated:        {rust_peak / 1024:.1f} KB during test")
    print("=" * 65)

    print("\nResult verification:")
    print("Rust output:")
    print(rust_res)

if __name__ == "__main__":
    run_benchmark()
