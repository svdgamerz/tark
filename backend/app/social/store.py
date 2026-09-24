"""SocialStore: SQLite data access layer for Tark student friends, 1-on-1 DMs, and study circles."""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from app.config.db_path import get_db_path


class SocialStore:
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
            # 1. Friendships table
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS friendships (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id_1    INTEGER NOT NULL,
                    user_id_2    INTEGER NOT NULL,
                    requester_id INTEGER NOT NULL,
                    status       TEXT NOT NULL DEFAULT 'pending',
                    created_at   REAL NOT NULL,
                    updated_at   REAL NOT NULL,
                    UNIQUE(user_id_1, user_id_2)
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id_1, user_id_2)"
            )

            # 2. Social channels (1-on-1 DMs or Study Group Circles)
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS social_channels (
                    id         TEXT PRIMARY KEY,
                    type       TEXT NOT NULL, -- 'direct' | 'group'
                    name       TEXT,          -- group title (null for direct)
                    created_by INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_social_channels_updated ON social_channels(updated_at DESC)"
            )

            # 3. Channel members
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS social_channel_members (
                    channel_id   TEXT NOT NULL,
                    user_id      INTEGER NOT NULL,
                    role         TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
                    joined_at    REAL NOT NULL,
                    last_read_at REAL NOT NULL DEFAULT 0,
                    PRIMARY KEY (channel_id, user_id)
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_channel_members_user ON social_channel_members(user_id)"
            )

            # 4. Social messages
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS social_messages (
                    id              TEXT PRIMARY KEY,
                    channel_id      TEXT NOT NULL,
                    sender_id       INTEGER NOT NULL,
                    sender_username TEXT NOT NULL,
                    content         TEXT NOT NULL,
                    msg_type        TEXT NOT NULL DEFAULT 'text', -- 'text' | 'doubt_share' | 'image'
                    metadata_json   TEXT,
                    created_at      REAL NOT NULL
                )
                """
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_social_messages_chan ON social_messages(channel_id, created_at ASC)"
            )

    # =========================================================================
    # User Search & Friend Requests
    # =========================================================================

    def search_users(self, query: str, current_user_id: int, limit: int = 15) -> list[dict]:
        """Search students by username or email (excluding current user)."""
        q = f"%{query.strip().lower()}%"
        if not query.strip():
            return []

        with self._conn() as c:
            users_cur = c.execute(
                """
                SELECT id, username, email, board, grade, school
                FROM users
                WHERE (LOWER(username) LIKE ? OR LOWER(email) LIKE ?)
                  AND id != ?
                LIMIT ?
                """,
                (q, q, current_user_id, limit),
            )
            users = [dict(u) for u in users_cur.fetchall()]

            results = []
            for u in users:
                # check friendship status
                u1, u2 = min(current_user_id, u["id"]), max(current_user_id, u["id"])
                f_cur = c.execute(
                    "SELECT requester_id, status FROM friendships WHERE user_id_1 = ? AND user_id_2 = ?",
                    (u1, u2),
                )
                f_row = f_cur.fetchone()
                if not f_row:
                    rel_status = "none"
                elif f_row["status"] == "accepted":
                    rel_status = "friends"
                elif f_row["status"] == "pending":
                    rel_status = "pending_sent" if f_row["requester_id"] == current_user_id else "pending_received"
                else:
                    rel_status = f_row["status"]

                results.append(
                    {
                        "id": u["id"],
                        "username": u["username"],
                        "board": u.get("board"),
                        "grade": u.get("grade"),
                        "school": u.get("school"),
                        "friendship_status": rel_status,
                    }
                )
            return results

    def send_friend_request(self, from_user_id: int, to_user_id: int) -> dict:
        """Send or re-open a friend request."""
        if from_user_id == to_user_id:
            return {"ok": False, "error": "Cannot friend yourself"}

        u1, u2 = min(from_user_id, to_user_id), max(from_user_id, to_user_id)
        now = time.time()

        with self._conn() as c:
            cur = c.execute(
                "SELECT * FROM friendships WHERE user_id_1 = ? AND user_id_2 = ?",
                (u1, u2),
            )
            existing = cur.fetchone()
            if existing:
                if existing["status"] == "accepted":
                    return {"ok": True, "status": "already_friends"}
                if existing["status"] == "pending":
                    if existing["requester_id"] == from_user_id:
                        return {"ok": True, "status": "already_pending"}
                    # The other user had already requested friendship -> auto accept!
                    c.execute(
                        "UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?",
                        (now, existing["id"]),
                    )
                    # Create DM channel automatically
                    self._ensure_direct_channel(c, u1, u2, now)
                    return {"ok": True, "status": "accepted_mutual"}

                # declined or re-sending
                c.execute(
                    "UPDATE friendships SET status = 'pending', requester_id = ?, updated_at = ? WHERE id = ?",
                    (from_user_id, now, existing["id"]),
                )
                return {"ok": True, "status": "pending"}

            c.execute(
                """
                INSERT INTO friendships (user_id_1, user_id_2, requester_id, status, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', ?, ?)
                """,
                (u1, u2, from_user_id, now, now),
            )
            return {"ok": True, "status": "pending"}

    def respond_friend_request(self, user_id: int, other_user_id: int, accept: bool) -> dict:
        """Accept or decline a pending friend request."""
        u1, u2 = min(user_id, other_user_id), max(user_id, other_user_id)
        now = time.time()

        with self._conn() as c:
            cur = c.execute(
                "SELECT * FROM friendships WHERE user_id_1 = ? AND user_id_2 = ?",
                (u1, u2),
            )
            row = cur.fetchone()
            if not row:
                return {"ok": False, "error": "Friend request not found"}

            if row["requester_id"] == user_id:
                return {"ok": False, "error": "Cannot respond to your own outgoing request"}

            new_status = "accepted" if accept else "declined"
            c.execute(
                "UPDATE friendships SET status = ?, updated_at = ? WHERE id = ?",
                (new_status, now, row["id"]),
            )

            if accept:
                self._ensure_direct_channel(c, u1, u2, now)

            return {"ok": True, "status": new_status}

    def list_friends(self, user_id: int) -> list[dict]:
        """List all accepted friends for this user."""
        with self._conn() as c:
            cur = c.execute(
                """
                SELECT f.id as friendship_id, f.user_id_1, f.user_id_2, f.updated_at,
                       u.id as friend_id, u.username, u.board, u.grade, u.school
                FROM friendships f
                JOIN users u ON (u.id = CASE WHEN f.user_id_1 = ? THEN f.user_id_2 ELSE f.user_id_1 END)
                WHERE (f.user_id_1 = ? OR f.user_id_2 = ?)
                  AND f.status = 'accepted'
                ORDER BY u.username COLLATE NOCASE ASC
                """,
                (user_id, user_id, user_id),
            )
            rows = cur.fetchall()
            friends = []
            for r in rows:
                fid = r["friend_id"]
                u1, u2 = min(user_id, fid), max(user_id, fid)
                chan_id = f"dm_{u1}_{u2}"
                friends.append(
                    {
                        "id": fid,
                        "username": r["username"],
                        "board": r["board"],
                        "grade": r["grade"],
                        "school": r["school"],
                        "channel_id": chan_id,
                        "friends_since": r["updated_at"],
                    }
                )
            return friends

    def list_pending_requests(self, user_id: int) -> dict:
        """List incoming and outgoing pending friend requests."""
        with self._conn() as c:
            # Incoming requests (where requester is not self)
            in_cur = c.execute(
                """
                SELECT f.id as request_id, f.created_at,
                       u.id as user_id, u.username, u.board, u.grade, u.school
                FROM friendships f
                JOIN users u ON u.id = f.requester_id
                WHERE (f.user_id_1 = ? OR f.user_id_2 = ?)
                  AND f.status = 'pending'
                  AND f.requester_id != ?
                ORDER BY f.created_at DESC
                """,
                (user_id, user_id, user_id),
            )
            incoming = [dict(r) for r in in_cur.fetchall()]

            # Outgoing requests
            out_cur = c.execute(
                """
                SELECT f.id as request_id, f.created_at,
                       u.id as user_id, u.username, u.board, u.grade, u.school
                FROM friendships f
                JOIN users u ON u.id = (CASE WHEN f.user_id_1 = ? THEN f.user_id_2 ELSE f.user_id_1 END)
                WHERE f.requester_id = ?
                  AND f.status = 'pending'
                ORDER BY f.created_at DESC
                """,
                (user_id, user_id),
            )
            outgoing = [dict(r) for r in out_cur.fetchall()]

            return {"incoming": incoming, "outgoing": outgoing}

    # =========================================================================
    # Channels (1-on-1 DMs & Study Circles)
    # =========================================================================

    def _ensure_direct_channel(self, c: sqlite3.Connection, u1: int, u2: int, now: float) -> str:
        chan_id = f"dm_{u1}_{u2}"
        c.execute(
            """
            INSERT OR IGNORE INTO social_channels (id, type, name, created_by, created_at, updated_at)
            VALUES (?, 'direct', NULL, ?, ?, ?)
            """,
            (chan_id, u1, now, now),
        )
        c.execute(
            """
            INSERT OR IGNORE INTO social_channel_members (channel_id, user_id, role, joined_at, last_read_at)
            VALUES (?, ?, 'member', ?, ?)
            """,
            (chan_id, u1, now, now),
        )
        c.execute(
            """
            INSERT OR IGNORE INTO social_channel_members (channel_id, user_id, role, joined_at, last_read_at)
            VALUES (?, ?, 'member', ?, ?)
            """,
            (chan_id, u2, now, now),
        )
        return chan_id

    def get_or_create_direct_channel(self, user_id: int, other_user_id: int) -> dict:
        """Get or create a 1-on-1 DM channel between two users."""
        u1, u2 = min(user_id, other_user_id), max(user_id, other_user_id)
        now = time.time()
        with self._conn() as c:
            # Verify friendship is accepted or allow if already created
            f_cur = c.execute(
                "SELECT status FROM friendships WHERE user_id_1 = ? AND user_id_2 = ?",
                (u1, u2),
            )
            f_row = f_cur.fetchone()
            if not f_row or f_row["status"] != "accepted":
                return {"ok": False, "error": "You must be friends to message each other"}

            chan_id = self._ensure_direct_channel(c, u1, u2, now)
            return {"ok": True, "channel_id": chan_id}

    def create_group_channel(self, name: str, creator_id: int, member_ids: list[int]) -> dict:
        """Create a Study Group Circle with given name and member user IDs."""
        clean_name = name.strip()
        if not clean_name:
            return {"ok": False, "error": "Group name cannot be empty"}

        unique_members = list(set([creator_id] + [m for m in member_ids if m != creator_id]))
        if len(unique_members) < 2:
            return {"ok": False, "error": "A group study circle needs at least 2 students"}

        chan_id = f"grp_{uuid.uuid4().hex[:12]}"
        now = time.time()

        with self._conn() as c:
            c.execute(
                """
                INSERT INTO social_channels (id, type, name, created_by, created_at, updated_at)
                VALUES (?, 'group', ?, ?, ?, ?)
                """,
                (chan_id, clean_name, creator_id, now, now),
            )
            for uid in unique_members:
                role = "owner" if uid == creator_id else "member"
                c.execute(
                    """
                    INSERT INTO social_channel_members (channel_id, user_id, role, joined_at, last_read_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (chan_id, uid, role, now, now),
                )

        return {"ok": True, "channel_id": chan_id, "name": clean_name}

    def list_channels(self, user_id: int) -> list[dict]:
        """List all channels (DMs + Groups) the user belongs to, with unread count and latest message preview."""
        with self._conn() as c:
            cur = c.execute(
                """
                SELECT sc.id, sc.type, sc.name, sc.created_by, sc.updated_at,
                       scm.last_read_at, scm.role
                FROM social_channels sc
                JOIN social_channel_members scm ON scm.channel_id = sc.id
                WHERE scm.user_id = ?
                ORDER BY sc.updated_at DESC
                """,
                (user_id,),
            )
            channels_raw = [dict(r) for r in cur.fetchall()]

            channels = []
            for ch in channels_raw:
                cid = ch["id"]

                # Unread count
                unread_cur = c.execute(
                    """
                    SELECT COUNT(*) as unread_count
                    FROM social_messages
                    WHERE channel_id = ?
                      AND created_at > ?
                      AND sender_id != ?
                    """,
                    (cid, ch["last_read_at"], user_id),
                )
                unread = unread_cur.fetchone()["unread_count"]

                # Latest message
                last_msg_cur = c.execute(
                    """
                    SELECT sender_username, content, msg_type, created_at
                    FROM social_messages
                    WHERE channel_id = ?
                    ORDER BY created_at DESC LIMIT 1
                    """,
                    (cid,),
                )
                last_msg = last_msg_cur.fetchone()

                # For DM, find other member's info
                dm_peer = None
                if ch["type"] == "direct":
                    peer_cur = c.execute(
                        """
                        SELECT u.id, u.username, u.board, u.grade
                        FROM social_channel_members m
                        JOIN users u ON u.id = m.user_id
                        WHERE m.channel_id = ? AND m.user_id != ?
                        LIMIT 1
                        """,
                        (cid, user_id),
                    )
                    peer_row = peer_cur.fetchone()
                    if peer_row:
                        dm_peer = dict(peer_row)

                # For group, get member count
                member_count = 0
                if ch["type"] == "group":
                    cnt_cur = c.execute(
                        "SELECT COUNT(*) as cnt FROM social_channel_members WHERE channel_id = ?",
                        (cid,),
                    )
                    member_count = cnt_cur.fetchone()["cnt"]

                channels.append(
                    {
                        "id": cid,
                        "type": ch["type"],
                        "name": ch["name"],
                        "updated_at": ch["updated_at"],
                        "unread_count": unread,
                        "last_message": dict(last_msg) if last_msg else None,
                        "dm_peer": dm_peer,
                        "member_count": member_count,
                    }
                )
            return channels

    def get_channel(self, channel_id: str, user_id: int) -> dict | None:
        """Get channel details if user is a member."""
        with self._conn() as c:
            mem_cur = c.execute(
                "SELECT * FROM social_channel_members WHERE channel_id = ? AND user_id = ?",
                (channel_id, user_id),
            )
            membership = mem_cur.fetchone()
            if not membership:
                return None

            chan_cur = c.execute(
                "SELECT * FROM social_channels WHERE id = ?",
                (channel_id,),
            )
            chan = chan_cur.fetchone()
            if not chan:
                return None

            # Get all members
            members_cur = c.execute(
                """
                SELECT u.id, u.username, u.board, u.grade, m.role, m.joined_at
                FROM social_channel_members m
                JOIN users u ON u.id = m.user_id
                WHERE m.channel_id = ?
                """,
                (channel_id,),
            )
            members = [dict(m) for m in members_cur.fetchall()]

            return {
                "id": chan["id"],
                "type": chan["type"],
                "name": chan["name"],
                "created_by": chan["created_by"],
                "created_at": chan["created_at"],
                "updated_at": chan["updated_at"],
                "members": members,
            }

    def get_channel_member_ids(self, channel_id: str) -> list[int]:
        """List user IDs of all members in a channel."""
        with self._conn() as c:
            cur = c.execute(
                "SELECT user_id FROM social_channel_members WHERE channel_id = ?",
                (channel_id,),
            )
            return [r["user_id"] for r in cur.fetchall()]

    # =========================================================================
    # Messages
    # =========================================================================

    def post_message(
        self,
        *,
        channel_id: str,
        sender_id: int,
        sender_username: str,
        content: str,
        msg_type: str = "text",
        metadata: dict | None = None,
    ) -> dict:
        """Save a new message to a channel and update channel updated_at."""
        msg_id = f"msg_{uuid.uuid4().hex[:14]}"
        now = time.time()
        meta_json = json.dumps(metadata) if metadata else None

        with self._conn() as c:
            # Verify user is a member
            mem_cur = c.execute(
                "SELECT 1 FROM social_channel_members WHERE channel_id = ? AND user_id = ?",
                (channel_id, sender_id),
            )
            if not mem_cur.fetchone():
                return {"ok": False, "error": "Not a member of this channel"}

            c.execute(
                """
                INSERT INTO social_messages (id, channel_id, sender_id, sender_username, content, msg_type, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    msg_id,
                    channel_id,
                    sender_id,
                    sender_username,
                    content.strip(),
                    msg_type,
                    meta_json,
                    now,
                ),
            )
            c.execute(
                "UPDATE social_channels SET updated_at = ? WHERE id = ?",
                (now, channel_id),
            )
            # Mark as read for sender
            c.execute(
                "UPDATE social_channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?",
                (now, channel_id, sender_id),
            )

        return {
            "ok": True,
            "message": {
                "id": msg_id,
                "channel_id": channel_id,
                "sender_id": sender_id,
                "sender_username": sender_username,
                "content": content.strip(),
                "msg_type": msg_type,
                "metadata": metadata,
                "created_at": now,
            },
        }

    def get_channel_messages(
        self, channel_id: str, user_id: int, limit: int = 50, before: float | None = None
    ) -> list[dict]:
        """Fetch messages in chronological order for a channel."""
        with self._conn() as c:
            mem_cur = c.execute(
                "SELECT 1 FROM social_channel_members WHERE channel_id = ? AND user_id = ?",
                (channel_id, user_id),
            )
            if not mem_cur.fetchone():
                return []

            if before:
                cur = c.execute(
                    """
                    SELECT id, channel_id, sender_id, sender_username, content, msg_type, metadata_json, created_at
                    FROM social_messages
                    WHERE channel_id = ? AND created_at < ?
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (channel_id, before, limit),
                )
            else:
                cur = c.execute(
                    """
                    SELECT id, channel_id, sender_id, sender_username, content, msg_type, metadata_json, created_at
                    FROM social_messages
                    WHERE channel_id = ?
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (channel_id, limit),
                )

            rows = cur.fetchall()
            messages = []
            for r in reversed(rows):
                m_meta = None
                if r["metadata_json"]:
                    try:
                        m_meta = json.loads(r["metadata_json"])
                    except Exception:
                        m_meta = None
                messages.append(
                    {
                        "id": r["id"],
                        "channel_id": r["channel_id"],
                        "sender_id": r["sender_id"],
                        "sender_username": r["sender_username"],
                        "content": r["content"],
                        "msg_type": r["msg_type"],
                        "metadata": m_meta,
                        "created_at": r["created_at"],
                    }
                )
            return messages

    def mark_channel_read(self, channel_id: str, user_id: int) -> None:
        """Mark all messages up to current time as read."""
        now = time.time()
        with self._conn() as c:
            c.execute(
                "UPDATE social_channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?",
                (now, channel_id, user_id),
            )
