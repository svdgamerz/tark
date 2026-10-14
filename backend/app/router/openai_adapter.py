"""One adapter for every OpenAI-compatible provider (NIM, Groq, OpenRouter, Mistral, SambaNova, Cerebras).

Supports multi-key pool with automatic round-robin failover on 429 quota exhaustion.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from openai import APIStatusError, AsyncOpenAI, RateLimitError

from app.router.base import (
    Message,
    ModelAdapter,
    ProviderError,
    ProviderRateLimit,
)
from app.router.key_pool import KeyPool


class OpenAICompatAdapter(ModelAdapter):
    def __init__(self, *, provider_name: str, base_url: str, api_keys: list[str] | str) -> None:
        self.provider_name = provider_name
        self.base_url = base_url
        self.key_pool = KeyPool(provider_name, api_keys)
        self._clients: dict[str, AsyncOpenAI] = {}

    def _get_client(self, api_key: str) -> AsyncOpenAI:
        if api_key not in self._clients:
            self._clients[api_key] = AsyncOpenAI(base_url=self.base_url, api_key=api_key)
        return self._clients[api_key]

    @staticmethod
    def _to_messages(
        system_prompt: str, messages: list[Message]
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for m in messages:
            if m.image_data:
                mime = m.image_mime or "image/jpeg"
                data_url = f"data:{mime};base64,{m.image_data}"
                content: list[dict[str, Any]] = []
                if m.content:
                    content.append({"type": "text", "text": m.content})
                content.append({"type": "image_url", "image_url": {"url": data_url}})
                out.append({"role": m.role, "content": content})
            else:
                out.append({"role": m.role, "content": m.content})
        return out

    async def stream(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: list[Message],
    ) -> AsyncIterator[str]:
        keys = self.key_pool.get_candidate_keys()
        if not keys:
            if not self.key_pool.has_keys():
                raise ProviderError(f"No API keys configured for provider {self.provider_name}.")
            raise ProviderRateLimit(f"All {len(self.key_pool.keys)} {self.provider_name} keys exhausted (cooling down).")

        last_err: Exception | None = None

        for key in keys:
            client = self._get_client(key)
            try:
                stream = await client.chat.completions.create(
                    model=model,
                    messages=self._to_messages(system_prompt, messages),
                    temperature=0.7,
                    max_tokens=4096,
                    stream=True,
                )
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield delta.content
                return  # Stream completed successfully
            except RateLimitError as e:
                self.key_pool.mark_rate_limited(key)
                last_err = e
                continue  # Instantly try the next key in the pool!
            except APIStatusError as e:
                if e.status_code == 429 or e.status_code >= 500:
                    self.key_pool.mark_rate_limited(key)
                    last_err = e
                    continue
                raise ProviderError(str(e)) from e
            except Exception as e:
                if "429" in str(e) or "rate" in str(e).lower():
                    self.key_pool.mark_rate_limited(key)
                    last_err = e
                    continue
                raise ProviderError(str(e)) from e

        raise ProviderRateLimit(f"All {len(keys)} {self.provider_name} keys exhausted. Last error: {last_err}")
