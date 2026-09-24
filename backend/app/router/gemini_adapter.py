"""Google Gemini adapter (AI Studio free tier) using the unified google-genai SDK.

Supports multi-key pool with round-robin failover on 429 quota exhaustion.
"""
from __future__ import annotations

import base64
from collections.abc import AsyncIterator

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.router.base import (
    Message,
    ModelAdapter,
    ProviderError,
    ProviderRateLimit,
)
from app.router.key_pool import KeyPool

_ROLE_MAP = {"user": "user", "assistant": "model"}


class GeminiAdapter(ModelAdapter):
    provider_name = "gemini"

    def __init__(self, api_keys: list[str] | str) -> None:
        self.key_pool = KeyPool("gemini", api_keys)
        self._clients: dict[str, genai.Client] = {}

    def _get_client(self, api_key: str) -> genai.Client:
        if api_key not in self._clients:
            self._clients[api_key] = genai.Client(api_key=api_key)
        return self._clients[api_key]

    @staticmethod
    def _to_contents(messages: list[Message]) -> list[types.Content]:
        contents: list[types.Content] = []
        for m in messages:
            parts = [types.Part.from_text(text=m.content or " ")]
            if m.image_data:  # multimodal: attach the uploaded image (vision)
                parts.append(
                    types.Part.from_bytes(
                        data=base64.b64decode(m.image_data),
                        mime_type=m.image_mime or "image/jpeg",
                    )
                )
            contents.append(types.Content(role=_ROLE_MAP[m.role], parts=parts))
        return contents

    async def stream(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: list[Message],
    ) -> AsyncIterator[str]:
        keys = self.key_pool.get_candidate_keys()
        if not keys:
            raise ProviderError("No Gemini API keys configured.")

        config = types.GenerateContentConfig(system_instruction=system_prompt)
        last_err: Exception | None = None

        for key in keys:
            client = self._get_client(key)
            try:
                stream = await client.aio.models.generate_content_stream(
                    model=model,
                    contents=self._to_contents(messages),
                    config=config,
                )
                async for chunk in stream:
                    if chunk.text:
                        yield chunk.text
                return  # streamed successfully
            except genai_errors.ClientError as e:
                code = getattr(e, "code", None)
                cd = 300.0 if code in (401, 403) else 60.0
                self.key_pool.mark_rate_limited(key, cooldown=cd)
                last_err = e
                continue  # Try next key in the pool immediately!
            except genai_errors.ServerError as e:
                # 5xx (503 UNAVAILABLE "high demand") is transient
                self.key_pool.mark_rate_limited(key, cooldown=30.0)
                last_err = e
                continue
            except genai_errors.APIError as e:
                self.key_pool.mark_rate_limited(key, cooldown=60.0)
                last_err = e
                continue
            except Exception as e:
                self.key_pool.mark_rate_limited(key, cooldown=30.0)
                last_err = e
                continue

        raise ProviderRateLimit(f"All {len(keys)} Gemini keys exhausted. Last error: {last_err}")
