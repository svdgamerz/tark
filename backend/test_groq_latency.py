import asyncio
import time
from app.config.settings import get_settings
from openai import AsyncOpenAI

async def main():
    s = get_settings()
    print("Groq API key configured:", bool(s.groq_api_key))
    if s.groq_api_key:
        c = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=s.groq_api_key)
        try:
            m = await c.models.list()
            print("Groq models available:", [x.id for x in m.data[:15]])
        except Exception as e:
            print("Groq models error:", e)

    from app.router.prompt_engineer import PromptOptimizer
    po = PromptOptimizer(s)
    t0 = time.time()
    res, opt = await po.optimize("what is the process of osmosis")
    print(f"PromptOptimizer took {time.time()-t0:.2f}s, was_engineered={opt}")

    from app.main import make_plan, _refine_plan
    t0 = time.time()
    plan = make_plan("what is the process of osmosis", "Biology")
    print(f"make_plan took {time.time()-t0:.2f}s, ambiguous={plan.ambiguous}")
    if plan.ambiguous:
        t0 = time.time()
        plan = await _refine_plan(plan, "what is the process of osmosis")
        print(f"_refine_plan took {time.time()-t0:.2f}s")

asyncio.run(main())
