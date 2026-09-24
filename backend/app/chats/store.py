"""Server-side conversation history (SQLite).

Privacy by design (CLAUDE.md §12): every row is owned by a user_email, and every
query is scoped to the caller's email — a user can only ever touch their OWN
chats. There is deliberately NO "read any user's messages" path, so an admin
cannot inspect student conversations. Messages are stored as a JSON blob (the
frontend already models a chat as {id, title, messages}).
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from app.config.db_path import get_db_path


class ConversationStore:
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
                """CREATE TABLE IF NOT EXISTS conversations (
                    id         TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    title      TEXT NOT NULL,
                    messages   TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )"""
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_conv_user "
                "ON conversations(user_email, updated_at DESC)"
            )

    def list(self, user_email: str) -> list[dict]:
        """Lightweight list (no message bodies) for the sidebar."""
        with self._conn() as c:
            rows = c.execute(
                "SELECT id, title, updated_at FROM conversations "
                "WHERE user_email = ? ORDER BY updated_at DESC",
                (user_email.lower(),),
            ).fetchall()
        return [
            {"id": r["id"], "title": r["title"], "updated_at": r["updated_at"]}
            for r in rows
        ]

    def get(self, user_email: str, cid: str) -> dict | None:
        with self._conn() as c:
            r = c.execute(
                "SELECT * FROM conversations WHERE id = ? AND user_email = ?",
                (cid, user_email.lower()),
            ).fetchone()
        if not r:
            return None
        return {
            "id": r["id"],
            "title": r["title"],
            "messages": json.loads(r["messages"]),
            "updated_at": r["updated_at"],
        }

    def upsert(
        self, user_email: str, cid: str, title: str, messages: list[dict]
    ) -> bool:
        """Create or update a chat. Returns False if the id belongs to someone
        else (never lets one user overwrite another's chat)."""
        email = user_email.lower()
        now = time.time()
        with self._conn() as c:
            owner = c.execute(
                "SELECT user_email FROM conversations WHERE id = ?", (cid,)
            ).fetchone()
            if owner and owner["user_email"] != email:
                return False
            c.execute(
                """INSERT INTO conversations
                       (id, user_email, title, messages, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       title = excluded.title,
                       messages = excluded.messages,
                       updated_at = excluded.updated_at""",
                (cid, email, title, json.dumps(messages), now, now),
            )
        return True

    def delete(self, user_email: str, cid: str) -> bool:
        with self._conn() as c:
            cur = c.execute(
                "DELETE FROM conversations WHERE id = ? AND user_email = ?",
                (cid, user_email.lower()),
            )
        return cur.rowcount > 0
