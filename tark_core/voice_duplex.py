"""Dual-Layer Neural Voice Engine & Hands-Free Listening (ElevenLabs + Edge-TTS + SpeechRecognition).

Capabilities:
- Neural Speech: ElevenLabs Voice Clone (George / Deep English)
- Asynchronous Zero-Cost Fallback: Microsoft Edge Neural TTS (en-US-ChristopherNeural)
- Speech Recognition: SpeechRecognition with energy threshold adaptation
- Non-blocking audio queue with interruptibility
"""
from __future__ import annotations

import asyncio
import io
import json
import os
from pathlib import Path
import queue
import re
import tempfile
import threading
import time
import urllib.parse
import urllib.request

try:
    import pygame
    pygame.mixer.init()
except Exception:
    pass

import speech_recognition as sr

from tark_core.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SCRATCH_DIR


class VoiceDuplex:
    """Manages high-definition neural voice synthesis and live microphone duplex."""

    def __init__(self):
        self.speech_queue = queue.Queue()
        self.is_speaking = False
        self.stop_requested = False
        self._worker_thread = threading.Thread(target=self._speech_worker, daemon=True)
        self._worker_thread.start()

    def _speech_worker(self):
        while True:
            text = self.speech_queue.get()
            if text is None:
                break
            self.stop_requested = False
            self.is_speaking = True
            try:
                self._synthesize_and_play(text)
            except Exception as e:
                print(f"[VOICE ERROR]: {e}")
            finally:
                self.is_speaking = False
                self.speech_queue.task_done()

    def speak(self, text: str) -> None:
        """Enqueues text for spoken output."""
        clean = re.sub(r"```[\s\S]*?```", " [Code omitted] ", text)
        clean = re.sub(r"\[.*?\]\(.*?\)", "", clean)
        clean = re.sub(r"[#*_~`]", "", clean).strip()
        if clean:
            self.speech_queue.put(clean)

    def stop_speaking(self) -> None:
        """Interrupts currently playing speech immediately."""
        self.stop_requested = True
        try:
            if pygame.mixer.get_init():
                pygame.mixer.music.stop()
        except Exception:
            pass

    def _synthesize_and_play(self, text: str) -> None:
        # 1. Try ElevenLabs
        if ELEVENLABS_API_KEY:
            try:
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
                headers = {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": ELEVENLABS_API_KEY,
                }
                payload = json.dumps({
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                }).encode("utf-8")

                req = urllib.request.Request(url, data=payload, headers=headers)
                with urllib.request.urlopen(req, timeout=12) as resp:
                    audio_data = resp.read()

                tmp_file = SCRATCH_DIR / f"tts_{int(time.time()*1000)}.mp3"
                tmp_file.write_bytes(audio_data)

                if not pygame.mixer.get_init():
                    pygame.mixer.init()
                pygame.mixer.music.load(str(tmp_file))
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy() and not self.stop_requested:
                    time.sleep(0.05)
                pygame.mixer.music.unload()

                if tmp_file.exists():
                    tmp_file.unlink()
                return
            except Exception:
                pass  # Fall back to Edge-TTS

        # 2. Asynchronous Fallback: Edge-TTS
        try:
            import edge_tts

            async def _run_edge():
                communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
                tmp_file = SCRATCH_DIR / f"edge_{int(time.time()*1000)}.mp3"
                await communicate.save(str(tmp_file))
                return tmp_file

            tmp_path = asyncio.run(_run_edge())
            if not pygame.mixer.get_init():
                pygame.mixer.init()
            pygame.mixer.music.load(str(tmp_path))
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy() and not self.stop_requested:
                time.sleep(0.05)
            pygame.mixer.music.unload()

            if tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass

    def listen_phrase(self, recognizer: sr.Recognizer, mic: sr.Microphone, timeout: float = 3.0) -> str:
        """Captures a single phrase from microphone."""
        try:
            with mic as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.2)
                audio = recognizer.listen(source, timeout=timeout, phrase_time_limit=10)
            text = recognizer.recognize_google(audio)
            return text.strip()
        except (sr.WaitTimeoutError, sr.UnknownValueError):
            return ""
        except Exception:
            return ""
