"""Model router: stream from an ordered list of (provider, model) attempts,
retrying transient errors (429 / 5xx) with backoff and failing over to the next
attempt — so a chosen model that's down rolls to a working one (CLAUDE.md §6).
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.config.models import PROVIDER_BASE_URLS, Provider
from app.config.settings import Settings
from app.router.base import (
    Message,
    ModelAdapter,
    ProviderError,
    ProviderRateLimit,
)
from app.router.gemini_adapter import GeminiAdapter
from app.router.openai_adapter import OpenAICompatAdapter

# Exponential backoff schedule (seconds) for transient errors — fast failover.
BACKOFF_SECONDS = [0.2, 0.5]


class ModelRouter:
    def __init__(self, settings: Settings) -> None:
        self._adapters: dict[Provider, ModelAdapter] = {
            Provider.GEMINI: GeminiAdapter(settings.gemini_api_key),
        }
        # Register each OpenAI-compatible provider whose key is configured.
        keys = {
            Provider.OPENAI: settings.openai_api_key,
            Provider.NIM: settings.nvidia_nim_api_key,
            Provider.GROQ: settings.groq_api_key,
            Provider.OPENROUTER: settings.openrouter_api_key,
            Provider.MISTRAL: settings.mistral_api_key,
            Provider.CEREBRAS: settings.cerebras_api_key,
            Provider.SAMBANOVA: settings.sambanova_api_key,
        }
        for provider, key in keys.items():
            if key:
                self._adapters[provider] = OpenAICompatAdapter(
                    provider_name=provider.value,
                    base_url=PROVIDER_BASE_URLS[provider],
                    api_keys=key,
                )

    def has(self, provider: Provider) -> bool:
        return provider in self._adapters

    async def stream(
        self,
        *,
        attempts: list[tuple[Provider, str]],
        system_prompt: str,
        messages: list[Message],
    ) -> AsyncIterator[tuple[str, str]]:
        """Yield ``("token", text)`` chunks. May also yield ``("reset", "")`` to
        tell the client to discard a partial answer before a fresh attempt
        streams in (transparent recovery from a mid-stream provider failure).
        """
        last_error: Exception | None = None
        emitted_any = False  # have we delivered any tokens to the client yet?

        for provider, model in attempts:
            adapter = self._adapters.get(provider)
            if adapter is None:
                continue  # provider not configured — skip

            # Retry this provider on transient errors with backoff, then fail over.
            for delay in [0, *BACKOFF_SECONDS]:
                if delay:
                    await asyncio.sleep(delay)
                attempt_started = False
                try:
                    async for token in adapter.stream(
                        model=model,
                        system_prompt=system_prompt,
                        messages=messages,
                    ):
                        if not attempt_started:
                            attempt_started = True
                            if emitted_any:
                                yield ("reset", "")  # discard the failed partial
                                emitted_any = False
                        emitted_any = True
                        yield ("token", token)
                    return  # stream finished cleanly
                except ProviderRateLimit as e:
                    last_error = e
                    if "exhausted" in str(e).lower():
                        break  # All keys for this provider are exhausted, fail over immediately
                    continue  # transient — back off and retry the same provider
                except ProviderError as e:
                    last_error = e
                    break  # fail over to the next attempt

        raise ProviderError(f"All providers failed. Last error: {last_error}")
