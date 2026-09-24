import pytest
from app.correctness.checker import check_arithmetic, _HAVE_RUST

def test_checker_detects_wrong_arithmetic():
    assert _HAVE_RUST is True, "Expected Rust acceleration to be active"
    
    text = "The user computed 12 * 8 = 94, but the correct answer is different."
    note = check_arithmetic(text)
    assert "12 * 8 = 94" in note
    assert "96" in note

def test_checker_accepts_correct_arithmetic():
    text = "Here we calculate: 12 * 8 = 96 and 2 + 2 = 4 and 100 / 10 = 10."
    note = check_arithmetic(text)
    assert note == ""

def test_checker_ignores_non_computations():
    text = "We set x = 5 and y = 10, then x = y is false."
    note = check_arithmetic(text)
    assert note == ""

def test_checker_handles_powers_and_multiplications():
    text = "We have 2 ^ 10 = 1000 and 5 × 5 = 20."
    note = check_arithmetic(text)
    assert "2 ^ 10 = 1000" in note
    assert "1024" in note
    assert "5 × 5 = 20" in note
    assert "25" in note
