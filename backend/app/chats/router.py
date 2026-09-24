"""Chat-history API. Every endpoint derives the owner from the Bearer token —
never from the client — so a user can only read/write their own conversations.
No admin-inspection path exists by design (CLAUDE.md §12)."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.auth.security import decode_token
from app.chats.store import ConversationStore
from app.config.settings import Settings


class Msg(BaseModel):
    role: str
    content: str
    at: float | None = None
    sources: list[str] | None = None
    image: str | None = None  # attached photo or rendered figure (data URL)


class ConvUpsert(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    messages: list[Msg]


def create_chats_router(settings: Settings, store: ConversationStore) -> APIRouter:
    router = APIRouter(prefix="/chats", tags=["chats"])

    def _email(authorization: str | None) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Sign in to sync your chats.")
        payload = decode_token(authorization.split(" ", 1)[1], settings.token_secret)
        if not payload or not payload.get("email"):
            raise HTTPException(401, "Invalid or expired session.")
        return str(payload["email"])

    @router.get("")
    def list_chats(authorization: str | None = Header(default=None)) -> dict:
        return {"chats": store.list(_email(authorization))}

    @router.get("/{cid}")
    def get_chat(cid: str, authorization: str | None = Header(default=None)) -> dict:
        conv = store.get(_email(authorization), cid)
        if not conv:
            raise HTTPException(404, "Chat not found.")
        return conv

    @router.put("/{cid}")
    def put_chat(
        cid: str, body: ConvUpsert, authorization: str | None = Header(default=None)
    ) -> dict:
        ok = store.upsert(
            _email(authorization), cid, body.title,
            [m.model_dump() for m in body.messages],
        )
        if not ok:
            raise HTTPException(403, "This chat belongs to another account.")
        return {"ok": True}

    @router.delete("/{cid}")
    def delete_chat(
        cid: str, authorization: str | None = Header(default=None)
    ) -> dict:
        store.delete(_email(authorization), cid)
        return {"ok": True}

    return router
