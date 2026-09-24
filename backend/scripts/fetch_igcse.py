"""Download official Cambridge IGCSE SYLLABUS PDFs and ingest them.

Cambridge publishes each subject's syllabus (topic outlines + learning
objectives) as a free PDF at cambridgeinternational.org/Images/<id>-<years>-syllabus.pdf.
These are syllabus OUTLINES, not textbooks — so Acharya gets light grounding
(topic scope + a syllabus citation), not full textbook depth. IGCSE is the
Class 9-10 course, so we index under grade 10.

Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_igcse.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

BOARD = "IGCSE (Cambridge)"
GRADE = "10"
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads" / "igcse"

# (subject, section-label, url) — Cambridge syllabus PDFs (verified URLs).
CATALOG = [
    ("Maths", "Mathematics (0580)",
     "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf"),
    ("Science", "Physics (0625)",
     "https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf"),
    ("Science", "Chemistry (0620)",
     "https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf"),
    ("Science", "Biology (0610)",
     "https://www.cambridgeinternational.org/Images/697203-2026-2028-syllabus.pdf"),
]

_client = httpx.Client(timeout=120, follow_redirects=True,
                       headers={"User-Agent": "Mozilla/5.0 (Tark)"})


def download(url: str) -> Path | None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / url.rsplit("/", 1)[-1]
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest
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
    idx.clear(board=BOARD)  # rebuild IGCSE from the catalog
    for subject, label, url in CATALOG:
        pdf = download(url)
        if not pdf:
            print(f"  FAILED {label}: {url}")
            continue
        n = ingest_pdf(pdf, index=idx, board=BOARD, grade=GRADE,
                       subject=subject, chapter=label)
        print(f"  {label} -> {n} chunks")
    print("curriculum:", idx.curriculum())


if __name__ == "__main__":
    main()
