"""Download Balbharati e-book PDFs BY CODE and ingest them — no manual downloads.

Balbharati publishes every textbook at:
    https://ebooks.ebalbharati.in/pdfs/<code>.pdf
So to add a book you only need its code (from the Balbharati catalogue), not a
manual download. Add rows to CATALOG and run:

    cd backend
    .venv\\Scripts\\python.exe scripts\\fetch_and_ingest.py            # add new books
    .venv\\Scripts\\python.exe scripts\\fetch_and_ingest.py --reset    # rebuild index from CATALOG

⚠️ Rights: only ingest material you're licensed to use. Balbharati books are
© the State Bureau — for a public product, get educational-use permission, or use
openly-licensed sources (e.g. NCERT). See backend/data/README.md.
"""
from __future__ import annotations

import ssl
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rag.index import VectorIndex  # noqa: E402
from app.rag.ingest import ingest_pdf  # noqa: E402

URL = "https://ebooks.ebalbharati.in/pdfs/{code}.pdf"
DOWNLOADS = Path(__file__).resolve().parents[1] / "data" / "downloads"

BOARD = "Maharashtra State Board (Balbharati)"

# (code, board, grade, subject, part-label)  — add rows here to grow Acharya.
CATALOG: list[tuple[str, str, str, str, str]] = [
    ("1003000265", BOARD, "10", "Science", "Part 1"),
    ("1003000270", BOARD, "10", "Science", "Part 2"),
    ("1003000608", BOARD, "10", "Maths", "Part 1 (Algebra)"),
    ("1003000609", BOARD, "10", "Maths", "Part 2 (Geometry)"),
    # e.g. add Class 9 by finding its codes in the Balbharati catalogue:
    # ("xxxxxxxxxx", BOARD, "9", "Science", "Part 1"),
]


def _ssl_ctx() -> ssl.SSLContext:
    # ebooks.ebalbharati.in serves a cert with a hostname mismatch (a known issue
    # with this government server — curl needs -k too). Skip verification for it.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def download(code: str) -> Path:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    dest = DOWNLOADS / f"{code}.pdf"
    if dest.exists() and dest.stat().st_size > 10_000:
        return dest  # cached
    req = urllib.request.Request(
        URL.format(code=code), headers={"User-Agent": "Mozilla/5.0 (Tark)"}
    )
    with urllib.request.urlopen(req, timeout=120, context=_ssl_ctx()) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status}")
        dest.write_bytes(r.read())
    return dest


def main() -> None:
    reset = "--reset" in sys.argv
    idx = VectorIndex()
    if reset:
        print("reset: cleared", idx.clear(), "chunks (rebuilding from CATALOG)")
    for code, board, grade, subject, part in CATALOG:
        try:
            pdf = download(code)
            n = ingest_pdf(pdf, index=idx, board=board, grade=grade,
                           subject=subject, chapter=part)
            print(f"  {code}  Class {grade} {subject} [{part}] -> {n} chunks")
        except Exception as e:
            print(f"  {code}  FAILED: {e}")
    print("total chunks in index:", idx.count())


if __name__ == "__main__":
    main()
