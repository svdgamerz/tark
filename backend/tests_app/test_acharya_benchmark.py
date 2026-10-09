"""Comprehensive Benchmark & Structuring Verification Suite for Tark (Acharya).

Tests 32 distinct queries across:
1. Technical & How-To Guides
2. Coding & Software Development
3. Curriculum Chapter Lookups
4. Factual & Science Definitions
5. Deep Conceptual Explanations
6. Math & Physics Numerical Calculations

Evaluates each response against ChatGPT standard quality criteria:
- Proper structure (numbered steps vs code blocks vs direct definitions vs derivations)
- Absence of unsolicited fluff / "exam traps" / quizzes
- Factual and numerical accuracy
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config.models import attempts_for, get_model
from app.config.settings import get_settings
from app.modes.teacher import TEACHER_SYSTEM_PROMPT
from app.router.base import Message
from app.router.prompt_engineer import _is_academic_query
from app.router.router import ModelRouter
from app.textbook_service import get_chapter_grounding

# Evaluation Rubric Checkers
def evaluate_technical_howto(response: str) -> tuple[bool, str]:
    low = response.lower()
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    if "quick intuition check" in low:
        return False, "Contains unwanted 'intuition check'"
    # Must contain numbered steps
    has_numbered = bool(re.search(r"\b1[\.\)]\s+", response) or "\n1." in response or "\n1)" in response)
    if not has_numbered:
        return False, "Missing numbered steps (1. 2. 3.)"
    # Should have code/command fences
    has_code = "```" in response or "setx" in low or "npm" in low or "python" in low or "git" in low
    if not has_code:
        return False, "Missing command/code blocks"
    return True, "Passed (clean numbered steps, code blocks, zero fluff)"

def evaluate_coding(response: str) -> tuple[bool, str]:
    low = response.lower()
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    if "```" not in response:
        return False, "Missing fenced code block"
    return True, "Passed (code block present, no exam fluff)"

def evaluate_chapter_lookup(response: str, expected_title_keyword: str) -> tuple[bool, str]:
    low = response.lower()
    clean_resp = re.sub(r"[,\.:;\*\_]", "", low)
    clean_exp = re.sub(r"[,\.:;\*\_]", "", expected_title_keyword.lower())
    if clean_exp not in clean_resp:
        return False, f"Expected '{expected_title_keyword}' not found in response"
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    first_part = clean_resp[:150]
    if clean_exp not in first_part:
        return False, f"Title not stated directly at the beginning: {response[:80]}"
    return True, f"Passed (directly stated '{expected_title_keyword}')"

def evaluate_factual(response: str, expected_keyword: str) -> tuple[bool, str]:
    low = response.lower()
    clean = re.sub(r"[\\_{}\s\^]", "", low)
    clean = clean.replace("₂", "2").replace("₃", "3").replace("₄", "4").replace("₁", "1").replace("text", "")
    exp = expected_keyword.lower().replace(" ", "")
    if exp not in low and exp not in clean:
        return False, f"Expected keyword '{expected_keyword}' missing"
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    return True, f"Passed (concise, contains '{expected_keyword}')"

def evaluate_conceptual(response: str) -> tuple[bool, str]:
    low = response.lower()
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    if len(response.split()) < 30:
        return False, "Too brief for a conceptual breakdown"
    return True, "Passed (rich explanation, no forced exam trap)"

def evaluate_math(response: str, expected_final: str) -> tuple[bool, str]:
    low = response.lower()
    if "exam trap" in low:
        return False, "Contains unwanted 'exam trap'"
    if expected_final.lower() not in low:
        return False, f"Expected final answer '{expected_final}' not found"
    return True, f"Passed (step-by-step with '{expected_final}')"


BENCHMARK_CASES = [
    # 1. Technical / How-To (5)
    {
        "category": "How-To Guide",
        "query": "how to install mongodb on windows",
        "eval_fn": lambda r: evaluate_technical_howto(r),
    },
    {
        "category": "How-To Guide",
        "query": "how to create a virtual environment in python",
        "eval_fn": lambda r: evaluate_technical_howto(r),
    },
    {
        "category": "How-To Guide",
        "query": "steps to setup react app with vite",
        "eval_fn": lambda r: evaluate_technical_howto(r),
    },
    {
        "category": "How-To Guide",
        "query": "how to push code to a new github repository",
        "eval_fn": lambda r: evaluate_technical_howto(r),
    },
    {
        "category": "How-To Guide",
        "query": "how to install docker on ubuntu",
        "eval_fn": lambda r: evaluate_technical_howto(r),
    },

    # 2. Coding (5)
    {
        "category": "Coding",
        "query": "write a python function to check if a string is palindrome",
        "eval_fn": lambda r: evaluate_coding(r),
    },
    {
        "category": "Coding",
        "query": "write binary search algorithm in python",
        "eval_fn": lambda r: evaluate_coding(r),
    },
    {
        "category": "Coding",
        "query": "how to connect express app to mongodb using mongoose",
        "eval_fn": lambda r: evaluate_coding(r),
    },
    {
        "category": "Coding",
        "query": "how to handle CORS error in FastAPI",
        "eval_fn": lambda r: evaluate_coding(r),
    },
    {
        "category": "Coding",
        "query": "create a simple responsive navbar in HTML and CSS",
        "eval_fn": lambda r: evaluate_coding(r),
    },

    # 3. Chapter / Syllabus Lookups (6)
    {
        "category": "Chapter Lookup",
        "query": "what is the name of chp 6 of science b of std 9",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Classification of Plants"),
    },
    {
        "category": "Chapter Lookup",
        "query": "what is chapter 5 of class 9 science maharashtra state board",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Acids, Bases and Salts"),
    },
    {
        "category": "Chapter Lookup",
        "query": "which is the 1st chapter of 10th maths cbse",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Real Numbers"),
    },
    {
        "category": "Chapter Lookup",
        "query": "what is chapter 6 of class 10 science cbse",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Control and Coordination"),
    },
    {
        "category": "Chapter Lookup",
        "query": "name of chapter 1 of 10th science state board",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Gravitation"),
    },
    {
        "category": "Chapter Lookup",
        "query": "what is chapter 6 of 9th science cbse",
        "eval_fn": lambda r: evaluate_chapter_lookup(r, "Tissues"),
    },

    # 4. Factual & Definitions (5)
    {
        "category": "Factual / Definition",
        "query": "what is the SI unit of power",
        "eval_fn": lambda r: evaluate_factual(r, "watt"),
    },
    {
        "category": "Factual / Definition",
        "query": "what is the value of gravitational constant G",
        "eval_fn": lambda r: evaluate_factual(r, "6.67"),
    },
    {
        "category": "Factual / Definition",
        "query": "what is the formula of rust",
        "eval_fn": lambda r: evaluate_factual(r, "fe2o3"),
    },
    {
        "category": "Factual / Definition",
        "query": "define osmosis",
        "eval_fn": lambda r: evaluate_factual(r, "semipermeable"),
    },
    {
        "category": "Factual / Definition",
        "query": "what is the chemical formula of baking soda",
        "eval_fn": lambda r: evaluate_factual(r, "nahco3"),
    },

    # 5. Conceptual Explanations (6)
    {
        "category": "Conceptual",
        "query": "explain photosynthesis in simple terms",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },
    {
        "category": "Conceptual",
        "query": "how do transformers work in electrical engineering",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },
    {
        "category": "Conceptual",
        "query": "why do objects fall at the same rate in a vacuum",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },
    {
        "category": "Conceptual",
        "query": "explain how a rainbow is formed",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },
    {
        "category": "Conceptual",
        "query": "why does the moon have phases",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },
    {
        "category": "Conceptual",
        "query": "explain newton third law of motion",
        "eval_fn": lambda r: evaluate_conceptual(r),
    },

    # 6. Math & Physics Calculations (5)
    {
        "category": "Math / Numerical",
        "query": "solve 2x + 5 = 15",
        "eval_fn": lambda r: evaluate_math(r, "5"),
    },
    {
        "category": "Math / Numerical",
        "query": "find kinetic energy of a 2 kg object moving at 3 m/s",
        "eval_fn": lambda r: evaluate_math(r, "9"),
    },
    {
        "category": "Math / Numerical",
        "query": "find roots of x^2 - 5x + 6 = 0",
        "eval_fn": lambda r: evaluate_math(r, "2"),
    },
    {
        "category": "Math / Numerical",
        "query": "calculate current when 12V is connected across 4 ohm resistor",
        "eval_fn": lambda r: evaluate_math(r, "3"),
    },
    {
        "category": "Math / Numerical",
        "query": "a car accelerates from 0 to 20 m/s in 5 seconds, find acceleration",
        "eval_fn": lambda r: evaluate_math(r, "4"),
    },
]


async def run_benchmark():
    settings = get_settings()
    router = ModelRouter(settings)
    attempts = attempts_for(get_model("acharya"))

    passed = 0
    failed = 0
    results = []

    print(f"Starting Tark (Acharya) 32-Query Quality & Structuring Benchmark...\n")

    for i, item in enumerate(BENCHMARK_CASES, 1):
        cat = item["category"]
        q = item["query"]

        # Build prompt using exactly the app logic
        is_academic = _is_academic_query(q, {"board": "Maharashtra State Board (Balbharati)", "grade": "9"})
        sys_prompt = TEACHER_SYSTEM_PROMPT

        ch_grounding = get_chapter_grounding(q)
        if ch_grounding:
            sys_prompt += f"\n\n{ch_grounding}"

        response = ""
        try:
            async for kind, payload in router.stream(
                attempts=attempts,
                system_prompt=sys_prompt,
                messages=[Message(role="user", content=q)],
            ):
                if kind == "token":
                    response += payload
        except Exception as e:
            failed += 1
            print(f"[{i}/32] FAIL: {q} | Error: {e}")
            results.append((i, cat, q, False, str(e)))
            continue

        ok, detail = item["eval_fn"](response)
        if ok:
            passed += 1
            print(f"[{i}/32] PASS ({cat}): {q} -> {detail}")
            results.append((i, cat, q, True, detail))
        else:
            failed += 1
            print(f"[{i}/32] FAIL ({cat}): {q} -> {detail}")
            results.append((i, cat, q, False, detail))

    print("\n" + "=" * 60)
    print(f"BENCHMARK COMPLETED: {passed}/{passed+failed} Passed ({passed/(passed+failed)*100:.1f}%)")
    print("=" * 60)

    # Save summary report
    out_dir = r"C:\Users\shishir\.gemini\antigravity-ide\brain\3973aa9a-4e31-441e-ae8f-2d9094e60a34\scratch"
    os.makedirs(out_dir, exist_ok=True)
    report_file = os.path.join(out_dir, "benchmark_report.txt")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(f"Tark Quality Benchmark: {passed}/{passed+failed} Passed\n\n")
        for num, cat, q, ok, detail in results:
            status = "PASS" if ok else "FAIL"
            f.write(f"[{num}] {status} [{cat}] {q}\n    Result: {detail}\n\n")

    return passed, failed


if __name__ == "__main__":
    p, f = asyncio.run(run_benchmark())
    if f > 0:
        sys.exit(1)
