"""Learned-improvement memory for the self-improvement (RSI) loop.

When a student marks an answer unhelpful, the tutor critiques its own failure and
writes a short *directive* for doing better. Those directives are stored here,
scoped to (user, topic), and injected into that student's future prompts — so the
agent measurably improves its behaviour over time.

Scoping to the individual user is deliberate: it personalises the tutor AND
contains the blast radius (one person's feedback can't degrade everyone's answers
— a real risk with naive global feedback loops).
"""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from app.config.db_path import get_db_path


class ImprovementStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = str(db_path or get_db_path("tark.db"))
        self._init_db()

    @contextmanager
    def _conn(self):
        c = sqlite3.connect(self.db_path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def _init_db(self) -> None:
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS improvements (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_key   TEXT NOT NULL,
                    scope      TEXT NOT NULL,
                    directive  TEXT NOT NULL,
                    question   TEXT,
                    created_at REAL NOT NULL
                )"""
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_impr "
                "ON improvements(user_key, scope, created_at DESC)"
            )

    def add(
        self, user_key: str, scope: str, directive: str, question: str | None = None
    ) -> None:
        with self._conn() as c:
            c.execute(
                "INSERT INTO improvements(user_key, scope, directive, question, created_at)"
                " VALUES(?, ?, ?, ?, ?)",
                (user_key, scope, directive, question, time.time()),
            )

    def replace(self, user_key: str, scope: str, directives: list[str]) -> None:
        """Swap all of a (user, scope)'s directives for a consolidated set — the
        smart Improver uses this to keep the memory compact and generalized."""
        with self._conn() as c:
            c.execute(
                "DELETE FROM improvements WHERE user_key = ? AND scope = ?",
                (user_key, scope),
            )
            now = time.time()
            for d in directives:
                c.execute(
                    "INSERT INTO improvements(user_key, scope, directive, question, created_at)"
                    " VALUES(?, ?, ?, ?, ?)",
                    (user_key, scope, d, None, now),
                )

    def for_context(self, user_key: str, scope: str, limit: int = 4) -> list[str]:
        """The most recent directives this user's feedback taught us for a topic."""
        with self._conn() as c:
            rows = c.execute(
                "SELECT directive FROM improvements WHERE user_key = ? AND scope = ? "
                "ORDER BY created_at DESC LIMIT ?",
                (user_key, scope, limit),
            ).fetchall()
        return [r["directive"] for r in rows]

    def count(self, user_key: str) -> int:
        with self._conn() as c:
            return c.execute(
                "SELECT COUNT(*) FROM improvements WHERE user_key = ?", (user_key,)
            ).fetchone()[0]
