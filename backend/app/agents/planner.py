"""The Planner agent — Acharya's orchestrator.

It reads the student's message and produces a Plan that tells the rest of the
team who needs to work: should the Retriever fetch a textbook? the Solver do
maths? is this hard enough to hand to a strong reasoner — or is it just "hi"
(in which case nobody but the Teacher needs to wake up)?

Lightweight by design: rules decide the obvious ~90% instantly with NO extra
model call (greetings even *save* calls by skipping RAG/maths). Only a genuinely
ambiguous message is escalated to a fast LLM (handled in main via `ambiguous`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.correctness.compute import looks_like_math
from app.diagrams.render import wants_diagram



@dataclass
class Plan:
    kind: str              # "chat" (greeting/small talk) | "lesson"
    needs_grounding: bool  # wake the Retriever (RAG)?
    needs_computation: bool  # wake the Solver (SymPy)?
    difficulty: str        # "easy" | "hard" → picks the answering model
    intent: str = "explain"  # explain | simpler | example | quiz | doubt
    ambiguous: bool = False  # rules unsure → main escalates to a fast LLM


# What the student actually wants → how the Teacher should adapt its style.
_INTENTS = [
    ("chapter_start", re.compile(
        r"\b(teach me (chapter|ch|unit)|start (chapter|ch|unit|milestone)|"
        r"explain (chapter|ch|unit)|first day|learn (chapter|ch|unit)|"
        r"from (the )?(beginning|scratch|start)|teach me .* from (the )?(beginning|scratch|start))\b")),
    ("quiz", re.compile(
        r"\b(quiz|test me|practi[cs]e|give me (some )?(questions|problems|sums|"
        r"exercises)|mcqs?|worksheet|ask me)\b")),
    ("simpler", re.compile(
        r"\b(simpler|simplify|too (hard|difficult|complex)|don'?t (understand|get)|"
        r"didn'?t understand|confus(ed|ing)|explain again|in easy|easier|eli5)\b")),
    ("example", re.compile(
        r"\b(example|for instance|show me how|real[- ]life|real[- ]world|in practice)\b")),
    ("doubt", re.compile(
        r"\b(solve this|my doubt|i'?m stuck|help me solve|how (do|to) (i|you) "
        r"(solve|do)|clear my doubt)\b")),
]

INTENT_HINT = {
    "chapter_start": "The student is starting a chapter from the very beginning. "
                     "Act like an inspiring classroom teacher on Day 1: welcome them, introduce "
                     "the chapter with an engaging real-world hook ('Why do we study this?'), "
                     "teach ONLY Concept 1 (no monologues!), give a brief worked example, and "
                     "end with ONE simple check question before advancing.",
    "quiz": "The student wants to PRACTISE, not hear a lecture. Give 3-4 practice "
            "questions at their level; reveal the answers only at the end.",
    "simpler": "The student is struggling. Re-explain more simply — shorter "
               "sentences, a concrete everyday analogy, then check understanding.",
    "example": "Lead with a clear WORKED EXAMPLE rather than theory.",
    "doubt": "First diagnose the student's specific difficulty, then guide them to "
             "the method step by step (don't just hand over the final answer).",
    "explain": "",
}


def detect_intent(text: str) -> str:
    low = text.lower()
    for name, rx in _INTENTS:
        if rx.search(low):
            return name
    return "explain"


_GREETING = re.compile(
    r"^(hi+|hey+|hello+|yo|namaste|greetings|sup|"
    r"good\s*(morning|afternoon|evening|night)|"
    r"thank\s*you|thanks|thanx|thx|ty|"
    r"ok(ay)?|k|cool|nice|great|awesome|perfect|got\s*it|understood|makes\s*sense|"
    r"hmm+|bye+|see\s*you|good\s*bye)[\s!.,]*$"
)
_HARD = re.compile(
    r"\b(prove|proof|derive|derivation|deduce|justify|contradiction|theorem|"
    r"explain\s+why|why\s+(does|is|do|are|can|would)|"
    r"multi-?step|step[-\s]?by[-\s]?step|integrate|differentiate|"
    r"compare\s+and\s+contrast|analyse|analyze|evaluate)\b"
)
_ACADEMIC = re.compile(
    r"\b(what|why|how|explain|define|solve|calculate|find|prove|describe|list|"
    r"difference|example|meaning|formula|equation|state|write|name)\b|\?"
)


def is_greeting(text: str) -> bool:
    return bool(_GREETING.match(text.strip().lower()))


def make_plan(message: str, subject: str | None) -> Plan:
    text = (message or "").strip()
    low = text.lower()

    if is_greeting(low):
        return Plan("chat", needs_grounding=False, needs_computation=False,
                    difficulty="easy")

    if wants_diagram(low):
        return Plan(
            "lesson",
            needs_grounding=True,
            needs_computation=looks_like_math(message, subject),
            difficulty="easy",
            intent=detect_intent(low),
            ambiguous=False,
        )

    math = looks_like_math(message, subject)
    hard = bool(_HARD.search(low)) or len(text) > 220
    academic = bool(_ACADEMIC.search(low))
    # Short, non-greeting, non-academic, non-maths → rules can't be sure.
    ambiguous = not math and not academic and len(text.split()) <= 3

    return Plan(
        "lesson",
        needs_grounding=True,
        needs_computation=math,
        difficulty="hard" if hard else "easy",
        intent=detect_intent(low),
        ambiguous=ambiguous,
    )
