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
        # User's reported History chapter hallucination queries
        ("what is 3 chp of history", "Maharashtra State Board (Balbharati)", "9", None, "India’s Internal Challenges"),
        ("what is chapter 3 of history", "Maharashtra State Board (Balbharati)", "9", "History", "India’s Internal Challenges"),
        ("what is 7th chp of history", "Maharashtra State Board (Balbharati)", "9", "History", "Science and Technology"),
        ("what is chapter 4 of history", "Maharashtra State Board (Balbharati)", "9", None, "Economic Development"),
        # Other standard tests
        ("what is the name of chp 6 of science b of std 9", None, None, None, "Classification of Plants"),
        ("what is chapter 5 of class 9 science cbse", None, None, None, "The Fundamental Unit of Life"),
        ("which is the 1st chapter of 10th maths cbse", None, None, None, "Real Numbers"),
        ("name of chapter 1 of 10th science state board", None, None, None, "Gravitation"),
        ("what is chapter 3 of 10th history state board", None, None, None, "Applied History"),
        ("what is 1st chapter of class 9 history cbse", None, None, None, "The French Revolution"),
        ("what is 1st chapter of class 10 history icse", None, None, None, "The First War of Independence"),
    ]
    for q, b, g, s, expected in tests:
        res = get_chapter_grounding(q, b, g, s)
        assert res is not None, f"Failed to get grounding for: {q}"
        norm_exp = expected.replace("’", "'").replace("‘", "'").lower()
        norm_res = res.replace("’", "'").replace("‘", "'").lower()
        assert norm_exp in norm_res, f"Expected '{expected}' in grounding for '{q}', got: {res}"
        print(f"PASS: '{q}' -> matches '{expected}'")

def test_multiturn_and_negation():
    # Multi-turn follow-up: "and what is chp 7" inheriting History from previous turn
    res = get_chapter_grounding(
        "and what is chp 7",
        req_board="Maharashtra State Board (Balbharati)",
        req_grade="9",
        req_subject=None,
        history=[
            {"role": "user", "content": "what is 3 chp of history"},
            {"role": "assistant", "content": "Chapter 3 is India’s Internal Challenges."}
        ]
    )
    assert res is not None
    assert "science and technology" in res.lower(), f"Expected Science and Technology, got: {res}"
    print("PASS: Multi-turn follow-up 'and what is chp 7' correctly resolved to Science and Technology")

    # Negation subject correction: "not science. history" inheriting chapter 7 from previous turn
    res2 = get_chapter_grounding(
        "not science. history",
        req_board="Maharashtra State Board (Balbharati)",
        req_grade="9",
        req_subject=None,
        history=[
            {"role": "user", "content": "what is chp 7"},
            {"role": "assistant", "content": "Chapter 7 of Science is Energy Flow in an Ecosystem."}
        ]
    )
    assert res2 is not None
    assert "science and technology" in res2.lower(), f"Expected Science and Technology for History ch 7, got: {res2}"
    print("PASS: Negation correction 'not science. history' correctly resolved to History ch 7 (Science and Technology)")

if __name__ == "__main__":
    test_chapter_queries()
    test_multiturn_and_negation()
    print("ALL 18 CHAPTER RESOLVER TESTS PASSED PERFECTLY!")
