import unittest
from app.correctness.checker import check_arithmetic, _HAVE_RUST

class TestChecker(unittest.TestCase):
    def test_checker_detects_wrong_arithmetic(self):
        # Tests that arithmetic checking works via Rust or Python fallback
        text = "The user computed 12 * 8 = 94, but the correct answer is different."
        note = check_arithmetic(text)
        self.assertIn("12 * 8 = 94", note)
        self.assertIn("96", note)

    def test_checker_accepts_correct_arithmetic(self):
        text = "Here we calculate: 12 * 8 = 96 and 2 + 2 = 4 and 100 / 10 = 10."
        note = check_arithmetic(text)
        self.assertEqual(note, "")

    def test_checker_ignores_non_computations(self):
        text = "We set x = 5 and y = 10, then x = y is false."
        note = check_arithmetic(text)
        self.assertEqual(note, "")

    def test_checker_handles_powers_and_multiplications(self):
        text = "We have 2 ^ 10 = 1000 and 5 × 5 = 20."
        note = check_arithmetic(text)
        self.assertIn("2 ^ 10 = 1000", note)
        self.assertIn("1024", note)
        self.assertIn("5 × 5 = 20", note)
        self.assertIn("25", note)

if __name__ == "__main__":
    unittest.main()
