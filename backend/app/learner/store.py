"""The adaptive learner model (CLAUDE.md §3 — "it adapts").

Tracks each student's mastery per TOPIC (a textbook chapter). Every interaction
nudges a simple, interpretable `strength` score (0-1): engaging with a topic
raises it a little, struggling with it (a 👎 or "explain simpler") lowers it more.
Acharya reads this to teach weak topics more carefully, and it powers a
"due for revision" list (spaced repetition).

Scoped per user — a learner model is inherently personal.
"""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from app.config.db_path import get_db_path

START_STRENGTH = 0.5
UP = 0.12          # a clean interaction nudges mastery up
DOWN = 0.22        # a struggle drops it more (harder to gain than lose — realistic)
REVISION_AGE = 3 * 86_400  # seconds since last seen before a weak topic is "due"
REVISION_STRENGTH = 0.7    # topics below this can come due for revision


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


class LearnerStore:
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
                """CREATE TABLE IF NOT EXISTS mastery (
                    user_key    TEXT NOT NULL,
                    topic_key   TEXT NOT NULL,
                    topic_label TEXT NOT NULL,
                    strength    REAL NOT NULL,
                    struggles   INTEGER NOT NULL DEFAULT 0,
                    exposures   INTEGER NOT NULL DEFAULT 0,
                    last_seen   REAL NOT NULL,
                    PRIMARY KEY (user_key, topic_key)
                )"""
            )

    def get(self, user_key: str, topic_key: str) -> sqlite3.Row | None:
        with self._conn() as c:
            return c.execute(
                "SELECT * FROM mastery WHERE user_key = ? AND topic_key = ?",
                (user_key, topic_key),
            ).fetchone()

    def record(
        self, user_key: str, topic_key: str, topic_label: str, *, struggled: bool
    ) -> None:
        """Log one interaction with a topic and update its mastery."""
        now = time.time()
        with self._conn() as c:
            row = c.execute(
                "SELECT strength, struggles, exposures FROM mastery "
                "WHERE user_key = ? AND topic_key = ?",
                (user_key, topic_key),
            ).fetchone()
            strength = (row["strength"] if row else START_STRENGTH)
            strength = _clamp(strength + (-DOWN if struggled else UP))
            struggles = (row["struggles"] if row else 0) + (1 if struggled else 0)
            exposures = (row["exposures"] if row else 0) + 1
            c.execute(
                """INSERT INTO mastery
                       (user_key, topic_key, topic_label, strength, struggles,
                        exposures, last_seen)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_key, topic_key) DO UPDATE SET
                       topic_label = excluded.topic_label,
                       strength = excluded.strength,
                       struggles = excluded.struggles,
                       exposures = excluded.exposures,
                       last_seen = excluded.last_seen""",
                (user_key, topic_key, topic_label, strength, struggles, exposures, now),
            )

    def summary(self, user_key: str, now: float | None = None) -> list[dict]:
        """All topics for the learner, with mastery and a due-for-revision flag."""
        now = now if now is not None else time.time()
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM mastery WHERE user_key = ? ORDER BY strength ASC, last_seen ASC",
                (user_key,),
            ).fetchall()
        out = []
        for r in rows:
            due = (
                r["strength"] < REVISION_STRENGTH
                and (now - r["last_seen"]) > REVISION_AGE
            )
            out.append({
                "topic": r["topic_label"],
                "strength": round(r["strength"], 2),
                "struggles": r["struggles"],
                "exposures": r["exposures"],
                "last_seen": r["last_seen"],
                "due_for_revision": due,
            })
        return out
