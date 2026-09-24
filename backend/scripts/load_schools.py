"""Load the school → board lookup from public affiliation datasets.

Sources (open, scraped affiliation lists):
  CBSE  — github.com/deedy/cbse_schools_data  (~20k schools)
  CISCE — github.com/deedy/cisce_schools_data (~2.3k ICSE/ISC schools)

Board is normalized to Tark's content board strings so a selected school grounds
directly (CBSE → "CBSE (NCERT)"). Run:
    cd backend
    .venv\\Scripts\\python.exe scripts\\load_schools.py
"""
from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schools.store import SchoolStore  # noqa: E402

CBSE_URL = "https://raw.githubusercontent.com/deedy/cbse_schools_data/master/basic/schools.csv"
CISCE_URL = "https://raw.githubusercontent.com/deedy/cisce_schools_data/master/schools.csv"


def _fetch(url: str) -> str:
    r = httpx.get(url, timeout=180, follow_redirects=True)
    r.raise_for_status()
    return r.text


def main() -> None:
    store = SchoolStore()
    store.clear()
    rows: list[tuple[str, str, str, str]] = []

    for url, board, city_field in (
        (CBSE_URL, "CBSE (NCERT)", "district"),
        (CISCE_URL, "ICSE (CISCE)", None),
    ):
        text = _fetch(url)
        n = 0
        for r in csv.DictReader(io.StringIO(text)):
            name = (r.get("name") or "").strip()
            if not name:
                continue
            city = (r.get(city_field) or "").strip() if city_field else ""
            state = (r.get("state") or "").strip()
            rows.append((name, city, state, board))
            n += 1
        print(f"  {board}: {n} schools")

    store.bulk_insert(rows)
    print(f"loaded {store.count()} schools total")


if __name__ == "__main__":
    main()
