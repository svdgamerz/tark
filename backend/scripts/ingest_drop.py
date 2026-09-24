"""Ingest any textbook PDFs you drop into a labelled folder.

This is the catch-all for books the code-based fetchers can't reach (e.g. NCERT's
just-revised grade 1-9 books, or any board). Download a whole-book PDF from the
official site and drop it under:

    backend/data/drop/<board>/<grade>/<subject>/<anything>.pdf

  <board>   one of: ncert, maharashtra, icse, igcse   (folder name)
  <grade>   1 .. 12
  <subject> Maths | Science | Social Science | English | Hindi | Sanskrit | ...

Example:
    backend/data/drop/ncert/9/Social Science/understanding-society.pdf

Each PDF becomes one "chapter" (cited by its filename). Re-running clears and
re-ingests each (board, grade, subject) it finds, so it's safe to run repeatedly.

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\ingest_drop.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

DROP = Path(__file__).resolve().parents[1] / "data" / "drop"
BOARDS = {
    "ncert": "CBSE (NCERT)",
    "cbse": "CBSE (NCERT)",
    "maharashtra": "Maharashtra State Board (Balbharati)",
    "balbharati": "Maharashtra State Board (Balbharati)",
    "icse": "ICSE (CISCE)",
    "igcse": "IGCSE (Cambridge)",
}


def main() -> None:
    if not DROP.exists():
        DROP.mkdir(parents=True, exist_ok=True)
        print(f"Created {DROP} — drop PDFs under <board>/<grade>/<subject>/ and re-run.")
        return

    idx = VectorIndex()
    cleared: set[tuple[str, str, str]] = set()
    found = 0

    for pdf in sorted(DROP.rglob("*.pdf")):
        rel = pdf.relative_to(DROP).parts
        if len(rel) < 4:
            print(f"  SKIP {pdf} — need <board>/<grade>/<subject>/file.pdf")
            continue
        board_key, grade, subject = rel[0].lower(), rel[1], rel[2]
        board = BOARDS.get(board_key)
        if not board:
            print(f"  SKIP {pdf} — unknown board folder '{rel[0]}' (use {list(BOARDS)})")
            continue
        key = (board, grade, subject)
        if key not in cleared:
            idx.clear(board=board, grade=grade, subject=subject)
            cleared.add(key)
        n = ingest_pdf(pdf, index=idx, board=board, grade=grade,
                       subject=subject, chapter=pdf.stem)
        found += 1
        print(f"  {board} Class {grade} {subject} :: {pdf.name} -> {n} chunks", flush=True)

    print(f"done — ingested {found} PDF(s)." if found else "No PDFs found under data/drop/.")


if __name__ == "__main__":
    main()
