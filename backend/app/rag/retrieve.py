"""Query-time retrieval + grounding for the chat.

If a board/grade/subject is selected and the top retrieved chunk clears the
confidence threshold, we ground the answer in those excerpts (with citations).
Otherwise we return nothing and the chat falls back to the general models.
"""
from __future__ import annotations

import re

from app.config.provenance import is_generated
from app.rag.embeddings import embed_query
from app.rag.index import Hit, VectorIndex

def normalize_board(board_str: str | None) -> str | None:
    if not board_str:
        return None
    b_low = board_str.lower().strip()
    if "cbse" in b_low or "ncert" in b_low:
        return "CBSE (NCERT)"
    if "icse" in b_low or "isc" in b_low or "cisce" in b_low:
        return "ICSE (CISCE)"
    if "maharashtra" in b_low or "state board" in b_low or "balbharati" in b_low:
        return "Maharashtra State Board (Balbharati)"
    if "cambridge" in b_low or "igcse" in b_low:
        return "IGCSE (Cambridge)"
    return board_str


def normalize_grade(grade_str: str | None) -> str | None:
    if not grade_str:
        return None
    match = re.search(r"\b(\d{1,2})\b", str(grade_str))
    if match:
        return match.group(1)
    return str(grade_str).strip()


def normalize_subject(subject_str: str | None) -> str | None:
    if not subject_str:
        return None
    s_low = subject_str.lower().strip()
    if "math" in s_low:
        return "Maths"
    if "physics" in s_low:
        return "Physics"
    if "chemistry" in s_low:
        return "Chemistry"
    if "biology" in s_low:
        return "Biology"
    if "computer" in s_low:
        return "Computer Applications"
    if "social" in s_low or "history" in s_low or "civics" in s_low:
        return "History & Civics"
    if "geography" in s_low:
        return "Geography"
    if "english" in s_low:
        return "English"
    if "hindi" in s_low:
        return "Hindi"
    if "sanskrit" in s_low:
        return "Sanskrit"
    if "marathi" in s_low:
        return "Marathi"
    if "science" in s_low:
        return "Science"
    return subject_str.strip()


def retrieve_chapter_grounding(
    chapter_or_topic: str,
    *,
    board: str | None = None,
    grade: str | None = None,
    subject: str | None = None,
) -> list[Hit] | None:
    """Retrieve foundational textbook excerpts for the start of a chapter or milestone."""
    if not chapter_or_topic:
        return None

    norm_board = normalize_board(board)
    norm_grade = normalize_grade(grade)
    norm_subj = normalize_subject(subject)

    clean_topic = re.sub(
        r"^(phase|milestone|chapter|ch|unit)\s*\d+[:\-\s]*",
        "",
        chapter_or_topic,
        flags=re.IGNORECASE,
    ).strip()
    clean_topic = re.sub(
        r"^(foundations?|core mechanics?|introduction|overview)[:\-\s]*",
        "",
        clean_topic,
        flags=re.IGNORECASE,
    ).strip()

    search_queries = [
        f"{clean_topic} introduction definitions fundamental concepts",
        clean_topic,
        f"{norm_subj or ''} {clean_topic} principles and laws".strip(),
    ]

    hits = retrieve_multi(search_queries, board=norm_board, grade=norm_grade, subject=norm_subj)
    if not hits and norm_board:
        hits = retrieve_multi(search_queries, board=norm_board, grade=None, subject=norm_subj)
    if not hits and norm_subj:
        hits = retrieve_multi(search_queries, board=None, grade=None, subject=norm_subj)

    return hits


# Relevant hits score ~0.77+; an off-syllabus question scored ~0.55. 0.65 cleanly
# separates "answer from the board" from "fall back to Gemini/NIM".
GROUND_THRESHOLD = 0.65
# Above this, the raw question already matched the textbook well — no need to
# spend an LLM call rewriting it. Below it (but still grounding), the smart
# Retriever rewrites and keeps the better result.
CONFIDENT_SCORE = 0.75
TOP_K = 4

_index = VectorIndex()


def list_curriculum() -> list[dict]:
    """What's indexed — for the UI syllabus picker."""
    return _index.curriculum()


def retrieve(
    message: str,
    *,
    board: str | None = None,
    grade: str | None = None,
    subject: str | None = None,
) -> list[Hit] | None:
    """Return grounding hits if confident, else None (→ fall back)."""
    if not message or not board:
        return None
    hits = _index.search(
        embed_query(message), top_k=TOP_K, board=board, grade=grade, subject=subject
    )
    if not hits or hits[0].score < GROUND_THRESHOLD:
        return None
    return hits


def retrieve_multi(
    queries: list[str],
    *,
    board: str | None = None,
    grade: str | None = None,
    subject: str | None = None,
) -> list[Hit] | None:
    """Smart Retriever: search several phrasings of the question and merge the
    best chunk per (source, page). Used when the raw question alone didn't ground
    — the rewritten, textbook-worded queries usually rescue the match."""
    if not board:
        return None
    best: dict[tuple, Hit] = {}
    for q in queries:
        if not q or not q.strip():
            continue
        for h in _index.search(
            embed_query(q), top_k=TOP_K, board=board, grade=grade, subject=subject
        ):
            key = (h.source, h.page, h.text[:80])
            if key not in best or h.score > best[key].score:
                best[key] = h
    hits = sorted(best.values(), key=lambda h: -h.score)[:TOP_K]
    if not hits or hits[0].score < GROUND_THRESHOLD:
        return None
    return hits


def hits_are_generated(hits: list[Hit]) -> bool:
    """True if any grounding hit comes from AI-generated (non-authoritative) content."""
    return any(is_generated(h.board) for h in hits)


def grounding_prompt(hits: list[Hit]) -> str:
    excerpts = "\n\n".join(f"[{h.citation}]\n{h.text}" for h in hits)
    if hits_are_generated(hits):
        # Low-trust source: use only for scope/level, never as a fact authority.
        return (
            "\n\n--- SYLLABUS NOTES (AI-GENERATED — NOT AUTHORITATIVE) ---\n"
            "These notes are AI-generated and may contain mistakes. Use them ONLY to "
            "match the board's topics, scope, and difficulty level. Base every FACT on "
            "your own well-established knowledge, NOT on these notes; if a note conflicts "
            "with an established fact, trust the fact. Do NOT add a source line yourself.\n\n"
            f"{excerpts}\n--- END NOTES ---"
        )
    return (
        "\n\n--- OFFICIAL TEXTBOOK CONTEXT ---\n"
        "Base your answer on these official textbook excerpts from the student's board "
        "syllabus, and keep the facts faithful to them. Teach in your normal style. Do "
        "NOT add a source line yourself — the app appends the citation automatically. If "
        "these excerpts do not actually cover the question, say so honestly and then "
        "answer from general knowledge.\n\n"
        f"{excerpts}\n--- END CONTEXT ---"
    )
