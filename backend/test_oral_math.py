import sys
from app.oral_eval import _clean_math_for_oral_eval, _build_prompt, _fallback_heuristic

raw = r'''Problem: A 2 kg block slides with speed of \(5\ \text{m s}^{-1}\). Friction coefficient \(\muk = 0.30\). Formula: \[ v^2 = v0^2 + 2 a d \quad\text{with final speed } v = 0. \] \[ \boxed{a = -2.94\ \text{m s}^{-2}} \]'''
clean = _clean_math_for_oral_eval(raw)
assert r'\muk' not in clean, 'LaTeX muk still in clean text'
assert r'\boxed' not in clean, 'LaTeX boxed still in clean text'
assert r'\quad' not in clean, 'LaTeX quad still in clean text'
assert 'm/s' in clean, 'm/s not found in clean text'
print('ALL ORAL EVAL MATH TESTS PASSED!')
