import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.textbook_service import get_chapter_grounding

def test_chapter_queries():
    tests = [
        # User's exact queries
        ("what is my 8th chp of science", "Maharashtra State Board (Balbharati)", "9", "Science", "Useful and Harmful Microbes"),
        ("isn't it Useful and Harmful Microbes", "Maharashtra State Board (Balbharati)", "9", "Science", "Useful and Harmful Microbes"),
        ("tell me 8th chapter of science", "Maharashtra State Board (Balbharati)", "9", "Science", "Useful and Harmful Microbes"),
        ("what is chapter 8 in science", "Maharashtra State Board (Balbharati)", "9", "Science", "Useful and Harmful Microbes"),
        ("which chapter is Useful and Harmful Microbes", "Maharashtra State Board (Balbharati)", "9", "Science", "Useful and Harmful Microbes"),
        # Other standard tests
        ("what is the name of chp 6 of science b of std 9", None, None, None, "Chapter 6: Classification of Plants"),
        ("what is chapter 5 of class 9 science cbse", None, None, None, "Chapter 5: The Fundamental Unit of Life"),
        ("which is the 1st chapter of 10th maths cbse", None, None, None, "Chapter 1: Real Numbers"),
        ("name of chapter 1 of 10th science state board", None, None, None, "Chapter 1: Gravitation"),
    ]
    for q, b, g, s, expected in tests:
        res = get_chapter_grounding(q, b, g, s)
        assert res is not None, f"Failed to get grounding for: {q}"
        assert expected in res, f"Expected '{expected}' in grounding for '{q}', got: {res}"
        print(f"PASS: '{q}' -> matches '{expected}'")

if __name__ == "__main__":
    test_chapter_queries()
    print("All chapter resolver tests passed!")
