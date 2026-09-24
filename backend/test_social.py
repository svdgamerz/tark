"""Test suite for Tark SocialStore: friendships, 1-on-1 DMs, study circles, messaging, and unread counts."""
import os
import tempfile
from pathlib import Path

from app.auth.store import UserStore
from app.social.store import SocialStore


def run_tests():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_tark.db"
        user_store = UserStore(db_path=db_path)
        social_store = SocialStore(db_path=db_path)

        # 1. Create test users
        user_store.create_unverified(
            username="arav_sharma",
            email="arav@example.com",
            password_hash="hash1",
            salt="salt1",
            code="123456",
            code_ttl_seconds=600,
        )
        user_store.mark_verified("arav@example.com")
        u1 = user_store.get_by_email("arav@example.com")

        user_store.create_unverified(
            username="priya_patel",
            email="priya@example.com",
            password_hash="hash2",
            salt="salt2",
            code="123456",
            code_ttl_seconds=600,
        )
        user_store.mark_verified("priya@example.com")
        u2 = user_store.get_by_email("priya@example.com")

        user_store.create_unverified(
            username="rohit_kumar",
            email="rohit@example.com",
            password_hash="hash3",
            salt="salt3",
            code="123456",
            code_ttl_seconds=600,
        )
        user_store.mark_verified("rohit@example.com")
        u3 = user_store.get_by_email("rohit@example.com")

        print("Users created: u1=%s, u2=%s, u3=%s" % (u1["id"], u2["id"], u3["id"]))

        # 2. Search users
        results = social_store.search_users("priya", u1["id"])
        assert len(results) == 1, "Should find priya"
        assert results[0]["friendship_status"] == "none"
        print("PASS: search_users returned priya with status 'none'")

        # 3. Send friend request from u1 to u2
        req_res = social_store.send_friend_request(u1["id"], u2["id"])
        assert req_res["ok"] and req_res["status"] == "pending"
        pending = social_store.list_pending_requests(u2["id"])
        assert len(pending["incoming"]) == 1
        assert pending["incoming"][0]["user_id"] == u1["id"]
        print("PASS: friend request sent and visible in pending incoming")

        # 4. Accept friend request
        accept_res = social_store.respond_friend_request(u2["id"], u1["id"], accept=True)
        assert accept_res["ok"] and accept_res["status"] == "accepted"
        friends_1 = social_store.list_friends(u1["id"])
        friends_2 = social_store.list_friends(u2["id"])
        assert len(friends_1) == 1 and friends_1[0]["id"] == u2["id"]
        assert len(friends_2) == 1 and friends_2[0]["id"] == u1["id"]
        dm_chan_id = friends_1[0]["channel_id"]
        print("PASS: friend request accepted; DM channel is %s" % dm_chan_id)

        # 5. Send message in 1-on-1 DM
        msg1 = social_store.post_message(
            channel_id=dm_chan_id,
            sender_id=u1["id"],
            sender_username=u1["username"],
            content="Hey Priya! Can you help me with this formula $E = mc^2$?",
            msg_type="text",
            metadata={"subject": "Physics"},
        )
        assert msg1["ok"], "Message should be saved"
        print("PASS: message sent in DM channel")

        # 6. Check channels list and unread count for u2
        channels_u2 = social_store.list_channels(u2["id"])
        assert len(channels_u2) == 1
        assert channels_u2[0]["unread_count"] == 1
        assert channels_u2[0]["last_message"]["content"] == msg1["message"]["content"]
        print("PASS: channel listing and unread count = 1 for recipient")

        # 7. Read messages as u2
        msgs = social_store.get_channel_messages(dm_chan_id, u2["id"])
        assert len(msgs) == 1
        social_store.mark_channel_read(dm_chan_id, u2["id"])
        channels_u2_after = social_store.list_channels(u2["id"])
        assert channels_u2_after[0]["unread_count"] == 0
        print("PASS: get_channel_messages and mark_read reset unread count to 0")

        # 8. Create Study Group Circle with u1, u2, u3
        grp_res = social_store.create_group_channel(
            name="Class 10 Physics Doubt Circle",
            creator_id=u1["id"],
            member_ids=[u2["id"], u3["id"]],
        )
        assert grp_res["ok"]
        grp_chan_id = grp_res["channel_id"]
        grp_info = social_store.get_channel(grp_chan_id, u1["id"])
        assert grp_info["name"] == "Class 10 Physics Doubt Circle"
        assert len(grp_info["members"]) == 3
        print("PASS: study group circle created with 3 members: %s" % grp_chan_id)

        # 9. Post Doubt Share message to Group
        doubt_msg = social_store.post_message(
            channel_id=grp_chan_id,
            sender_id=u3["id"],
            sender_username=u3["username"],
            content="Check this question on refraction from Chapter 10",
            msg_type="doubt_share",
            metadata={
                "subject": "Science",
                "chapter": "Light - Reflection and Refraction",
                "equation": "n = \\frac{c}{v}",
                "ai_quote": "Refractive index determines how much light bends in a medium.",
            },
        )
        assert doubt_msg["ok"]
        assert doubt_msg["message"]["msg_type"] == "doubt_share"
        print("PASS: doubt_share message with LaTeX equation and metadata posted")

        print("\nALL 9 SOCIAL STORE TESTS PASSED SUCCESSFULLY!!!")


if __name__ == "__main__":
    run_tests()
