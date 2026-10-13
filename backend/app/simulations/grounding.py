"""Textbook Grounding Engine for Tark Virtual Lab Simulations.

Searches indexed curriculum textbooks (NCERT, ICSE, State Boards, Cambridge)
for the requested scientific topic, and extracts exact textbook definitions,
variables, apparatus setups, and formulas to ground the interactive simulation.
"""
from __future__ import annotations

import logging
import re
import sqlite3
from typing import Any

from app.config.db_path import get_db_path

logger = logging.getLogger("tark.simulations.grounding")


def find_textbook_grounding_for_topic(topic: str) -> dict[str, Any]:
    """Search indexed textbooks for the given concept using fast, memory-safe SQLite queries."""
    clean_topic = topic.strip()
    words = [
        w for w in re.findall(r"\b[a-zA-Z]{4,}\b", clean_topic.lower())
        if w not in {"what", "this", "that", "explain", "process", "about", "describe", "which", "where"}
    ]
    if not words:
        words = [clean_topic.lower()]

    db_file = get_db_path("tark_rag.db")
    top_hits = []
    seen_keys = set()

    try:
        with sqlite3.connect(db_file, timeout=5) as conn:
            conn.row_factory = sqlite3.Row
            for word in words[:3]:
                rows = conn.execute(
                    "SELECT source, page, chapter, text FROM chunks WHERE lower(text) LIKE ? LIMIT 3",
                    (f"%{word}%",),
                ).fetchall()
                for r in rows:
                    key = (r["source"], r["page"])
                    if key not in seen_keys:
                        seen_keys.add(key)
                        top_hits.append(r)
    except Exception as e:
        logger.warning(f"Error querying textbooks for simulation grounding '{clean_topic}': {e}")

    if not top_hits:
        return {
            "found": False,
            "topic": clean_topic,
            "citations": [],
            "grounding_text": "",
        }

    citations = [
        f"{h['source'] or 'Official Textbook'} (Page {h['page']})" if h["page"] else f"{h['source'] or 'Official Textbook'}"
        for h in top_hits[:3]
    ]

    excerpts = []
    for h, c in zip(top_hits[:3], citations):
        clean_chunk = (h["text"] or "").strip().replace("\r", " ")
        excerpts.append(f"--- From {c} ---\n{clean_chunk[:500]}")

    grounding_text = "\n\n".join(excerpts)

    return {
        "found": True,
        "topic": clean_topic,
        "citations": citations,
        "grounding_text": grounding_text,
    }
