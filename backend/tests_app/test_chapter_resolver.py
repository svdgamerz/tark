import re
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.textbook_service import get_chapters_for_subject, normalize_board, normalize_grade, normalize_subject

def get_chapter_grounding(message: str, req_board=None, req_grade=None, req_subject=None):
    low = message.lower()
    
    # 1. Detect if this is a chapter/syllabus inquiry
    is_ch_query = bool(
        re.search(r'\b(?:ch(?:apter|\.?|p\.?)|lesson|unit)\s*(\d+)\b', low)
        or re.search(r'\b(name|title|which|what)\s+(?:is|of)?\s*(?:the\s+)?(?:(\d+)(?:st|nd|rd|th)?\s+)?(?:ch(?:apter|\.?|p\.?)|lesson|unit)\b', low)
        or re.search(r'\b(syllabus|table of contents|index|list (of )?chapters|how many chapters)\b', low)
    )
    if not is_ch_query:
        return None
        
    # 2. Extract grade (e.g. "class 10", "grade 9", "10th std", "10th class", "std 9", "10th", but NOT "1st chapter")
    grade = req_grade
    gm = (
        re.search(r'\b(?:class|grade|std\.?|standard)\s*(\d{1,2})\b', low)
        or re.search(r'\b(\d{1,2})(?:st|nd|rd|th)\s+(?:std|class|grade)\b', low)
    )
    if not gm:
        gm = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)\s+(?!ch(?:apter|\.?|p\.?)|lesson|unit)\b', low)
    if gm:
        grade = gm.group(1)
        
    # 3. Extract subject
    subj = req_subject or 'Science'
    for s_cand in [
        'science b', 'science a', 'science 1', 'science 2', 'science',
        'maths 1', 'maths 2', 'maths', 'algebra', 'geometry',
        'physics', 'chemistry', 'biology',
        'history & political science', 'history & civics', 'history', 'geography',
        'english', 'hindi', 'marathi', 'sanskrit'
    ]:
        if re.search(r'\b' + re.escape(s_cand) + r'\b', low):
            subj = s_cand
            break
            
    # 4. Extract board
    board = req_board
    if 'cbse' in low or 'ncert' in low:
        board = 'CBSE (NCERT)'
    elif 'icse' in low or 'cisce' in low:
        board = 'ICSE (CISCE)'
    elif 'state board' in low or 'maharashtra' in low or 'balbharati' in low or 'std' in low:
        board = 'Maharashtra State Board (Balbharati)'
    elif not board:
        board = 'Maharashtra State Board (Balbharati)' if (grade and int(grade) <= 10 and 'std' in low) else 'CBSE (NCERT)'
        
    chs = get_chapters_for_subject(board, grade or '10', subj)
    if not chs:
        return None
        
    toc_lines = [f"• {c['chapter']}" for c in chs]
    target_num = None
    nm = re.search(r'\b(?:ch(?:apter|\.?|p\.?)|lesson|unit)\s*(\d+)\b', low) or re.search(r'\b(\d+)(?:st|nd|rd|th)\s+(?:ch(?:apter|\.?|p\.?)|lesson|unit)\b', low)
    if nm:
        target_num = int(nm.group(1))
        
    target_ch = None
    if target_num and target_num <= len(chs):
        target_ch = chs[target_num - 1]['chapter']
        
    grounding = f"OFFICIAL TEXTBOOK TABLE OF CONTENTS ({board} Class {grade} {subj}):\n" + "\n".join(toc_lines)
    if target_ch:
        grounding += f"\n\nVERIFIED MATCH: Chapter {target_num} is \"{target_ch}\". State this exact title directly."
    return grounding

def test_chapter_queries():
    tests = [
        ("what is the name of chp 6 of science b of std 9", "Chapter 6: Classification of Plants"),
        ("what is chapter 5 of class 9 science cbse", "Chapter 5: The Fundamental Unit of Life"),
        ("which is the 1st chapter of 10th maths cbse", "Chapter 1: Real Numbers"),
        ("name of chapter 1 of 10th science state board", "Chapter 1: Gravitation"),
    ]
    for q, expected in tests:
        g = get_chapter_grounding(q)
        assert g is not None, f"Failed to get grounding for: {q}"
        assert expected in g, f"Expected '{expected}' in grounding for '{q}', got: {g}"
        print(f"PASS: '{q}' -> matches '{expected}'")

if __name__ == "__main__":
    test_chapter_queries()
    print("All chapter resolver tests passed!")
