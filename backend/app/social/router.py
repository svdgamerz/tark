"""Social API: Friend requests, 1-on-1 Direct Messages, Study Doubt Circles, and WebSocket real-time sync."""
from __future__ import annotations

import json
import logging
from typing import Any
from fastapi import APIRouter, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.auth.security import decode_token
from app.auth.store import UserStore
from app.config.settings import Settings
from app.social.connection_manager import SocialConnectionManager
from app.social.store import SocialStore

logger = logging.getLogger("tark.social")


class FriendRequestReq(BaseModel):
    to_user_id: int


class FriendResponseReq(BaseModel):
    other_user_id: int
    accept: bool


class CreateDirectReq(BaseModel):
    other_user_id: int


class CreateGroupReq(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    member_ids: list[int] = Field(min_length=1)


class SendMessageReq(BaseModel):
    content: str = Field(min_length=1)
    msg_type: str = Field(default="text")  # 'text' | 'doubt_share' | 'image'
    metadata: dict[str, Any] | None = None


class TypingReq(BaseModel):
    channel_id: str


def create_social_router(
    settings: Settings,
    social_store: SocialStore,
    user_store: UserStore,
    ws_manager: SocialConnectionManager,
) -> APIRouter:
    router = APIRouter(prefix="/social", tags=["social"])

    def _auth_user(authorization: str | None) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Missing authentication token.")
        token = authorization.split(" ", 1)[1]
        payload = decode_token(token, settings.token_secret)
        if not payload:
            raise HTTPException(401, "Invalid or expired token.")
        user_id = int(payload.get("sub", 0))
        user_row = user_store.get_by_id(user_id)
        if not user_row:
            raise HTTPException(404, "User account not found.")
        return dict(user_row)

    # -------------------------------------------------------------------------
    # Friend Requests & Search
    # -------------------------------------------------------------------------

    @router.get("/users/search")
    def search_users(
        q: str = Query(default="", min_length=1),
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        users = social_store.search_users(q, u["id"])
        # Annotate online status
        for item in users:
            item["is_online"] = ws_manager.is_online(item["id"])
        return {"users": users}

    @router.post("/friends/request")
    async def send_friend_request(
        req: FriendRequestReq,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        target = user_store.get_by_id(req.to_user_id)
        if not target:
            raise HTTPException(404, "Student not found.")

        res = social_store.send_friend_request(u["id"], req.to_user_id)
        if not res.get("ok"):
            raise HTTPException(400, res.get("error", "Failed to send friend request"))

        # Notify target student via WebSocket if online
        asyncio_notify_req = {
            "type": "friend_request_update",
            "from_user": {
                "id": u["id"],
                "username": u["username"],
                "board": u.get("board"),
                "grade": u.get("grade"),
            },
            "status": res.get("status"),
        }
        await ws_manager.send_personal_message(req.to_user_id, asyncio_notify_req)
        return res

    @router.post("/friends/respond")
    async def respond_friend_request(
        req: FriendResponseReq,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        res = social_store.respond_friend_request(u["id"], req.other_user_id, req.accept)
        if not res.get("ok"):
            raise HTTPException(400, res.get("error", "Failed to process friend request"))

        # Notify requester of decision
        await ws_manager.send_personal_message(
            req.other_user_id,
            {
                "type": "friend_response_update",
                "from_user": {"id": u["id"], "username": u["username"]},
                "status": res.get("status"),
            },
        )
        return res

    @router.get("/friends")
    def list_friends(authorization: str | None = Header(default=None)) -> dict:
        u = _auth_user(authorization)
        friends = social_store.list_friends(u["id"])
        for f in friends:
            f["is_online"] = ws_manager.is_online(f["id"])
        pending = social_store.list_pending_requests(u["id"])
        return {"friends": friends, "pending": pending}

    # -------------------------------------------------------------------------
    # Channels (1-on-1 DMs & Study Group Circles)
    # -------------------------------------------------------------------------

    @router.get("/channels")
    def list_channels(authorization: str | None = Header(default=None)) -> dict:
        u = _auth_user(authorization)
        channels = social_store.list_channels(u["id"])
        for ch in channels:
            if ch.get("dm_peer"):
                ch["dm_peer"]["is_online"] = ws_manager.is_online(ch["dm_peer"]["id"])
        return {"channels": channels}

    @router.post("/channels/direct")
    def get_or_create_direct_channel(
        req: CreateDirectReq,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        res = social_store.get_or_create_direct_channel(u["id"], req.other_user_id)
        if not res.get("ok"):
            raise HTTPException(400, res.get("error", "Failed to open direct channel"))
        return res

    @router.post("/channels/group")
    async def create_group_channel(
        req: CreateGroupReq,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        res = social_store.create_group_channel(req.name, u["id"], req.member_ids)
        if not res.get("ok"):
            raise HTTPException(400, res.get("error", "Failed to create study group"))

        # Broadcast group creation to members
        await ws_manager.broadcast_to_users(
            req.member_ids,
            {
                "type": "channel_created",
                "channel_id": res["channel_id"],
                "name": res["name"],
                "creator": u["username"],
            },
        )
        return res

    @router.get("/channels/{channel_id}")
    def get_channel(
        channel_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        chan = social_store.get_channel(channel_id, u["id"])
        if not chan:
            raise HTTPException(404, "Channel not found or you are not a member")
        for m in chan["members"]:
            m["is_online"] = ws_manager.is_online(m["id"])
        return {"channel": chan}

    # -------------------------------------------------------------------------
    # Messages
    # -------------------------------------------------------------------------

    @router.get("/channels/{channel_id}/messages")
    def get_channel_messages(
        channel_id: str,
        limit: int = Query(default=50, ge=1, le=100),
        before: float | None = Query(default=None),
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        messages = social_store.get_channel_messages(channel_id, u["id"], limit, before)
        # Mark as read
        social_store.mark_channel_read(channel_id, u["id"])
        return {"messages": messages}

    @router.post("/channels/{channel_id}/messages")
    async def post_message(
        channel_id: str,
        req: SendMessageReq,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        res = social_store.post_message(
            channel_id=channel_id,
            sender_id=u["id"],
            sender_username=u["username"],
            content=req.content,
            msg_type=req.msg_type,
            metadata=req.metadata,
        )
        if not res.get("ok"):
            raise HTTPException(400, res.get("error", "Failed to send message"))

        # Broadcast via WebSocket to other channel members (sender already receives response via HTTP)
        member_ids = social_store.get_channel_member_ids(channel_id)
        other_member_ids = [m for m in member_ids if m != u["id"]]
        await ws_manager.broadcast_to_users(
            other_member_ids,
            {
                "type": "new_message",
                "channel_id": channel_id,
                "message": res["message"],
            },
        )
        return res

    @router.post("/channels/{channel_id}/read")
    def mark_read(
        channel_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        social_store.mark_channel_read(channel_id, u["id"])
        return {"ok": True}

    @router.post("/channels/{channel_id}/typing")
    async def report_typing(
        channel_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict:
        u = _auth_user(authorization)
        member_ids = social_store.get_channel_member_ids(channel_id)
        await ws_manager.broadcast_typing(
            channel_id=channel_id,
            sender_id=u["id"],
            sender_username=u["username"],
            target_user_ids=member_ids,
        )
        return {"ok": True}

    # -------------------------------------------------------------------------
    # Real-time WebSocket Endpoint
    # -------------------------------------------------------------------------

    @router.websocket("/ws")
    async def social_websocket(websocket: WebSocket, token: str = Query(default="")):
        if not token:
            await websocket.close(code=4001, reason="Missing auth token")
            return

        payload = decode_token(token, settings.token_secret)
        if not payload:
            await websocket.close(code=4002, reason="Invalid token")
            return

        user_id = int(payload.get("sub", 0))
        user_row = user_store.get_by_id(user_id)
        if not user_row:
            await websocket.close(code=4003, reason="User not found")
            return

        username = user_row["username"]
        await ws_manager.connect(user_id, websocket)

        try:
            while True:
                data_text = await websocket.receive_text()
                try:
                    data = json.loads(data_text)
                except Exception:
                    continue

                msg_type = data.get("type")
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif msg_type == "typing":
                    cid = data.get("channel_id")
                    if cid:
                        member_ids = social_store.get_channel_member_ids(cid)
                        await ws_manager.broadcast_typing(
                            channel_id=cid,
                            sender_id=user_id,
                            sender_username=username,
                            target_user_ids=member_ids,
                        )
                elif msg_type == "read":
                    cid = data.get("channel_id")
                    if cid:
                        social_store.mark_channel_read(cid, user_id)
        except WebSocketDisconnect:
            await ws_manager.disconnect(user_id, websocket)
        except Exception as e:
            logger.debug("Social WS error for user %s: %s", user_id, e)
            await ws_manager.disconnect(user_id, websocket)

    return router
