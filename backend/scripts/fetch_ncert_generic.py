"""Generic NCERT (CBSE) textbook fetcher — add (grade, subject, [codes]) rows.

Openly licensed. URL: https://ncert.nic.in/textbook/pdf/<code><chap>.pdf
Each subject may have several books (e.g. Class 10 English = First Flight +
Footprints); list all their codes together so they ingest under one subject.

NOTE: NCERT is mid-revision (2024-26), so many grade 1-9 books were re-coded or
pulled; only codes verified live are listed here. Extend CATALOG as more are found.

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_ncert_generic.py
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
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "ncert_generic"
BOARD = "CBSE (NCERT)"

# (grade, subject, [book-codes]) — all verified live against ncert.nic.in.
CATALOG: list[tuple[str, str, list[str]]] = [
    ("1", "English", ["aemr1"]),                 # Marigold
    ("2", "English", ["bemr1"]),                 # Marigold
    ("7", "English", ["gehc1"]),                 # Honeycomb
    ("8", "English", ["hehd1"]),                 # Honeydew
    ("9", "English", ["iebe1"]),                 # Beehive
    ("10", "English", ["jeff1", "jefp1"]),       # First Flight + Footprints
    ("7", "Hindi", ["ghvs1"]),                   # Vasant
    ("8", "Hindi", ["hhvs1"]),                   # Vasant
    ("10", "Hindi", ["jhks1", "jhsp1", "jhkr1"]),  # Kshitij + Sparsh + Kritika
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


def main() -> None:
    idx = VectorIndex()
    for grade, subject, codes in CATALOG:
        idx.clear(board=BOARD, grade=grade, subject=subject)
        total = 0
        multi = len(codes) > 1
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
                ch_label = f"{code} Ch {chap}" if multi else f"Ch {chap}"
                n = ingest_pdf(pdf, index=idx, board=BOARD, grade=grade,
                               subject=subject, chapter=ch_label)
                total += n
                print(f"  {code}{chap:02d} -> {n} chunks", flush=True)
        print(f"{BOARD} Class {grade} {subject}: {total} chunks", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
