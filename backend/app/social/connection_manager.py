"""SocialConnectionManager: In-memory WebSocket manager for real-time messaging, typing events, and online status."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("tark.social.ws")


class SocialConnectionManager:
    def __init__(self) -> None:
        # Maps user_id -> set of active WebSockets (user might have multiple tabs open)
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = set()
            self._connections[user_id].add(websocket)
            is_first = len(self._connections[user_id]) == 1

        logger.info("Social WS: user %s connected (total sockets: %d)", user_id, len(self._connections[user_id]))
        if is_first:
            # Broadcast presence online
            await self.broadcast_presence(user_id, "online")

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            if user_id in self._connections:
                self._connections[user_id].discard(websocket)
                if not self._connections[user_id]:
                    del self._connections[user_id]
                    is_last = True
                else:
                    is_last = False
            else:
                is_last = False

        logger.info("Social WS: user %s disconnected (remaining: %d)", user_id, len(self._connections.get(user_id, set())))
        if is_last:
            # Broadcast presence offline
            await self.broadcast_presence(user_id, "offline")

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    async def send_personal_message(self, user_id: int, payload: dict[str, Any]) -> None:
        """Send message directly to all active connections of a user."""
        sockets = list(self._connections.get(user_id, set()))
        if not sockets:
            return

        text = json.dumps(payload)
        dead = []
        for ws in sockets:
            try:
                await ws.send_text(text)
            except Exception as e:
                logger.debug("Failed to send to user %s: %s", user_id, e)
                dead.append(ws)

        if dead:
            async with self._lock:
                for d in dead:
                    self._connections.get(user_id, set()).discard(d)

    async def broadcast_to_users(self, user_ids: list[int], payload: dict[str, Any]) -> None:
        """Broadcast an event (like new_message) to specified user IDs."""
        tasks = [self.send_personal_message(uid, payload) for uid in user_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_presence(self, user_id: int, status: str) -> None:
        """Notify all connected users about presence change."""
        payload = {
            "type": "presence",
            "user_id": user_id,
            "status": status,
        }
        # Gather all connected users
        all_uids = list(self._connections.keys())
        await self.broadcast_to_users(all_uids, payload)

    async def broadcast_typing(
        self,
        channel_id: str,
        sender_id: int,
        sender_username: str,
        target_user_ids: list[int],
    ) -> None:
        """Relay typing indicator to other channel members."""
        payload = {
            "type": "typing",
            "channel_id": channel_id,
            "user_id": sender_id,
            "username": sender_username,
        }
        recipients = [uid for uid in target_user_ids if uid != sender_id]
        await self.broadcast_to_users(recipients, payload)
