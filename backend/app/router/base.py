"""The single adapter interface every provider implements (CLAUDE.md §6, §10).

Adding a provider = one new file implementing ModelAdapter. The router never
changes. All provider-specific quirks hide behind this interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

Role = Literal["user", "assistant"]


@dataclass(frozen=True)
class Message:
    """A single conversational turn, provider-agnostic."""

    role: Role
    content: str
    image_data: str | None = None  # base64-encoded image bytes (multimodal)
    image_mime: str | None = None  # e.g. "image/jpeg"


class ProviderRateLimit(Exception):
    """A 429 from a provider. The router backs off, then fails over (§6)."""


class ProviderError(Exception):
    """Any other provider failure — not retryable on the same provider."""


class ModelAdapter(ABC):
    """Streams a chat completion from one provider.

    Implementations are async generators: they ``yield`` text chunks and must
    raise :class:`ProviderRateLimit` on a 429 so the router can react.
    """

    provider_name: str

    @abstractmethod
    def stream(
        self,
        *,
        model: str,
        system_prompt: str,
        messages: list[Message],
    ) -> AsyncIterator[str]:
        """Yield response text chunks for the given model and conversation."""
        raise NotImplementedError
