"""Minimal Supabase access for Phase 0 (CLAUDE.md §5).

Scope: a client plus a tiny ``sessions`` table helper. If Supabase isn't
configured (no URL/key), this degrades to a no-op so the core teaching loop
still runs locally without a database.

TODO(Phase 2): the full relational learner model — mastery, struggles, and the
spaced-repetition schedule.
TODO(Phase 4): enable Row-Level Security and per-user policies (CLAUDE.md §12).
The backend currently uses the service_role key, which bypasses RLS by design;
that is acceptable only while there is no per-user auth.
"""
from __future__ import annotations

from app.config.settings import Settings

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover - supabase import is optional in Phase 0
    Client = None  # type: ignore[assignment,misc]
    create_client = None  # type: ignore[assignment]


class SessionStore:
    """Best-effort session recorder. Never blocks the teaching loop on the DB."""

    def __init__(self, settings: Settings) -> None:
        self._client = None
        if settings.supabase_url and settings.supabase_service_key and create_client:
            try:
                self._client = create_client(
                    settings.supabase_url, settings.supabase_service_key
                )
            except Exception:
                self._client = None  # degrade gracefully

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def create_session(self, mode: str) -> str | None:
        """Insert a session row and return its id, or None if the DB is off.

        This is a synchronous Supabase call; callers run it off the event loop
        (e.g. via Starlette's ``run_in_threadpool``).
        """
        if not self._client:
            return None
        try:
            res = self._client.table("sessions").insert({"mode": mode}).execute()
            rows = res.data or []
            return rows[0].get("id") if rows else None
        except Exception:
            return None  # a DB hiccup must never break a lesson
