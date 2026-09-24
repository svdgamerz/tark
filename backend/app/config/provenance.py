"""Source provenance — which grounded content is authoritative vs AI-generated.

AI-generated curriculum content (currently the ICSE set the user supplied) is a
useful syllabus *scaffold* but NOT an authoritative textbook. So we (a) cite it
differently, (b) tell the model to trust established facts over the notes, and
(c) trigger a second-model cross-check on answers grounded in it (CLAUDE.md §7.4:
never state an uncertain fact as certain).
"""
from __future__ import annotations

# Boards whose indexed content is currently AI-generated rather than real books.
# When real textbooks replace these, drop the board from this set.
GENERATED_BOARDS = {"ICSE (CISCE)"}


def is_generated(board: str | None) -> bool:
    return bool(board) and board in GENERATED_BOARDS
