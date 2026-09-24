"""Textbook Grounding Engine for Tark Virtual Lab Simulations.

Searches indexed curriculum textbooks (NCERT, ICSE, State Boards, Cambridge)
for the requested scientific topic, and extracts exact textbook definitions,
variables, apparatus setups, and formulas to ground the interactive simulation.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("tark.simulations.grounding")


def find_textbook_grounding_for_topic(topic: str) -> dict[str, Any]:
    """Search indexed textbooks for the given concept and return structured grounding."""
    from app.rag.embeddings import embed_query
    from app.rag.retrieve import _index

    clean_topic = topic.strip()
    search_phrases = [
        f"{clean_topic} experiment apparatus definition laws formula",
        f"{clean_topic} mechanism principles theory",
        clean_topic,
    ]

    best_hits = []
    seen_keys = set()

    for phrase in search_phrases:
        try:
            vec = embed_query(phrase)
            hits = _index.search(vec, top_k=3)
            for h in hits:
                if h.score >= 0.60:
                    key = (h.source, h.page)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        best_hits.append(h)
        except Exception as e:
            logger.warning(f"Error querying index for topic '{clean_topic}': {e}")

    # Sort by relevance score descending
    best_hits.sort(key=lambda x: x.score, reverse=True)
    top_hits = best_hits[:3]

    if not top_hits:
        return {
            "found": False,
            "topic": clean_topic,
            "citations": [],
            "grounding_text": "",
        }

    citations = [
        f"{h.source} (Page {h.page})" if h.source else f"Curriculum Textbook (Page {h.page})"
        for h in top_hits
    ]

    excerpts = []
    for h in top_hits:
        src_label = f"{h.source or 'Official Textbook'} (Page {h.page})"
        clean_chunk = h.text.strip().replace("\r", " ")
        excerpts.append(f"--- From {src_label} ---\n{clean_chunk[:500]}")

    grounding_text = "\n\n".join(excerpts)

    return {
        "found": True,
        "topic": clean_topic,
        "citations": citations,
        "grounding_text": grounding_text,
    }
