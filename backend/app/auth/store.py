"""SQLite-backed user store (stdlib only — no external DB, no dashboard setup).

One table holds the account plus the pending verification code. The DB file
lives next to the backend and persists across restarts.
"""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from app.config.db_path import get_db_path


@dataclass
class User:
    id: int
    username: str
    email: str
    verified: bool


class UserStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = str(db_path or get_db_path("tark.db"))
        self._init_db()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._conn() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    username      TEXT NOT NULL,
                    email         TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    salt          TEXT NOT NULL,
                    verified      INTEGER NOT NULL DEFAULT 0,
                    code          TEXT,
                    code_expires  REAL,
                    created_at    REAL NOT NULL
                )
                """
            )
            # Migrate: add profile columns if missing.
            cols = {r["name"] for r in c.execute("PRAGMA table_info(users)")}
            for col in (
                "board",
                "grade",
                "school",
                "exam",
                "tutoring_style",
                "language",
                "weak_subjects",
                "goal",
            ):
                if col not in cols:
                    c.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT")

    # --- queries ---
    def get_by_email(self, email: str) -> sqlite3.Row | None:
        with self._conn() as c:
            cur = c.execute(
                "SELECT * FROM users WHERE email = ?", (email.lower(),)
            )
            return cur.fetchone()

    def get_by_id(self, user_id: int) -> sqlite3.Row | None:
        with self._conn() as c:
            cur = c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            return cur.fetchone()

    def username_taken(self, username: str, *, exclude_email: str | None = None) -> bool:
        """True if another account already uses this username (case-insensitive)."""
        with self._conn() as c:
            if exclude_email:
                cur = c.execute(
                    "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE "
                    "AND email != ? LIMIT 1",
                    (username.strip(), exclude_email.lower()),
                )
            else:
                cur = c.execute(
                    "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE LIMIT 1",
                    (username.strip(),),
                )
            return cur.fetchone() is not None

    def get_by_login(self, identifier: str) -> sqlite3.Row | None:
        """Look up a user by EITHER email or username (for login)."""
        ident = identifier.strip()
        with self._conn() as c:
            cur = c.execute(
                "SELECT * FROM users WHERE email = ? OR username = ? COLLATE NOCASE "
                "LIMIT 1",
                (ident.lower(), ident),
            )
            return cur.fetchone()

    def create_unverified(
        self,
        *,
        username: str,
        email: str,
        password_hash: str,
        salt: str,
        code: str,
        code_ttl_seconds: int,
    ) -> None:
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO users
                    (username, email, password_hash, salt, verified, code,
                     code_expires, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?, ?)
                """,
                (
                    username,
                    email.lower(),
                    password_hash,
                    salt,
                    code,
                    time.time() + code_ttl_seconds,
                    time.time(),
                ),
            )

    def set_code(self, email: str, code: str, code_ttl_seconds: int) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE users SET code = ?, code_expires = ? WHERE email = ?",
                (code, time.time() + code_ttl_seconds, email.lower()),
            )

    def mark_verified(self, email: str) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE users SET verified = 1, code = NULL, code_expires = NULL "
                "WHERE email = ?",
                (email.lower(),),
            )

    def set_password(self, email: str, password_hash: str, salt: str) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE users SET password_hash = ?, salt = ?, code = NULL, "
                "code_expires = NULL WHERE email = ?",
                (password_hash, salt, email.lower()),
            )

    def update_profile(
        self,
        email: str,
        *,
        board: str | None,
        grade: str | None,
        school: str | None,
        exam: str | None = None,
        tutoring_style: str | None = None,
        language: str | None = None,
        weak_subjects: str | None = None,
        goal: str | None = None,
    ) -> None:
        with self._conn() as c:
            c.execute(
                """
                UPDATE users SET
                    board = ?,
                    grade = ?,
                    school = ?,
                    exam = ?,
                    tutoring_style = ?,
                    language = ?,
                    weak_subjects = ?,
                    goal = ?
                WHERE email = ?
                """,
                (
                    board,
                    grade,
                    school,
                    exam,
                    tutoring_style,
                    language,
                    weak_subjects,
                    goal,
                    email.lower(),
                ),
            )

    def delete_by_email(self, email: str) -> None:
        with self._conn() as c:
            c.execute("DELETE FROM users WHERE email = ?", (email.lower(),))
