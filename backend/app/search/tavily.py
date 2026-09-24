"""Tavily Web Search Client (Budget-Guarded, Cached, with Multi-Key Failover).

Used as a smart fallback when a topic is NOT found in the local curriculum
database, while strictly conserving the free-tier budget (1,000 req/month per key).
Supports automatic failover across multiple API keys.
"""
from __future__ import annotations

import json
import logging
import re
import time
import urllib.request
from dataclasses import dataclass
from typing import ClassVar

logger = logging.getLogger(__name__)

MONTHLY_BUDGET_LIMIT = 900  # Safety headroom per key
CACHE_TTL_SECONDS = 86400    # 24 hour cache for identical/normalized queries


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    score: float = 1.0


class TavilySearchClient:
    _cache: ClassVar[dict[str, tuple[float, list[SearchResult]]]] = {}
    _per_key_counts: ClassVar[dict[str, int]] = {}
    _last_reset_month: ClassVar[str] = ""

    def __init__(self, api_keys: list[str] | str) -> None:
        if isinstance(api_keys, str):
            self.api_keys = [k.strip() for k in api_keys.split(",") if k.strip()]
        else:
            self.api_keys = [k.strip() for k in api_keys if k and k.strip()]

    @classmethod
    def _check_month_reset(cls) -> None:
        current_month = time.strftime("%Y-%m")
        if cls._last_reset_month != current_month:
            cls._last_reset_month = current_month
            cls._per_key_counts.clear()

    @classmethod
    def _is_key_available(cls, key: str) -> bool:
        cls._check_month_reset()
        count = cls._per_key_counts.get(key, 0)
        return count < MONTHLY_BUDGET_LIMIT

    @classmethod
    def _record_key_usage(cls, key: str) -> None:
        cls._check_month_reset()
        cls._per_key_counts[key] = cls._per_key_counts.get(key, 0) + 1

    @staticmethod
    def _is_worthy_query(query: str) -> bool:
        """Filter out small talk, pure greetings, or raw arithmetic that don't need web search."""
        q = query.strip().lower()
        if len(q) < 8 or len(q.split()) < 2:
            return False
        # Small talk & basic greetings
        if q in {"hello", "hi", "hey", "thanks", "thank you", "bye", "good morning"}:
            return False
        # Pure arithmetic (e.g. 5+5, 23 * 45)
        if re.match(r"^[\d\s\+\-\*\/\^\(\)\.\=\,\%]+$", q):
            return False
        return True

    def search(self, query: str, max_results: int = 3) -> list[SearchResult] | None:
        """Run Tavily web search across available keys with failover."""
        if not self.api_keys or not self._is_worthy_query(query):
            return None

        norm_key = re.sub(r"\s+", " ", query.strip().lower())

        # Check In-Memory Cache
        now = time.time()
        if norm_key in self._cache:
            cached_time, results = self._cache[norm_key]
            if now - cached_time < CACHE_TTL_SECONDS:
                return results

        # Iterate through keys with quota
        url = "https://api.tavily.com/search"
        for key in self.api_keys:
            if not self._is_key_available(key):
                continue

            payload = {
                "api_key": key,
                "query": query,
                "search_depth": "basic",
                "include_answer": False,
                "max_results": max_results,
                "include_raw_content": False,
            }

            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    if resp.status != 200:
                        continue
                    data = json.loads(resp.read().decode("utf-8"))

                raw_results = data.get("results", [])
                results: list[SearchResult] = []
                for r in raw_results:
                    title = str(r.get("title", "")).strip()
                    content = str(r.get("content", "")).strip()
                    link = str(r.get("url", "")).strip()
                    score = float(r.get("score", 1.0))
                    if content and link:
                        results.append(
                            SearchResult(title=title, url=link, content=content, score=score)
                        )

                if results:
                    self._record_key_usage(key)
                    self._cache[norm_key] = (now, results)
                    return results

            except Exception as e:
                logger.warning("Tavily key failover triggered due to error: %s", e)
                continue

        logger.info("All Tavily keys exhausted or returned no results.")
        return None


def format_web_context(results: list[SearchResult]) -> tuple[str, list[str]]:
    """Format Tavily results for prompt injection and extract citations."""
    excerpts = []
    citations = []
    for r in results:
        excerpts.append(f"[{r.title} | {r.url}]\n{r.content}")
        citations.append(f"{r.title} ({r.url})")

    prompt = (
        "\n\n--- WEB SEARCH CONTEXT (Tavily) ---\n"
        "The following information was retrieved from verified web sources:\n\n"
        + "\n\n".join(excerpts)
        + "\n--- END WEB CONTEXT ---\n"
        "Use this web context to ensure your facts are accurate, up-to-date, and complete. "
        "Do not paste raw links in your explanation; sources are attached automatically."
    )
    return prompt, citations
