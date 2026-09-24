"""Gemini text-to-speech adapter (CLAUDE.md §11 — TTS behind its own module,
mirroring the model router).

Gemini returns raw PCM (24 kHz, 16-bit, mono); browsers can't play that directly,
so we wrap it in a WAV header. Returns WAV bytes, or None on any failure — the
client then falls back to the browser's built-in voice, so read-aloud never breaks.
"""
from __future__ import annotations

import base64
import struct

import httpx

from app.config.models import GEMINI_TTS

_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)
# Gemini TTS PCM format.
_RATE, _BITS, _CHANNELS = 24000, 16, 1


def _wav(pcm: bytes) -> bytes:
    """Prepend a 44-byte WAV header to raw little-endian PCM."""
    byte_rate = _RATE * _CHANNELS * _BITS // 8
    block_align = _CHANNELS * _BITS // 8
    return (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVE"
        + b"fmt "
        + struct.pack("<IHHIIHH", 16, 1, _CHANNELS, _RATE, byte_rate, block_align, _BITS)
        + b"data"
        + struct.pack("<I", len(pcm))
        + pcm
    )


async def synthesize(text: str, api_key: str, voice: str = "Aoede") -> bytes | None:
    if not text.strip() or not api_key:
        return None
    keys = [k.strip() for k in api_key.replace("\n", ",").split(",") if k.strip()]
    if not keys:
        return None

    body = {
        "contents": [{"parts": [{"text": text[:5000]}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }
    for k in keys:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(_URL.format(model=GEMINI_TTS, key=k), json=body)
            if r.status_code == 200:
                part = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
                return _wav(base64.b64decode(part["data"]))
        except Exception:
            continue
    return None
