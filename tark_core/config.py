"""TARK Core Configuration — API keys, Model endpoints, Paths, and System Constants.
"""
from __future__ import annotations

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MEMORY_FILE = BASE_DIR / "tark_memory.json"
GOALS_FILE = BASE_DIR / "tark_goals.json"
SKILLS_DIR = BASE_DIR / "skills"
SCRATCH_DIR = BASE_DIR / "scratch"

# Ensure directories exist
SKILLS_DIR.mkdir(parents=True, exist_ok=True)
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

# Automatically load backend/.env if available
env_path = BASE_DIR / "backend" / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except Exception:
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

# API Keys resolved from environment (.env)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
NVIDIA_NIM_API_KEY = os.environ.get("NVIDIA_NIM_API_KEY", "")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY", "")
NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# ElevenLabs Voice ID (George / Deep English Neural Voice)
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

# Model Architecture Configuration
PRIMARY_REASONING_MODEL = "openai/gpt-oss-120b"
FALLBACK_REASONING_MODEL = "llama-3.3-70b-versatile"
FAST_REASONING_MODEL = "llama-3.1-8b-instant"
VISION_MODEL = "meta/llama-3.2-11b-vision-instruct"

# Wake Words (Sci-Fi Personal AI Recognition)
WAKE_WORDS = [
    "tark", "talk", "tok", "dark", "torque", "tarc", "target", "tarik", "doc", "park",
    "hey tark", "ok tark", "hi tark", "hey talk", "ok talk", "hi talk", "jarvis", "hey jarvis"
]
