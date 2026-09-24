import asyncio
import time
import httpx

async def main():
    payload = {
        "mode": "teacher",
        "model": "acharya",
        "messages": [{"role": "user", "content": "what is the process of osmosis"}],
        "subject": "Biology",
        "board": "CBSE (NCERT)",
        "grade": "10",
    }
    t0 = time.time()
    first_token_time = None
    token_count = 0

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", "http://127.0.0.1:8000/chat", json=payload) as response:
            print("Status code:", response.status_code)
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    if first_token_time is None:
                        first_token_time = time.time() - t0
                        print(f"Time to FIRST token: {first_token_time:.2f}s")
                    token_count += 1
                    if token_count <= 3:
                        print("Sample chunk:", line[:100])

    print(f"Total stream time: {time.time()-t0:.2f}s, total chunks: {token_count}")

asyncio.run(main())
