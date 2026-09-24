import asyncio
from app.config.settings import get_settings
from google import genai
from google.genai import types

async def main():
    s = get_settings()
    keys = s.gemini_api_keys
    print(f"Total Gemini keys in settings: {len(keys)}")
    for i, k in enumerate(keys):
        masked = k[:6] + "..." + k[-6:] if len(k) > 12 else k
        client = genai.Client(api_key=k)
        try:
            res = await client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents="Say hello in 3 words",
            )
            print(f"Key #{i+1} ({masked}): SUCCESS -> {res.text.strip()}")
        except Exception as e:
            print(f"Key #{i+1} ({masked}): ERROR -> {type(e).__name__}: {e}")

asyncio.run(main())
