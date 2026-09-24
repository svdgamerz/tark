import sys
from app.correctness.checker import check_arithmetic, _HAVE_RUST

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def run_tests():
    print(f"[*] Rust acceleration active in checker: {_HAVE_RUST}")
    assert _HAVE_RUST is True, "Expected Rust acceleration to be active"

    # Test 1: Catches wrong arithmetic
    wrong_text = "The user calculated: 12 * 8 = 94 and also 2 ^ 10 = 1000."
    note = check_arithmetic(wrong_text)
    print(f"[*] Wrong arithmetic note:\n    {note}")
    assert "12 * 8 = 94" in note
    assert "96" in note
    assert "2 ^ 10 = 1000" in note
    assert "1024" in note

    # Test 2: Passes correct arithmetic
    correct_text = "We have 12 * 8 = 96, 5 + 5 = 10, and 100 / 4 = 25."
    note_correct = check_arithmetic(correct_text)
    assert note_correct == ""

    # Test 3: Ignores non-computation equalities
    var_text = "Let x = 5 and y = 10. Then x = y is false."
    note_var = check_arithmetic(var_text)
    assert note_var == ""

    print("[+] All checker tests PASSED successfully!")

if __name__ == "__main__":
    run_tests()
