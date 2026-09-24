"""SQLite-backed store for student study schedules, roadmaps, and task milestones.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from app.config.db_path import get_db_path


class TaskStore:
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
                CREATE TABLE IF NOT EXISTS study_tasks (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_key     TEXT NOT NULL,
                    track        TEXT NOT NULL,
                    title        TEXT NOT NULL,
                    details      TEXT NOT NULL,
                    milestones   TEXT NOT NULL,
                    status       TEXT NOT NULL DEFAULT 'active',
                    created_at   REAL NOT NULL,
                    updated_at   REAL NOT NULL
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_study_tasks_user ON study_tasks(user_key, status)"
            )

    def _format_row(self, row: sqlite3.Row) -> dict[str, Any]:
        details = {}
        try:
            details = json.loads(row["details"])
        except Exception:
            pass

        milestones = []
        try:
            milestones = json.loads(row["milestones"])
        except Exception:
            pass

        return {
            "id": row["id"],
            "user_key": row["user_key"],
            "track": row["track"],
            "title": row["title"],
            "details": details,
            "milestones": milestones,
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def create_task(
        self,
        *,
        user_key: str,
        track: str,
        title: str,
        details: dict[str, Any],
        milestones: list[dict[str, Any]],
    ) -> dict[str, Any]:
        now = time.time()
        details_json = json.dumps(details, ensure_ascii=False)
        milestones_json = json.dumps(milestones, ensure_ascii=False)

        with self._conn() as c:
            # Check for an existing task with same track and matching subject/exam/title
            rows = c.execute(
                "SELECT id, title, details FROM study_tasks WHERE user_key = ? AND track = ? AND status = 'active'",
                (user_key.lower(), track),
            ).fetchall()

            existing_id = None
            new_subject = str(details.get("subject") or details.get("exam_name") or "").strip().lower()

            for r in rows:
                if r["title"].strip().lower() == title.strip().lower():
                    existing_id = r["id"]
                    break
                try:
                    r_details = json.loads(r["details"])
                    r_subj = str(r_details.get("subject") or r_details.get("exam_name") or "").strip().lower()
                    if new_subject and r_subj and new_subject == r_subj:
                        existing_id = r["id"]
                        break
                except Exception:
                    pass

            if existing_id is not None:
                c.execute(
                    """
                    UPDATE study_tasks
                    SET title = ?, details = ?, milestones = ?, status = 'active', updated_at = ?
                    WHERE id = ?
                    """,
                    (title, details_json, milestones_json, now, existing_id),
                )
                row = c.execute("SELECT * FROM study_tasks WHERE id = ?", (existing_id,)).fetchone()
                return self._format_row(row)

            cur = c.execute(
                """
                INSERT INTO study_tasks (user_key, track, title, details, milestones, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_key.lower(), track, title, details_json, milestones_json, now, now),
            )
            task_id = cur.lastrowid
            row = c.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
            return self._format_row(row)

    def list_tasks(
        self,
        user_key: str,
        anon_id: str | None = None,
        is_admin: bool = False,
    ) -> list[dict[str, Any]]:
        with self._conn() as c:
            if is_admin:
                cur = c.execute("SELECT * FROM study_tasks WHERE status != 'archived' ORDER BY created_at DESC")
            elif anon_id and anon_id.lower() != user_key.lower():
                cur = c.execute(
                    "SELECT * FROM study_tasks WHERE (user_key = ? OR user_key = ?) AND status != 'archived' ORDER BY created_at DESC",
                    (user_key.lower(), anon_id.lower()),
                )
            else:
                cur = c.execute(
                    "SELECT * FROM study_tasks WHERE user_key = ? AND status != 'archived' ORDER BY created_at DESC",
                    (user_key.lower(),),
                )
            return [self._format_row(r) for r in cur.fetchall()]

    def get_task(
        self,
        task_id: int,
        user_key: str,
        is_admin: bool = False,
        anon_id: str | None = None,
    ) -> dict[str, Any] | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                return None
            if is_admin:
                return self._format_row(row)
            task_owner = str(row["user_key"]).lower()
            if (
                task_owner == user_key.lower()
                or (anon_id and task_owner == anon_id.lower())
                or task_owner.startswith("anon_")
            ):
                return self._format_row(row)
            return None

    def toggle_milestone(
        self,
        task_id: int,
        user_key: str,
        milestone_id: str,
        completed: bool | None = None,
        is_admin: bool = False,
        anon_id: str | None = None,
    ) -> dict[str, Any] | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                return None

            task_owner = str(row["user_key"]).lower()
            if not (
                is_admin
                or task_owner == user_key.lower()
                or (anon_id and task_owner == anon_id.lower())
                or task_owner.startswith("anon_")
            ):
                return None

            try:
                milestones = json.loads(row["milestones"])
            except Exception:
                milestones = []

            found = False
            for m in milestones:
                if str(m.get("id")) == str(milestone_id):
                    found = True
                    if completed is None:
                        m["completed"] = not bool(m.get("completed"))
                    else:
                        m["completed"] = completed
                    break

            if not found:
                return None

            now = time.time()
            all_done = bool(milestones) and all(m.get("completed") for m in milestones)
            new_status = "completed" if all_done else "active"

            c.execute(
                """
                UPDATE study_tasks
                SET milestones = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (json.dumps(milestones, ensure_ascii=False), new_status, now, task_id),
            )
            updated = c.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
            return self._format_row(updated)

    def delete_task(
        self,
        task_id: int,
        user_key: str,
        is_admin: bool = False,
        anon_id: str | None = None,
    ) -> bool:
        with self._conn() as c:
            row = c.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                return True  # Already deleted

            task_owner = str(row["user_key"]).lower()
            req_user = str(user_key).lower()
            req_anon = str(anon_id or "").lower()

            allowed = (
                is_admin
                or task_owner == req_user
                or (req_anon and task_owner == req_anon)
                or task_owner.startswith("anon_")
            )

            if not allowed:
                return False

            c.execute("DELETE FROM study_tasks WHERE id = ?", (task_id,))
            return True
