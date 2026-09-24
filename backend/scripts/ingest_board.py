"""Ingest a board PDF into the curriculum RAG index.

Run from the backend/ folder:
    .venv\\Scripts\\python.exe scripts\\ingest_board.py <pdf> --grade 10 --subject Science --chapter 1
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make `app` importable when run as a plain script from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest a board PDF into the RAG index.")
    ap.add_argument("pdf", help="path to the PDF")
    ap.add_argument("--board", default="Maharashtra State Board (Balbharati)")
    ap.add_argument("--grade", default="10")
    ap.add_argument("--subject", default="Science")
    ap.add_argument("--chapter", default=None)
    args = ap.parse_args()

    if not Path(args.pdf).exists():
        raise SystemExit(f"File not found: {args.pdf}")

    n = ingest_pdf(
        args.pdf,
        index=VectorIndex(),
        board=args.board,
        grade=args.grade,
        subject=args.subject,
        chapter=args.chapter,
    )
    print(f"Indexed {n} chunks from {args.pdf}")
    print(f"Total chunks in index: {VectorIndex().count()}")


if __name__ == "__main__":
    main()
