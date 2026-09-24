"""Download official ICSE (CISCE) SYLLABUS PDFs and ingest them.

CISCE publishes each subject's syllabus as a PDF at:
    https://cisce.org/wp-content/uploads/2026/01/<n>.-<Subject>.pdf
These are syllabus OUTLINES (topics + scope for Class IX-X), not textbooks — so
Acharya gets light grounding (topic scope + a syllabus citation). Indexed under
grade 10 (ICSE is the IX-X course).

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_icse.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

BOARD = "ICSE (CISCE)"
GRADE = "10"
BASE = "https://cisce.org/wp-content/uploads/2026/01"
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "icse"

# (subject, section-label, filename)
CATALOG = [
    ("Maths", "Mathematics", "9.-Mathematics.pdf"),
    ("Science", "Physics", "10.-Physics.pdf"),
    ("Science", "Chemistry", "11.-Chemistry.pdf"),
    ("Science", "Biology", "12.-Biology.pdf"),
]

_client = httpx.Client(verify=False, timeout=180, follow_redirects=True,
                       headers={"User-Agent": "Mozilla/5.0 (Tark)"})


def download(filename: str) -> Path | None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / filename
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
    url = f"{BASE}/{filename}"
    for attempt in range(4):
        try:
            r = _client.get(url)
            if r.status_code == 200 and len(r.content) > 10_000:
                dest.write_bytes(r.content)
                return dest
            return None
        except httpx.HTTPError:
            time.sleep(1.5 * (attempt + 1))
    return None


def main() -> None:
    idx = VectorIndex()
    idx.clear(board=BOARD)  # rebuild ICSE from the catalog
    for subject, label, filename in CATALOG:
        pdf = download(filename)
        if not pdf:
            print(f"  FAILED {label}: {filename}")
            continue
        n = ingest_pdf(pdf, index=idx, board=BOARD, grade=GRADE,
                       subject=subject, chapter=label)
        print(f"  {label} -> {n} chunks")
    print("curriculum:", idx.curriculum())


if __name__ == "__main__":
    main()
