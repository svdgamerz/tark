"""End-to-End Multi-Turn Conversational Memory & Context Retention Test Suite for Tark."""
import asyncio
import json
import sys
from httpx import AsyncClient, ASGITransport

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from app.main import app, student_memory, settings
from app.auth.security import make_token
from app.router.prompt_engineer import is_conversational_or_memory_query


async def parse_sse_stream(response):
    """Accumulate tokens from an SSE text/event-stream response."""
    full_text = ""
    events = []
    async for line in response.aiter_lines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("data: "):
            payload = line[6:].strip()
            if payload == "[DONE]":
                break
            try:
                data = json.loads(payload)
                events.append(data)
                if data.get("type") == "token":
                    full_text += data.get("text", "")
            except Exception:
                pass
    return full_text, events


async def run_tests():
    print("=" * 70)
    print("STARTING TARK CONVERSATIONAL MEMORY & CONTEXT RETENTION E2E TEST")
    print("=" * 70)

    user_email = "aryan_jee_student@tark-test.ai"
    token = make_token(101, user_email, settings.token_secret)
    auth_header = f"Bearer {token}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=45.0) as client:
        # -------------------------------------------------------------
        # STEP 1: Turn 1 - Student Introduces Context & Personal Details
        # -------------------------------------------------------------
        print("\n[TEST 1] Sending Turn 1: Student shares name, school, exam, weak chapter...")
        turn1_text = (
            "Hi Tark, my name is Aryan. I study in Class 10 at Delhi Public School and I'm preparing for JEE 2026. "
            "My weak chapter is Trigonometry."
        )
        t1_payload = {
            "mode": "teacher",
            "model": "acharya",
            "board": "CBSE",
            "grade": "10",
            "subject": "Mathematics",
            "messages": [
                {"role": "user", "content": turn1_text}
            ]
        }
        resp1 = await client.post("/chat", json=t1_payload, headers={"authorization": auth_header})
        assert resp1.status_code == 200, f"Turn 1 failed: {resp1.status_code}"
        answer1, events1 = await parse_sse_stream(resp1)
        print(f"Turn 1 Answer snippet: {answer1[:160]}...")
        assert len(answer1) > 20, "Turn 1 answer was empty"

        # Verify StudentMemoryStore captured the facts
        memories = student_memory.get_all(user_email)
        mem_dict = {f"{m['category']}:{m['key']}": m['value'] for m in memories}
        print(f"Captured Memories for {user_email}:", json.dumps(mem_dict, indent=2))

        assert mem_dict.get("identity:name") == "Aryan", f"Name not captured: {mem_dict}"
        assert "Delhi Public School" in mem_dict.get("academic:school", ""), f"School not captured: {mem_dict}"
        assert "JEE 2026" in mem_dict.get("academic:target_exam", ""), f"Exam not captured: {mem_dict}"
        assert "Trigonometry" in mem_dict.get("academic:weak_topic", ""), f"Weak topic not captured: {mem_dict}"
        print("✓ Turn 1 extraction and persistence verified successfully!")

        # -------------------------------------------------------------
        # STEP 2: Turn 2 - Academic Question in Context
        # -------------------------------------------------------------
        print("\n[TEST 2] Sending Turn 2: Asking for a trigonometry problem...")
        t2_payload = {
            "mode": "teacher",
            "model": "acharya",
            "board": "CBSE",
            "grade": "10",
            "subject": "Mathematics",
            "messages": [
                {"role": "user", "content": turn1_text},
                {"role": "assistant", "content": answer1},
                {"role": "user", "content": "Can you give me a question on proving identities in trigonometry?"}
            ]
        }
        resp2 = await client.post("/chat", json=t2_payload, headers={"authorization": auth_header})
        assert resp2.status_code == 200, f"Turn 2 failed: {resp2.status_code}"
        answer2, _ = await parse_sse_stream(resp2)
        print(f"Turn 2 Answer snippet: {answer2[:160]}...")
        assert len(answer2) > 30, "Turn 2 answer was empty"
        print("✓ Turn 2 academic continuation verified successfully!")

        # -------------------------------------------------------------
        # STEP 3: Turn 3 - Direct Recall / Memory Challenge
        # -------------------------------------------------------------
        print("\n[TEST 3] Sending Turn 3: Testing Tark's recall of name, school, and target exam...")
        turn3_query = "Do you remember my name, which school I go to, and what my target exam is?"
        assert is_conversational_or_memory_query(turn3_query), "Turn 3 query should be classified as memory query"

        t3_payload = {
            "mode": "teacher",
            "model": "acharya",
            "board": "CBSE",
            "grade": "10",
            "subject": "Mathematics",
            "messages": [
                {"role": "user", "content": turn1_text},
                {"role": "assistant", "content": answer1},
                {"role": "user", "content": "Can you give me a question on proving identities in trigonometry?"},
                {"role": "assistant", "content": answer2},
                {"role": "user", "content": turn3_query}
            ]
        }
        resp3 = await client.post("/chat", json=t3_payload, headers={"authorization": auth_header})
        assert resp3.status_code == 200, f"Turn 3 failed: {resp3.status_code}"
        answer3, _ = await parse_sse_stream(resp3)
        print(f"\nTurn 3 Full Answer:\n{answer3}\n")

        # Verify Tark remembers Aryan, Delhi Public School, and JEE 2026
        import re
        ans_low = re.sub(r"\s+", " ", answer3.lower())
        assert "aryan" in ans_low, f"Tark forgot name 'Aryan': {answer3}"
        assert "delhi public" in ans_low or "dps" in ans_low, f"Tark forgot school 'Delhi Public School': {answer3}"
        assert "jee" in ans_low or "2026" in ans_low, f"Tark forgot target exam 'JEE 2026': {answer3}"
        print("✓ Turn 3 Recall Verified: Tark accurately remembered Aryan, Delhi Public School, and JEE 2026!")

        # -------------------------------------------------------------
        # STEP 4: Cross-Chat Memory Retention (Brand New Conversation)
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing Cross-Session Memory in a completely new empty chat...")
        t4_payload = {
            "mode": "teacher",
            "model": "acharya",
            "messages": [
                {"role": "user", "content": "Hey Tark, what do you know about me and what should I study for my exam?"}
            ]
        }
        resp4 = await client.post("/chat", json=t4_payload, headers={"authorization": auth_header})
        assert resp4.status_code == 200, f"Turn 4 failed: {resp4.status_code}"
        answer4, _ = await parse_sse_stream(resp4)
        print(f"\nTurn 4 (New Chat) Full Answer:\n{answer4}\n")

        ans4_low = re.sub(r"\s+", " ", answer4.lower())
        assert "aryan" in ans4_low, f"Cross-chat memory forgot name: {answer4}"
        assert "jee" in ans4_low or "trigonometry" in ans4_low, f"Cross-chat memory forgot exam/topic: {answer4}"
        print("✓ Test 4 Cross-Chat Memory Verified: Tark greeted Aryan and recalled his exam & study context across chats!")

    print("\n" + "=" * 70)
    print("ALL CONVERSATIONAL MEMORY & CONTEXT RETENTION TESTS PASSED 100%!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_tests())
