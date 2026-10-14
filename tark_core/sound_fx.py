"""Procedural Sci-Fi Sound FX Engine (Iron Man HUD Chimes & Audio Tones).
Generates pure sine-wave synthetic audio in-memory with zero disk latency.
"""
from __future__ import annotations

import io
import math
import struct
import wave

try:
    import pygame
    pygame.mixer.init()
except Exception:
    pass


def _synth_wave(frequencies: list[float], duration: float = 0.18, decay_rate: float = 5.0) -> bytes:
    """Synthesizes a clean multi-frequency sine wave with exponential decay in WAV format."""
    sample_rate = 44100
    n_samples = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(n_samples):
            t = i / sample_rate
            progress = i / n_samples
            if len(frequencies) == 1:
                freq = frequencies[0]
            else:
                idx = int(progress * (len(frequencies) - 1))
                freq = frequencies[idx]
            decay = math.exp(-decay_rate * progress)
            val = int(12000 * math.sin(2 * math.pi * freq * t) * decay)
            wav.writeframes(struct.pack("<h", max(-32767, min(32767, val))))
    return buf.getvalue()


# Pre-synthesized Sound Buffers
SOUND_BOOT_DATA = _synth_wave([523.25, 659.25, 783.99, 1046.50], duration=0.35, decay_rate=3.0)
SOUND_CHIME_DATA = _synth_wave([880.0, 1760.0], duration=0.16, decay_rate=6.0)
SOUND_WAKE_DATA = _synth_wave([440.0, 880.0, 1320.0], duration=0.20, decay_rate=4.0)
SOUND_ERROR_DATA = _synth_wave([300.0, 200.0], duration=0.25, decay_rate=4.0)
SOUND_STEP_DATA = _synth_wave([987.77, 1318.51], duration=0.12, decay_rate=7.0)


def play_sound(wav_data: bytes) -> None:
    """Plays an in-memory WAV buffer asynchronously through pygame mixer."""
    try:
        if not pygame.mixer.get_init():
            pygame.mixer.init()
        sound = pygame.mixer.Sound(io.BytesIO(wav_data))
        sound.set_volume(0.35)
        sound.play()
    except Exception:
        pass


def play_chime_done():
    play_sound(SOUND_CHIME_DATA)


def play_chime_boot():
    play_sound(SOUND_BOOT_DATA)


def play_chime_wake():
    play_sound(SOUND_WAKE_DATA)


def play_chime_step():
    play_sound(SOUND_STEP_DATA)


def play_chime_error():
    play_sound(SOUND_ERROR_DATA)
