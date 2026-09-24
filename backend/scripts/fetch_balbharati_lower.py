"""Download Maharashtra Balbharati LOWER-grade textbooks (Std 1-8) and ingest.

Lower grades live on a different host than Class 9-10:
    https://books.ebalbharati.in/pdfs/<code>.pdf   (full-book PDFs)
Maths (English medium) follows {std}03020004 for Std 1-8 (verified). Add more
codes to CATALOG as they're discovered.

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_balbharati_lower.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

BOARD = "Maharashtra State Board (Balbharati)"
BASE = "https://books.ebalbharati.in/pdfs"
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "balbharati_lower"

# (grade, subject, code) — English medium. Maths Std 1-8 = {std}03020004;
# General Science Std 6-8 = {std}03020012. (Std 5 = EVS, Std 9 = different scheme.)
CATALOG = [(str(s), "Maths", f"{s}03020004") for s in range(1, 9)] + [
    (str(s), "Science", f"{s}03020012") for s in (6, 7, 8)
]

_client = httpx.Client(verify=False, timeout=180, follow_redirects=True,
                       headers={"User-Agent": "Mozilla/5.0 (Tark)"})


def download(code: str) -> Path | None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / f"{code}.pdf"
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    for attempt in range(4):
        try:
            r = _client.get(f"{BASE}/{code}.pdf")
            if r.status_code == 200 and len(r.content) > 10_000:
                dest.write_bytes(r.content)
                return dest
            return None
        except httpx.HTTPError:
            time.sleep(1.5 * (attempt + 1))
    return None


def main() -> None:
    idx = VectorIndex()
    for grade, subject, code in CATALOG:
        idx.clear(board=BOARD, grade=grade, subject=subject)
        pdf = download(code)
        if not pdf:
            print(f"  FAILED Std {grade} {subject} ({code})")
            continue
        n = ingest_pdf(pdf, index=idx, board=BOARD, grade=grade, subject=subject)
        print(f"  Std {grade} {subject} -> {n} chunks", flush=True)
    print("done")


if __name__ == "__main__":
    main()
