"""Ingest a board PDF: parse text per page → overlapping chunks → embed → store.

NOTE on rights: only ingest material you're licensed to use. For a public
product on copyrighted board textbooks, ground on short snippets and always cite
the source (the index stores citation metadata for exactly this).
"""
from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF

from app.rag.embeddings import embed_documents
from app.rag.index import VectorIndex


def _chunk(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    step = max(size - overlap, 1)  # guarantees forward progress
    start, n = 0, len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:  # try not to cut mid-word
            sp = text.rfind(" ", start + step, end)
            if sp != -1:
                end = sp
        chunk = text[start:end].strip()
        if len(chunk) > 40:  # skip tiny fragments
            chunks.append(chunk)
        if end >= n:  # reached the end of this page's text — stop
            break
        start = end - overlap
        if start <= 0:
            start = end
    return chunks


def pdf_to_rows(
    path: str | Path,
    *,
    board: str,
    grade: str,
    subject: str,
    chapter: str | None = None,
) -> list[dict]:
    doc = fitz.open(str(path))
    source = Path(path).name
    rows: list[dict] = []
    for pno in range(len(doc)):
        page_text = doc[pno].get_text("text")
        for ch in _chunk(page_text):
            rows.append({
                "board": board, "grade": grade, "subject": subject,
                "chapter": chapter, "page": pno + 1, "source": source, "text": ch,
            })
    doc.close()
    return rows


def ingest_pdf(
    path: str | Path,
    *,
    index: VectorIndex,
    board: str,
    grade: str,
    subject: str,
    chapter: str | None = None,
) -> int:
    """Parse, embed (locally), and store a PDF. Returns the chunks indexed."""
    rows = pdf_to_rows(path, board=board, grade=grade, subject=subject, chapter=chapter)
    if not rows:
        return 0
    embeddings = embed_documents([r["text"] for r in rows])
    index.add(rows, embeddings)
    return len(rows)
