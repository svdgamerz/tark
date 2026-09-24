import asyncio
import time
from google import genai

async def test():
    key = "AIzaSyCpwSCdZCz_MTK0_YDnKJxALvca_P_8wtE"
    c = genai.Client(api_key=key)
    t0 = time.time()
    res = await c.aio.models.generate_content(
        model="gemini-flash-latest",
        contents="Explain osmosis in 2 concise sentences for a 10th grade student.",
    )
    print(f"Time taken: {time.time()-t0:.2f}s")
    print("Response:", res.text.strip())

asyncio.run(test())
