"""Local embeddings via fastembed (ONNX runtime — no PyTorch, no API limits).

A local model means corpus indexing AND every user query are free and unlimited,
which suits a free, public, small-scale product. (Gemini's free embedding tier
caps at 100 requests/min — a real user load would hit that.) Model:
BAAI/bge-small-en-v1.5 (384-dim); it downloads once and is cached locally.
"""
from __future__ import annotations

from functools import lru_cache

from fastembed import TextEmbedding

from app.config.models import EMBED_MODEL


@lru_cache(maxsize=1)
def _model() -> TextEmbedding:
    return TextEmbedding(model_name=EMBED_MODEL)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed passages (for indexing)."""
    return [vec.tolist() for vec in _model().embed(list(texts))]


def embed_query(text: str) -> list[float]:
    """Embed a search query (uses the model's query instruction)."""
    return list(_model().query_embed([text]))[0].tolist()
