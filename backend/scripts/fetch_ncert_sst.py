"""Download & ingest NCERT (CBSE) Social Science textbooks (openly licensed).

Same URL scheme as fetch_ncert.py:  https://ncert.nic.in/textbook/pdf/<code><chap>.pdf
Classes 6-8 use the REVISED single combined book "Exploring Society: India and
Beyond" (fees1/gees1/hees1). Classes 9-10 still use the 4-book set
(History/Geography/Civics/Economics); Class 10 = jess1-4. (Class 9 code TBD.)

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_ncert_sst.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

URL = "https://ncert.nic.in/textbook/pdf/{code}{chap:02d}.pdf"
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "ncert_sst"
BOARD = "CBSE (NCERT)"
SUBJECT = "Social Science"

# Friendly strand names for the Class 9-10 four-book set (used in citations).
STRAND = {"1": "Geography", "2": "Civics", "3": "History", "4": "Economics"}

# (grade, [book-codes]) — one subject "Social Science" per grade, possibly many books.
CATALOG: list[tuple[str, list[str]]] = [
    ("6", ["fees1"]),
    ("7", ["gees1"]),
    ("8", ["hees1"]),
    ("10", ["jess1", "jess2", "jess3", "jess4"]),
]

_client = httpx.Client(
    verify=False, timeout=120, follow_redirects=True,
    headers={"User-Agent": "Mozilla/5.0 (Tark educational fetcher)"},
)


def download(code: str, chap: int) -> Path | None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / f"{code}{chap:02d}.pdf"
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    url = URL.format(code=code, chap=chap)
    for attempt in range(5):
        try:
            r = _client.get(url)
            if r.status_code == 404:
                return None
            if r.status_code == 200 and len(r.content) > 10_000:
                dest.write_bytes(r.content)
                return dest
            return None
        except httpx.HTTPError:
            time.sleep(1.5 * (attempt + 1))
    return None


def label(code: str, chap: int) -> str:
    strand = STRAND.get(code[-1]) if code.startswith("jess") else None
    return f"{strand} Ch {chap}" if strand else f"Ch {chap}"


def main() -> None:
    idx = VectorIndex()
    for grade, codes in CATALOG:
        idx.clear(board=BOARD, grade=grade, subject=SUBJECT)  # clean re-run, once
        total = 0
        for code in codes:
            misses = 0
            for chap in range(1, 31):
                pdf = download(code, chap)
                if pdf is None:
                    misses += 1
                    if misses >= 2:
                        break
                    continue
                misses = 0
                n = ingest_pdf(pdf, index=idx, board=BOARD, grade=grade,
                               subject=SUBJECT, chapter=label(code, chap))
                total += n
                print(f"  {code}{chap:02d} -> {n} chunks", flush=True)
        print(f"{BOARD} Class {grade} {SUBJECT}: {total} chunks", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
