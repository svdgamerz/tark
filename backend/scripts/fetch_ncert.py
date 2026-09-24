"""Download NCERT (CBSE) textbook chapter PDFs by code and ingest them.

NCERT is OPENLY LICENSED — safe to use for a public product. Every chapter is at:
    https://ncert.nic.in/textbook/pdf/<code><chap>.pdf
where <code> = <class><medium><subject><book>. Class 10 English Science book 1 =
"jesc1", so Class 10 Science chapter 3 = jesc103.pdf. Chapters run 01, 02, ...

Class letters: a=1 … i=9, j=10, k=11, l=12.  Medium: e=English, h=Hindi.

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_ncert.py
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
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "ncert"
BOARD = "CBSE (NCERT)"
CLASS_LETTER = {str(n): chr(ord("a") + n - 1) for n in range(1, 13)}  # 1->a … 10->j

# (grade, subject-label, book-code). Book codes verified against ncert.nic.in.
# Lower grades use REVISED books with non-standard codes (Curiosity / Ganita
# Prakash), so we store the full code per entry rather than constructing it.
# Class 10 (jesc1/jemh1) is already ingested.
# Grades 6-10 already ingested. Now grades 1-5 (lower primary uses Maths + EVS;
# no separate Science below Class 6). Codes verified against ncert.nic.in.
CATALOG = [
    ("5", "Maths", "eemm1"),     # Math Mela
    ("5", "EVS", "eeev1"),
    ("4", "Maths", "demm1"),     # Math Mela
    ("4", "EVS", "deev1"),
    ("3", "Maths", "cemm1"),     # Math Mela
    ("3", "EVS", "ceev1"),
    ("2", "Maths", "bejm1"),     # Joyful Mathematics
    ("1", "Maths", "aejm1"),     # Joyful Mathematics
]

# NCERT resets cold connections, so reuse one client (keep-alive) and retry.
_client = httpx.Client(
    verify=False,  # ncert.nic.in cert chain is incomplete
    timeout=120,
    follow_redirects=True,
    headers={"User-Agent": "Mozilla/5.0 (Tark educational fetcher)"},
)


def download(code: str, chap: int) -> Path | None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / f"{code}{chap:02d}.pdf"
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    url = URL.format(code=code, chap=chap)
    last: Exception | None = None
    for attempt in range(5):
        try:
            r = _client.get(url)
            if r.status_code == 404:
                return None
            if r.status_code == 200 and len(r.content) > 10_000:
                dest.write_bytes(r.content)
                return dest
            return None  # other status / too small → treat as absent
        except httpx.HTTPError as e:
            last = e
            time.sleep(1.5 * (attempt + 1))  # back off and retry the reset
    print(f"    skip {code}{chap:02d}: {last}", flush=True)
    return None


def main() -> None:
    idx = VectorIndex()
    for grade, subject, code in CATALOG:
        idx.clear(board=BOARD, grade=grade, subject=subject)  # clean re-run
        total, misses = 0, 0
        for chap in range(1, 31):
            pdf = download(code, chap)
            if pdf is None:
                misses += 1
                if misses >= 2 and total > 0:
                    break  # end of book
                continue
            misses = 0
            n = ingest_pdf(pdf, index=idx, board=BOARD, grade=grade,
                           subject=subject, chapter=str(chap))
            total += n
            print(f"  {code}{chap:02d} -> {n} chunks", flush=True)
        print(f"{BOARD} Class {grade} {subject}: {total} chunks", flush=True)
    print("curriculum:", idx.curriculum(), flush=True)


if __name__ == "__main__":
    main()
