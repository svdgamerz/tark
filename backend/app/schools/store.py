"""SQLite store of schools → board, for the onboarding autocomplete.

Populated from public datasets (CBSE + CISCE affiliation lists) by
scripts/load_schools.py. `board` is normalized to Tark's content board strings
(e.g. "CBSE (NCERT)") so selecting a school sets a profile that grounds directly.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config.db_path import get_db_path


class SchoolStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = str(db_path or get_db_path("tark_schools.db"))
        self._init()

    @contextmanager
    def _conn(self):
        c = sqlite3.connect(self.db_path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def _init(self) -> None:
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS schools (
                    id    INTEGER PRIMARY KEY AUTOINCREMENT,
                    name  TEXT NOT NULL,
                    city  TEXT,
                    state TEXT,
                    board TEXT NOT NULL
                )"""
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_schools_name "
                "ON schools(name COLLATE NOCASE)"
            )

    def clear(self) -> None:
        with self._conn() as c:
            c.execute("DELETE FROM schools")

    def count(self) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM schools").fetchone()[0]

    def bulk_insert(self, rows: list[tuple[str, str, str, str]]) -> None:
        with self._conn() as c:
            c.executemany(
                "INSERT INTO schools(name, city, state, board) VALUES(?,?,?,?)", rows
            )

    def search(self, q: str, limit: int = 8) -> list[dict]:
        q = q.strip()
        if len(q) < 2:
            return []
        with self._conn() as c:
            rows = c.execute(
                """SELECT name, city, state, board FROM schools
                   WHERE name LIKE ? COLLATE NOCASE
                   ORDER BY CASE WHEN name LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,
                            length(name)
                   LIMIT ?""",
                (f"%{q}%", f"{q}%", limit),
            ).fetchall()
        return [dict(r) for r in rows]
