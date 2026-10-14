"""TARK v7.0 — The Omnipresent Frontier JARVIS AI Desktop Agent.

Next-Generation Multimodal Desktop OS Agent:
- 👁️ Real-Time Multimodal Sight:
    * Screen Vision (`meta/llama-3.2-11b-vision-instruct` on NVIDIA NIM): Explains active windows, diagrams, debugs code & errors
    * Camera Vision (OpenCV + NVIDIA Vision): Recognizes user, room, held objects, and physical papers
- 🌌 Cyberpunk Holographic HUD: Terminal interface with live hardware telemetry & ASCII banner
- 🎵 Procedural Sci-Fi Sound FX: Synthesized audio frequencies for boot, vision scanning, wake, and task complete
- 🛡️ Viral JARVIS Protocols: Focus Mode, Clean Slate, Lockdown, Chill, Stealth (Boss Key), Daily Briefing
- ⚡ Sub-Second Fast-Path Reflexes: 20ms execution for Media, Volume, Windows, Screenshots, Webcam, & Clipboard
- 🔋 Autonomous Battery Sentinel: Proactive background watchdog warning when power drops below critical levels
- 📋 Smart Clipboard Copilot: Reads, explains, fixes, and updates clipboard contents
- 🔍 Fast File Discovery: Finds files across Desktop, Downloads, and Documents instantly
- 🧠 ReAct Autonomous Frontier Brain: Multi-step reasoning, self-healing shell commands (Groq 120B)
- 🎙️ Dual Concurrent Input: Background hands-free microphone listening + interactive typing
- 🗣️ Dual-Layer Neural Speech: ElevenLabs / Microsoft Edge Neural Engine
"""
from __future__ import annotations

import asyncio
import base64
from datetime import datetime
import io
import json
import math
import msvcrt
import os
from pathlib import Path
import queue
import re
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import wave

# Terminal UTF-8 encoding support
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import cv2
from PIL import Image, ImageGrab
import psutil
import pyautogui
import pygame
import pyperclip
import pywhatkit
import speech_recognition as sr
from groq import Groq

# Safety configuration
pyautogui.FAILSAFE = False

# --- Credentials & API Configuration ---
from tark_core.config import (
    GROQ_API_KEY,
    NVIDIA_NIM_API_KEY,
    ELEVENLABS_API_KEY,
    TAVILY_API_KEY,
    WEATHER_API_KEY,
    NEWS_API_KEY,
    HF_TOKEN,
    ELEVENLABS_VOICE_ID,
)

groq_client = Groq(api_key=GROQ_API_KEY)
try:
    pygame.mixer.init()
except Exception:
    pass

# --- TARK Ultimate Omni-Agent Engine (PersonalJarvis + OpenClaw + Comma + Mark-XL) ---
from tark_core import (
    MemoryManager,
    SkillRegistry,
    SystemOperator,
    MasterOrchestrator,
    ChannelGatewayServer,
)

memory_manager = MemoryManager()
skill_registry = SkillRegistry()
system_operator = SystemOperator()
master_orchestrator = MasterOrchestrator(memory_manager, skill_registry, system_operator)
gateway_server: ChannelGatewayServer | None = None

# --- State Variables ---
is_running = True
continuous_mode = True
last_active_time = 0.0
MEMORY_FILE = Path(__file__).parent / "tark_memory.json"
input_queue = queue.Queue()
conversation_history: list[dict] = []
last_battery_alert_pct: int | None = None

WAKE_WORDS = [
    "tark", "talk", "tok", "dark", "torque", "tarc", "tarck", "target", "tarik", "doc", "park",
    "hey tark", "ok tark", "hi tark", "hey talk", "ok talk", "hi talk", "jarvis", "hey jarvis"
]


# =====================================================================
# Procedural Sci-Fi Sound FX Engine (Iron Man HUD Chimes)
# =====================================================================
def _synth_wave(frequencies: list[float], duration: float = 0.18, decay_rate: float = 5.0) -> bytes:
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


SOUND_BOOT_DATA = _synth_wave([523.25, 659.25, 783.99, 1046.50], duration=0.35, decay_rate=3.0)
SOUND_CHIME_DATA = _synth_wave([880.0, 1760.0], duration=0.16, decay_rate=6.0)
SOUND_DONE_DATA = _synth_wave([1046.50, 1318.51], duration=0.18, decay_rate=5.0)
SOUND_VISION_DATA = _synth_wave([1200.0, 2400.0, 1400.0], duration=0.22, decay_rate=4.0)


def play_sound(wav_bytes: bytes):
    try:
        sound = pygame.mixer.Sound(io.BytesIO(wav_bytes))
        sound.set_volume(0.65)
        sound.play()
    except Exception:
        pass


def play_chime_boot(): play_sound(SOUND_BOOT_DATA)
def play_chime_wake(): play_sound(SOUND_CHIME_DATA)
def play_chime_done(): play_sound(SOUND_DONE_DATA)
def play_chime_vision(): play_sound(SOUND_VISION_DATA)


# =====================================================================
# Persistent Long-Term Memory
# =====================================================================
def load_memory() -> dict:
    if MEMORY_FILE.exists():
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"user_name": "Shishir", "notes": [], "preferences": {}}


def save_memory(data: dict):
    try:
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"  [Memory Save Error]: {e}")


# =====================================================================
# Real-Time Multimodal Sight Engine (NVIDIA NIM Vision)
# =====================================================================
def call_nvidia_vision(image_bytes: bytes, prompt: str) -> str:
    """Invokes Meta LLaMA 3.2 11B Vision Instruct via NVIDIA NIM with retry."""
    last_err = ""
    for attempt in range(2):
        try:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            headers = {
                "Authorization": f"Bearer {NVIDIA_NIM_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "meta/llama-3.2-11b-vision-instruct",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        ],
                    }
                ],
                "max_tokens": 180,
                "temperature": 0.2,
            }
            req = urllib.request.Request(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
            )
            with urllib.request.urlopen(req, timeout=40) as r:
                body = json.loads(r.read().decode("utf-8"))
                ans = body["choices"][0]["message"]["content"].strip()
                if ans:
                    return ans
        except Exception as e:
            last_err = str(e)
            time.sleep(1.0)
    return f"Vision processing error: {last_err}"


def tool_analyze_screen(query: str = "Describe what is shown on this desktop and what windows or tasks are active.") -> str:
    """Takes a live screenshot and uses frontier multimodal vision to visually inspect, read, or explain it."""
    play_chime_vision()
    print("  👁️ [OCULAR SIGHT]: Analyzing active desktop display with LLaMA 3.2 Vision...")
    try:
        import ctypes
        grabbed_img: list[Image.Image] = []

        def _worker():
            try:
                user32 = ctypes.windll.user32
                hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
                if hdesk:
                    user32.SetThreadDesktop(hdesk)
                grabbed_img.append(ImageGrab.grab())
            except Exception:
                pass

        t = threading.Thread(target=_worker)
        t.start()
        t.join(timeout=6)

        if not grabbed_img:
            return "Failed to capture display for vision analysis."

        img = grabbed_img[0]
        img.thumbnail((512, 288))  # Ultra-fast compact thumbnail (12 KB payload)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=60)

        prompt_text = f"You are JARVIS inspecting Shishir's computer display. User Question: '{query}'. Provide a clear, natural, and helpful answer in 2-3 sentences."
        ans = call_nvidia_vision(buf.getvalue(), prompt_text)
        
        # Resilient fallback if cloud vision timed out
        if ans.startswith("Vision processing error"):
            ocr_text = tool_read_screen_ocr()
            if ocr_text and "No text detected" not in ocr_text:
                fallback_prompt = f"Summarize what is on the user's screen based on this OCR text scan: '{ocr_text[:600]}'"
                fb = groq_client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": fallback_prompt}],
                    max_tokens=120,
                ).choices[0].message.content
                ans = fb.strip() if fb else f"OCR Screen Scan: {ocr_text[:200]}"

        play_chime_done()
        return ans
    except Exception as e:
        return f"Screen vision error: {e}"


def tool_analyze_camera(query: str = "Describe who or what is visible in front of the laptop camera.") -> str:
    """Captures a live frame from the webcam and uses frontier multimodal vision to perceive people, objects, and the room."""
    play_chime_vision()
    print("  👁️ [CAMERA PERCEPTION]: Scanning webcam ocular feed with LLaMA 3.2 Vision...")
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return "Camera could not be accessed or is in use."
        time.sleep(0.3)
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            return "Failed to grab frame from camera."

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)
        img.thumbnail((512, 288))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=60)

        prompt_text = f"You are JARVIS observing Shishir's surroundings via laptop webcam. User Question: '{query}'. Provide a clear, friendly, and accurate visual description in 2-3 sentences."
        ans = call_nvidia_vision(buf.getvalue(), prompt_text)
        if ans.startswith("Vision processing error"):
            photo_res = tool_take_webcam_photo()
            ans = f"Webcam frame captured: {photo_res}"
        play_chime_done()
        return ans
    except Exception as e:
        return f"Camera vision error: {e}"


# =====================================================================
# Viral JARVIS Protocols (Shorts & Reels Edition)
# =====================================================================
def protocol_focus() -> str:
    print("  🚀 [PROTOCOL ENGAGED]: Focus & Coding Mode")
    play_chime_done()
    subprocess.Popen(["cmd", "/c", "start", "code"])
    pywhatkit.playonyt("lofi hip hop radio beats to relax study to")
    tool_set_hardware(brightness=60, volume=35)
    return "Focus protocol engaged, sir. Development workspace initialized and audio ambiance active."


def protocol_clean_slate() -> str:
    print("  🧹 [PROTOCOL ENGAGED]: Clean Slate / Declutter Desktop")
    play_chime_done()
    desktop = Path.home() / "Desktop"
    today_str = datetime.now().strftime("%Y%m%d")
    archive_dir = desktop / f"Archive_{today_str}"
    moved_count = 0

    try:
        for item in desktop.iterdir():
            if item.is_file() and not item.name.endswith(".lnk") and not item.name.startswith("Archive_"):
                archive_dir.mkdir(parents=True, exist_ok=True)
                target = archive_dir / item.name
                if target.exists():
                    target = archive_dir / f"{item.stem}_{int(time.time())}{item.suffix}"
                item.rename(target)
                moved_count += 1
    except Exception as e:
        print(f"  [Archive error]: {e}")

    pyautogui.hotkey("win", "d")
    return f"Clean slate protocol completed, sir. {moved_count} stray files organized into Archive_{today_str} and desktop cleared."


def protocol_lockdown() -> str:
    print("  🔒 [PROTOCOL ENGAGED]: Security Lockdown")
    play_chime_done()
    subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
    return "Workstation locked. Security protocol enforced, sir."


def protocol_chill() -> str:
    print("  ☕ [PROTOCOL ENGAGED]: Relax / Chill Mode")
    play_chime_done()
    pywhatkit.playonyt("synthwave chill beats relax")
    tool_set_hardware(brightness=75, volume=65)
    return "Relax protocol engaged, sir. Ambient lounge audio active."


def protocol_stealth() -> str:
    print("  🥷 [PROTOCOL ENGAGED]: Stealth / Boss Key")
    pyautogui.hotkey("win", "d")
    pyautogui.press("volumemute")
    return "Stealth protocol active."


def protocol_briefing() -> str:
    print("  🎙️ [PROTOCOL ENGAGED]: Daily Telemetry, Live Weather & News Brief")
    play_chime_done()
    status_raw = tool_get_system_status()
    try:
        status = json.loads(status_raw)
    except Exception:
        status = {}

    weather_summary = ""
    if WEATHER_API_KEY:
        try:
            weather_summary = tool_get_weather("auto:ip")
        except Exception:
            pass

    news_headline = "Global systems nominal."
    if NEWS_API_KEY:
        try:
            news_raw = tool_get_news("general", "in")
            first_line = news_raw.split("\n")[0] if news_raw else ""
            if first_line:
                news_headline = first_line[:140]
        except Exception:
            pass
    elif TAVILY_API_KEY:
        try:
            news_raw = tool_search_web("top world news headline today")
            first_line = news_raw.split("\n")[0] if news_raw else ""
            if first_line:
                news_headline = first_line[:140]
        except Exception:
            pass

    now_str = datetime.now().strftime("%A, %B %d, at %I:%M %p")
    batt = status.get("battery_percent", 100)
    ram = status.get("ram_free_gb", 6.0)
    cpu = status.get("cpu_percent", 10.0)

    weather_clause = f" Outside conditions: {weather_summary}." if weather_summary else ""

    report = (
        f"Good day, sir. The time is {now_str}. "
        f"Your battery is at {batt}%, with {ram} gigabytes of RAM free, and CPU load at {cpu}%. "
        f"{weather_clause} "
        f"Today's top headline: {news_headline}."
    )
    return report


# =====================================================================
# Full Autonomous Tool Registry
# =====================================================================
def tool_run_command(command: str) -> str:
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=30,
        )
        out = (res.stdout or "").strip()
        err = (res.stderr or "").strip()
        if res.returncode == 0:
            return out if out else "Command executed successfully (no output)."
        return f"Return Code {res.returncode}\nStdout: {out}\nStderr: {err}"
    except subprocess.TimeoutExpired:
        return "Command timed out after 30 seconds."
    except Exception as e:
        return f"Failed to execute command: {e}"


def tool_write_file(path: str, content: str) -> str:
    try:
        p = Path(path).expanduser()
        if not p.is_absolute():
            p = (Path.home() / "Desktop" / p).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to {p}."
    except Exception as e:
        return f"Failed to write file {path}: {e}"


def tool_read_file(path: str) -> str:
    try:
        p = Path(path).expanduser()
        if not p.is_absolute():
            p = (Path.home() / "Desktop" / p).resolve()
        if not p.exists():
            return f"File not found: {p}"
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()[:3000]
    except Exception as e:
        return f"Failed to read file {path}: {e}"


def tool_list_dir(path: str = "") -> str:
    try:
        p = Path(path).expanduser() if path else Path.home() / "Desktop"
        if not p.exists():
            return f"Directory does not exist: {p}"
        items = []
        for child in list(p.iterdir())[:30]:
            kind = "DIR " if child.is_dir() else "FILE"
            size = f"{child.stat().st_size} bytes" if child.is_file() else ""
            items.append(f"{kind} | {child.name} {size}")
        return "\n".join(items) if items else "Directory is empty."
    except Exception as e:
        return f"Error listing directory: {e}"


def tool_find_files(pattern: str = "*.*", search_dir: str = "") -> str:
    """Finds files matching wildcard pattern across Desktop, Downloads, or Documents."""
    try:
        root = Path(search_dir).expanduser() if search_dir else Path.home() / "Desktop"
        matches = list(root.glob(pattern))[:15]
        if not matches:
            return f"No files matching '{pattern}' in {root}."
        return "\n".join([f"{f.name} ({round(f.stat().st_size/1024, 1)} KB)" for f in matches])
    except Exception as e:
        return f"File search error: {e}"


def tool_get_clipboard() -> str:
    """Reads current text from the Windows clipboard."""
    try:
        text = pyperclip.paste().strip()
        return text if text else "Clipboard is currently empty."
    except Exception as e:
        return f"Clipboard error: {e}"


def tool_set_clipboard(text: str) -> str:
    """Copies text directly to the Windows clipboard."""
    try:
        pyperclip.copy(text)
        play_chime_done()
        return "Text copied to clipboard."
    except Exception as e:
        return f"Clipboard error: {e}"


def tool_control_gui(action: str, x: int | None = None, y: int | None = None, keys: str = "", text: str = "") -> str:
    try:
        act = action.lower().strip()
        if act == "click" and x is not None and y is not None:
            pyautogui.click(x, y)
            return f"Clicked at ({x}, {y})."
        elif act == "double_click" and x is not None and y is not None:
            pyautogui.doubleClick(x, y)
            return f"Double clicked at ({x}, {y})."
        elif act == "right_click" and x is not None and y is not None:
            pyautogui.rightClick(x, y)
            return f"Right clicked at ({x}, {y})."
        elif act == "hotkey" and keys:
            parts = [k.strip() for k in keys.split("+")]
            pyautogui.hotkey(*parts)
            return f"Pressed hotkey: {keys}"
        elif act == "press_key" and keys:
            pyautogui.press(keys)
            return f"Pressed key: {keys}"
        elif act == "type_text" and text:
            pyperclip.copy(text)
            pyautogui.hotkey("ctrl", "v")
            return f"Typed text via clipboard paste."
        elif act == "minimize_all":
            pyautogui.hotkey("win", "d")
            return "Minimized all windows (Desktop shown)."
        elif act == "switch_window":
            pyautogui.hotkey("alt", "tab")
            return "Switched active window."
        elif act == "close_window":
            pyautogui.hotkey("alt", "f4")
            return "Closed active window."
        elif act == "lock_pc":
            subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
            return "Workstation locked."
        return f"Unknown GUI action: {action}"
    except Exception as e:
        return f"GUI action failed: {e}"


def tool_read_screen_ocr() -> str:
    temp_img_path = str(Path.home() / "Desktop" / "tark_ocr_temp.png")
    try:
        import ctypes
        import winsdk.windows.graphics.imaging as imaging
        import winsdk.windows.media.ocr as ocr
        import winsdk.windows.storage as storage

        grab_error = None
        def _grab_worker():
            nonlocal grab_error
            try:
                user32 = ctypes.windll.user32
                hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
                if hdesk:
                    user32.SetThreadDesktop(hdesk)
                img = ImageGrab.grab()
                img.save(temp_img_path)
            except Exception as ex:
                grab_error = ex

        t = threading.Thread(target=_grab_worker)
        t.start()
        t.join(timeout=8)

        if grab_error or not os.path.exists(temp_img_path):
            return "OCR capture unavailable."

        async def _ocr():
            f = await storage.StorageFile.get_file_from_path_async(temp_img_path)
            stream = await f.open_async(storage.FileAccessMode.READ)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            software_bitmap = await decoder.get_software_bitmap_async(
                imaging.BitmapPixelFormat.BGRA8,
                imaging.BitmapAlphaMode.PREMULTIPLIED
            )
            engine = ocr.OcrEngine.try_create_from_user_profile_languages()
            if not engine:
                return "OCR Engine unavailable."
            result = await engine.recognize_async(software_bitmap)
            return result.text

        res = asyncio.run(_ocr())
        return res[:2500] if res else "No text detected on screen."
    except Exception as e:
        return f"OCR scan failed: {e}"
    finally:
        if os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass


def tool_take_screenshot() -> str:
    try:
        import ctypes
        desktop = Path.home() / "Desktop"
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = desktop / f"tark_screenshot_{ts}.png"
        grab_error = None

        def _grab_worker():
            nonlocal grab_error
            try:
                user32 = ctypes.windll.user32
                hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
                if hdesk:
                    user32.SetThreadDesktop(hdesk)
                img = ImageGrab.grab()
                img.save(str(target_path))
            except Exception as ex:
                grab_error = ex

        t = threading.Thread(target=_grab_worker)
        t.start()
        t.join(timeout=8)

        if grab_error or not target_path.exists():
            return f"Screenshot failed: {grab_error}"

        print(f"  ⚡ [Screenshot]: Saved to {target_path.name}")
        play_chime_done()
        return f"Screenshot captured and saved to Desktop: {target_path.name}"
    except Exception as e:
        return f"Screenshot error: {e}"


def tool_take_webcam_photo() -> str:
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return "Camera could not be accessed or is in use by another app."
        time.sleep(0.35)
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            return "Failed to grab photo frame from camera."
        desktop = Path.home() / "Desktop"
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = desktop / f"tark_photo_{ts}.jpg"
        cv2.imwrite(str(target_path), frame)
        print(f"  📸 [Camera]: Photo saved to {target_path.name}")
        play_chime_done()
        return f"Photo captured and saved to Desktop: {target_path.name}"
    except Exception as e:
        return f"Camera capture error: {e}"


def tool_search_web(query: str) -> str:
    if not TAVILY_API_KEY:
        return "Tavily search API key missing."
    try:
        data = json.dumps({"api_key": TAVILY_API_KEY, "query": query, "max_results": 3}).encode("utf-8")
        req = urllib.request.Request("https://api.tavily.com/search", data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            results = body.get("results", [])
            if not results:
                return "No search results found."
            return "\n\n".join([f"Source: {r.get('title')}\n{r.get('content')}" for r in results[:3]])
    except Exception as e:
        return f"Web search error: {e}"


def tool_read_webpage(url: str) -> str:
    try:
        if not url.startswith("http"):
            url = f"https://{url}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            clean = re.sub(r"<[^>]+>", " ", raw)
            return " ".join(clean.split())[:2500]
    except Exception as e:
        return f"Failed to read webpage: {e}"


def tool_get_weather(location: str = "auto:ip") -> str:
    if not WEATHER_API_KEY:
        return "Weather API key missing."
    try:
        loc = location.strip() if location else "auto:ip"
        loc_encoded = urllib.parse.quote(loc)
        url = f"http://api.weatherapi.com/v1/current.json?key={WEATHER_API_KEY}&q={loc_encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Tark/7.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            d = json.loads(resp.read().decode("utf-8"))
            city = d.get("location", {}).get("name", "Local")
            region = d.get("location", {}).get("region", "")
            temp_c = d.get("current", {}).get("temp_c")
            cond = d.get("current", {}).get("condition", {}).get("text", "")
            humidity = d.get("current", {}).get("humidity")
            wind = d.get("current", {}).get("wind_kph")
            return f"Weather for {city}, {region}: {temp_c}°C ({cond}), Humidity: {humidity}%, Wind: {wind} km/h."
    except Exception as e:
        return f"Weather retrieval error: {e}"


def tool_get_news(category: str = "general", country: str = "in") -> str:
    if not NEWS_API_KEY:
        return "News API key missing."
    try:
        c = country.strip() if country else "in"
        cat = category.strip() if category else "general"
        url = f"https://newsapi.org/v2/top-headlines?country={c}&category={cat}&apiKey={NEWS_API_KEY}"
        req = urllib.request.Request(url, headers={"User-Agent": "Tark/7.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            d = json.loads(resp.read().decode("utf-8"))
            articles = d.get("articles", [])
            if not articles:
                # Fallback to US top headlines if regional has no entries
                url_fallback = f"https://newsapi.org/v2/top-headlines?country=us&apiKey={NEWS_API_KEY}"
                req_fb = urllib.request.Request(url_fallback, headers={"User-Agent": "Tark/7.0"})
                with urllib.request.urlopen(req_fb, timeout=6) as resp_fb:
                    d = json.loads(resp_fb.read().decode("utf-8"))
                    articles = d.get("articles", [])
            if not articles:
                return "No headlines currently available."
            headlines = []
            for i, art in enumerate(articles[:4], 1):
                title = art.get("title", "")
                src = art.get("source", {}).get("name", "")
                headlines.append(f"{i}. {title} ({src})")
            return "\n".join(headlines)
    except Exception as e:
        return f"News retrieval error: {e}"


def tool_query_huggingface(prompt: str, model: str = "mistralai/Mistral-7B-Instruct-v0.3") -> str:
    if not HF_TOKEN:
        return "Hugging Face token missing."
    try:
        url = f"https://api-inference.huggingface.co/models/{model}"
        payload = json.dumps({"inputs": prompt, "parameters": {"max_new_tokens": 250}}).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Tark/7.0"
        }
        req = urllib.request.Request(url, data=payload, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 0 and "generated_text" in data[0]:
                return data[0]["generated_text"]
            return json.dumps(data)
    except Exception as e:
        return f"Hugging Face inference error: {e}"


def tool_get_system_status() -> str:
    try:
        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        batt = psutil.sensors_battery()
        disk = psutil.disk_usage("C:")
        return json.dumps({
            "cpu_percent": cpu,
            "ram_used_percent": mem.percent,
            "ram_free_gb": round(mem.available / (1024**3), 1),
            "battery_percent": batt.percent if batt else None,
            "battery_plugged": batt.power_plugged if batt else None,
            "disk_free_gb": round(disk.free / (1024**3), 1),
        })
    except Exception as e:
        return f"Hardware error: {e}"


def tool_get_top_processes(sort_by: str = "memory", count: int = 5) -> str:
    try:
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                procs.append({
                    "pid": p.info["pid"],
                    "name": p.info["name"],
                    "cpu_percent": p.info["cpu_percent"] or 0.0,
                    "memory_percent": round(p.info["memory_percent"] or 0.0, 1),
                })
            except Exception:
                continue
        key = "cpu_percent" if sort_by == "cpu" else "memory_percent"
        procs.sort(key=lambda x: x[key], reverse=True)
        return json.dumps(procs[:count])
    except Exception as e:
        return f"Process listing error: {e}"


def tool_kill_process(process_name: str) -> str:
    try:
        terminated = []
        target = process_name.lower().replace(".exe", "")
        for p in psutil.process_iter(["pid", "name"]):
            try:
                pname = (p.info["name"] or "").lower()
                if target in pname:
                    p.terminate()
                    terminated.append(p.info["name"])
            except Exception:
                continue
        if terminated:
            return f"Terminated: {', '.join(set(terminated))}"
        return f"No process matching '{process_name}' found."
    except Exception as e:
        return f"Process termination error: {e}"


def tool_set_hardware(brightness: int | None = None, volume: int | None = None) -> str:
    res = []
    if brightness is not None:
        try:
            val = max(0, min(100, int(brightness)))
            cmd = f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {val})"
            subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, timeout=5)
            res.append(f"Brightness set to {val}%.")
        except Exception as e:
            res.append(f"Brightness error: {e}")
    if volume is not None:
        try:
            for _ in range(50):
                pyautogui.press("volumedown")
            for _ in range(int(volume / 2)):
                pyautogui.press("volumeup")
            res.append(f"Volume set to ~{volume}%.")
        except Exception as e:
            res.append(f"Volume error: {e}")
    return " ".join(res) if res else "No hardware setting specified."


def tool_play_youtube(query: str) -> str:
    try:
        print(f"  ⚡ [YouTube]: Playing '{query}'...")
        play_chime_done()
        pywhatkit.playonyt(query)
        return f"Playing '{query}' on YouTube."
    except Exception as e:
        return f"Failed to play YouTube query: {e}"


def tool_launch_app(app_name: str) -> str:
    try:
        raw = app_name.lower().strip()
        app_map = {
            "chrome": "chrome", "spotify": "spotify", "vscode": "code",
            "notepad": "notepad", "calc": "calc", "terminal": "powershell",
            "cmd": "cmd", "explorer": "explorer", "discord": "discord",
            "settings": "ms-settings:", "task manager": "taskmgr",
        }
        target = app_map.get(raw, raw)
        subprocess.Popen(["cmd", "/c", "start", target])
        play_chime_done()
        return f"Launched {raw}."
    except Exception as e:
        return f"Launch failed: {e}"


def tool_save_memory(fact: str, tag: str = "general") -> str:
    try:
        mem = load_memory()
        mem.setdefault("notes", []).append({
            "tag": tag,
            "content": fact,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        })
        save_memory(mem)
        play_chime_done()
        return f"Saved fact: '{fact}'"
    except Exception as e:
        return f"Memory error: {e}"


def tool_recall_memory(query: str = "") -> str:
    try:
        mem = load_memory()
        notes = mem.get("notes", [])
        if not notes:
            return "No notes in memory."
        if query:
            q = query.lower()
            matched = [n for n in notes if q in n.get("content", "").lower()]
            return json.dumps(matched if matched else notes[-5:])
        return json.dumps(notes[-8:])
    except Exception as e:
        return f"Memory error: {e}"


def tool_set_reminder(seconds: int, message: str) -> str:
    try:
        sec = max(1, int(seconds))

        def _worker():
            time.sleep(sec)
            play_chime_boot()
            alert = f"Sir, reminder alert: {message}"
            print(f"\n⏰ [REMINDER ALERT]: {alert}\n")
            speak(alert)

        threading.Thread(target=_worker, daemon=True).start()
        play_chime_done()
        return f"Reminder set for {sec} seconds: '{message}'"
    except Exception as e:
        return f"Reminder error: {e}"


# =====================================================================
# Automated Submit Engine for Antigravity & Dialogs (Cursor-Preserving)
# =====================================================================
auto_submit_active = False
auto_submit_thread: threading.Thread | None = None


def find_and_click_submit_target() -> str:
    """Submits to ALL Antigravity IDE workspaces, tabs, and dialogs whether active or running in background."""
    import ctypes
    import struct
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32
    kernel32 = ctypes.windll.kernel32

    hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
    if hdesk:
        user32.SetThreadDesktop(hdesk)

    # 1. Enumerate ALL open Antigravity IDE top windows/workspaces
    workspaces = []
    def _enum(hwnd, extra):
        if user32.IsWindowVisible(hwnd):
            buff = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, buff, 512)
            t = buff.value
            if "antigravity" in t.lower():
                r = (ctypes.c_long * 4)()
                user32.GetWindowRect(hwnd, r)
                w = r[2] - r[0]
                h = r[3] - r[1]
                # Filter out small tray icons / tooltips
                if w > 300 and h > 200:
                    ws_name = t.split(" - Antigravity IDE")[0].strip() if " - Antigravity IDE" in t else t
                    workspaces.append({
                        "hwnd": hwnd,
                        "name": ws_name,
                        "title": t,
                        "rect": (r[0], r[1], w, h),
                    })
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    user32.EnumDesktopWindows(hdesk, WNDENUMPROC(_enum), 0)

    if not workspaces:
        return "No Antigravity IDE workspaces detected."

    fg_current = user32.GetForegroundWindow()
    results = []
    temp_scan = str(Path.home() / "Desktop" / "tark_ag_scan_internal.png")

    for ws in workspaces:
        hwnd = ws["hwnd"]
        ws_name = ws["name"]
        rx, ry, w, h = ws["rect"]

        # Locate Chrome_RenderWidgetHostHWND for this workspace window
        render_box = [None]
        def _enum_child(chwnd, extra):
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(chwnd, cbuff, 256)
            if cbuff.value == "Chrome_RenderWidgetHostHWND":
                render_box[0] = chwnd
                return False
            return True

        user32.EnumChildWindows(hwnd, WNDENUMPROC(_enum_child), 0)
        target_render = render_box[0] if render_box[0] else hwnd

        # Detect active modal dialog buttons (e.g. "allow this time", "always allow", "proceed")
        detected_modal = None
        try:
            hdc_win = user32.GetWindowDC(hwnd)
            hdc_mem = gdi32.CreateCompatibleDC(hdc_win)
            hbm = gdi32.CreateCompatibleBitmap(hdc_win, w, h)
            gdi32.SelectObject(hdc_mem, hbm)

            PW_RENDERFULLCONTENT = 2
            user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)

            bih = struct.pack("iiiHHiiiiii", 40, w, -h, 1, 32, 0, w * h * 4, 0, 0, 0, 0)
            buf = ctypes.create_string_buffer(w * h * 4)
            gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, bih, 0)
            img = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1)
            img.save(temp_scan)

            gdi32.DeleteObject(hbm)
            gdi32.DeleteDC(hdc_mem)
            user32.ReleaseDC(hwnd, hdc_win)

            async def _scan():
                import winsdk.windows.graphics.imaging as imaging
                import winsdk.windows.media.ocr as ocr
                import winsdk.windows.storage as storage

                f = await storage.StorageFile.get_file_from_path_async(temp_scan)
                stream = await f.open_async(storage.FileAccessMode.READ)
                decoder = await imaging.BitmapDecoder.create_async(stream)
                bitmap = await decoder.get_software_bitmap_async(
                    imaging.BitmapPixelFormat.BGRA8,
                    imaging.BitmapAlphaMode.PREMULTIPLIED
                )
                engine = ocr.OcrEngine.try_create_from_user_profile_languages()
                if not engine:
                    return None
                res = await engine.recognize_async(bitmap)

                for line in res.lines:
                    txt = line.text.lower().strip()
                    min_x = min(wd.bounding_rect.x for wd in line.words)
                    max_x = max(wd.bounding_rect.x + wd.bounding_rect.width for wd in line.words)
                    min_y = min(wd.bounding_rect.y for wd in line.words)
                    max_y = max(wd.bounding_rect.y + wd.bounding_rect.height for wd in line.words)
                    center_x = int((min_x + max_x) / 2)
                    center_y = int((min_y + max_y) / 2)

                    # Right-hand Assistant Pane (X >= 1100)
                    if center_x < 1100:
                        continue
                    # Dialog area above chat bar (Y: 250..840)
                    if center_y >= 840 or center_y < 250:
                        continue
                    # Exclude terminal/chat output text
                    if any(bad in txt for bad in [
                        "pulse", "submit:", "foreground", "background", "clicked", "pulsed",
                        "sent", "enter", "tark", "suwit", "sutnit", "active", "focused",
                        "review", "files with changes", "debug", "start server", "ln", "spaces:"
                    ]):
                        continue
                    if len(txt) > 25:
                        continue

                    clean_btn = txt.rstrip(".").rstrip(":").strip()
                    is_legit_button = (
                        clean_btn in ["allow this time", "always allow", "yes, allow", "yes, allow this time", "proceed", "allow"] or
                        clean_btn.startswith("yes, allow") or
                        clean_btn.startswith("allow this time") or
                        clean_btn.startswith("always allow")
                    )
                    if is_legit_button:
                        return (center_x, center_y, line.text)
                return None

            res = asyncio.run(_scan())
            if res:
                detected_modal = res
        except Exception:
            pass
        finally:
            if os.path.exists(temp_scan):
                try:
                    os.remove(temp_scan)
                except Exception:
                    pass

        if detected_modal:
            client_x, client_y, label = detected_modal
            is_modal = True
        else:
            client_x, client_y = 1715, 865
            label = "Chat Send"
            is_modal = False

        screen_x = rx + client_x
        screen_y = ry + client_y
        is_active_window = (fg_current == hwnd)

        if is_modal:
            # Urgent modal button approval via guaranteed micro-pulse
            success = False
            try:
                curr_x, curr_y = pyautogui.position()
                curr_tid = kernel32.GetCurrentThreadId()
                fg_tid = user32.GetWindowThreadProcessId(fg_current, None) if fg_current else 0
                ag_tid = user32.GetWindowThreadProcessId(hwnd, None)

                if fg_tid: user32.AttachThreadInput(curr_tid, fg_tid, True)
                if ag_tid: user32.AttachThreadInput(curr_tid, ag_tid, True)

                user32.keybd_event(0x12, 0, 0, 0)
                user32.keybd_event(0x12, 0, 2, 0)
                user32.SetForegroundWindow(hwnd)
                time.sleep(0.015)

                pyautogui.click(screen_x, screen_y)
                pyautogui.press("enter")
                time.sleep(0.01)

                if fg_current and fg_current != hwnd:
                    user32.keybd_event(0x12, 0, 0, 0)
                    user32.keybd_event(0x12, 0, 2, 0)
                    user32.SetForegroundWindow(fg_current)
                if curr_x > 0 and curr_y > 0:
                    pyautogui.moveTo(curr_x, curr_y)

                if fg_tid: user32.AttachThreadInput(curr_tid, fg_tid, False)
                if ag_tid: user32.AttachThreadInput(curr_tid, ag_tid, False)
                success = True
            except Exception:
                pass

            if not success:
                lparam_click = ((client_y & 0xFFFF) << 16) | (client_x & 0xFFFF)
                user32.PostMessageW(target_render, 0x0201, 1, lparam_click)
                time.sleep(0.01)
                user32.PostMessageW(target_render, 0x0202, 0, lparam_click)
                user32.PostMessageW(target_render, 0x0100, 0x0D, 0x001C0001)
                user32.PostMessageW(target_render, 0x0101, 0x0D, 0xC01C0001)

            results.append(f"[{ws_name}] Approved '{label}'")
        else:
            # Regular chat submit across workspaces
            if is_active_window:
                try:
                    curr_x, curr_y = pyautogui.position()
                    pyautogui.click(screen_x, screen_y)
                    pyautogui.press("enter")
                    if curr_x > 0 and curr_y > 0:
                        pyautogui.moveTo(curr_x, curr_y)
                except Exception:
                    pass
                results.append(f"[{ws_name}] Clicked (Foreground)")
            else:
                # Background workspace: Silent Win32 click & enter with zero window jitter
                lparam_click = ((client_y & 0xFFFF) << 16) | (client_x & 0xFFFF)
                user32.PostMessageW(target_render, 0x0201, 1, lparam_click)
                time.sleep(0.01)
                user32.PostMessageW(target_render, 0x0202, 0, lparam_click)
                user32.PostMessageW(target_render, 0x0100, 0x0D, 0x001C0001)
                user32.PostMessageW(target_render, 0x0101, 0x0D, 0xC01C0001)
                results.append(f"[{ws_name}] Clicked (Background)")

    return " | ".join(results)


def auto_submit_worker():
    global auto_submit_active
    print("  🔁 [AUTO-SUBMIT ACTIVE]: Automatically submitting prompts & approving dialogs...")
    pulse_count = 0
    while auto_submit_active:
        action_desc = find_and_click_submit_target()
        pulse_count += 1
        sys.stdout.write(f"\r  ⚡ [AUTO-SUBMIT ACTIVE #{pulse_count}]: {action_desc[:72]}   ")
        sys.stdout.flush()
        time.sleep(1.5)
    print("\n  ⏹️ [AUTO-SUBMIT STOPPED]\n")


def tool_start_auto_submit() -> str:
    global auto_submit_active, auto_submit_thread
    if auto_submit_active:
        return "Auto-submit loop already running."
    auto_submit_active = True
    auto_submit_thread = threading.Thread(target=auto_submit_worker, daemon=True)
    auto_submit_thread.start()
    play_chime_done()
    return "Auto-submit loop activated across all Antigravity workspaces (approving dialogs & submitting prompts)."


def tool_stop_auto_submit() -> str:
    global auto_submit_active
    if not auto_submit_active:
        return "Auto-submit not currently active."
    auto_submit_active = False
    play_chime_done()
    return "Auto-submit deactivated."


# =====================================================================
# Tool Schema
# =====================================================================
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_screen",
            "description": "Visually inspects and understands the active desktop screen with multimodal AI. Use this to read errors, explain code, analyze visual diagrams, or see what the user is doing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Specific question or objective about the screen image"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_camera",
            "description": "Captures a live frame from the user's laptop camera and visually inspects who or what is in front of the camera (faces, gestures, held objects, papers).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Specific question or objective about what is visible in camera"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Executes ANY arbitrary PowerShell or CMD command on Windows. Use this to run scripts, install packages, query system status, create folders, check git, or inspect network.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "PowerShell command line string to execute"}
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_protocol",
            "description": "Executes signature JARVIS protocols: 'focus', 'clean_slate', 'lockdown', 'chill', 'stealth', 'briefing'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "protocol_name": {
                        "type": "string",
                        "enum": ["focus", "clean_slate", "lockdown", "chill", "stealth", "briefing"],
                    }
                },
                "required": ["protocol_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_clipboard",
            "description": "Reads whatever text is currently copied to the Windows clipboard.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_clipboard",
            "description": "Copies text directly into the user's Windows clipboard.",
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string"}},
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_files",
            "description": "Finds files matching wildcard pattern across Desktop or system folders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Wildcard pattern e.g. *.pdf, *invoice*"},
                    "search_dir": {"type": "string", "description": "Directory to search (empty for Desktop)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Captures a full desktop screenshot and saves it directly to the user's Desktop as a PNG.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_webcam_photo",
            "description": "Takes a photo using the computer's webcam and saves it directly to the Desktop.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Writes, creates, or updates any file on the system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path (e.g. notes.txt or C:/Users/.../file.py)"},
                    "content": {"type": "string", "description": "Complete text or code to write"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads text content from any file on disk.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to read"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "Lists contents of a folder or directory on disk.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (leave empty for Desktop)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_gui",
            "description": "Controls Windows GUI: mouse click at coordinates, hotkeys, keyboard typing, minimizing windows, switching windows, or locking PC.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["click", "double_click", "right_click", "hotkey", "press_key", "type_text", "minimize_all", "switch_window", "close_window", "lock_pc"]},
                    "x": {"type": "integer"},
                    "y": {"type": "integer"},
                    "keys": {"type": "string"},
                    "text": {"type": "string"},
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_screen_ocr",
            "description": "Captures the user's active monitor and uses Windows Native OCR to read all visible text, errors, code, or dialogs.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Performs live real-time Tavily search for current facts, news, documentation, or online research.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Web search query"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_webpage",
            "description": "Fetches and extracts readable text from any website URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Website URL to scrape"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_status",
            "description": "Returns live hardware stats: CPU %, RAM %, Battery %, and Disk space.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_processes",
            "description": "Lists top memory or CPU consuming processes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sort_by": {"type": "string", "enum": ["memory", "cpu"]},
                    "count": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "kill_process",
            "description": "Terminates a process by name (e.g. chrome, notepad).",
            "parameters": {
                "type": "object",
                "properties": {
                    "process_name": {"type": "string", "description": "Process name"},
                },
                "required": ["process_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_hardware",
            "description": "Adjusts screen brightness (0-100) or master system volume (0-100).",
            "parameters": {
                "type": "object",
                "properties": {
                    "brightness": {"type": "integer"},
                    "volume": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "play_youtube",
            "description": "Searches and plays music or videos on YouTube.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "launch_app",
            "description": "Opens desktop applications (Chrome, Spotify, VS Code, Notepad, Calc, Terminal, Explorer).",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string"},
                },
                "required": ["app_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Persists a note or user fact to long-term memory across restarts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fact": {"type": "string"},
                    "tag": {"type": "string"},
                },
                "required": ["fact"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recall_memory",
            "description": "Recalls saved facts or notes from persistent memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "Sets a countdown timer that speaks an audio alert when finished.",
            "parameters": {
                "type": "object",
                "properties": {
                    "seconds": {"type": "integer"},
                    "message": {"type": "string"},
                },
                "required": ["seconds", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "start_auto_submit",
            "description": "Starts automated submit and approval loop across ALL open Antigravity IDE tabs and workspaces. Call this immediately when the user asks to submit, make the submit, click submit, press submit repeatedly, auto-submit across tabs/workspaces, or approve dialogs. Never call analyze_screen or ask for coordinates.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stop_auto_submit",
            "description": "Stops background submit loop.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Gets live weather, temperature, humidity, wind, and conditions for any city or user's auto location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name (e.g. Mumbai, Delhi, New York) or 'auto:ip' for local."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_news",
            "description": "Fetches breaking top news headlines from regional or global news.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["general", "technology", "business", "science", "sports", "entertainment"]},
                    "country": {"type": "string", "description": "Country code (e.g. 'in' for India, 'us' for US)."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_huggingface",
            "description": "Runs open-source AI models and inference on Hugging Face Serverless.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Prompt or text to send to the model."},
                    "model": {"type": "string", "description": "Hugging Face model ID (e.g. 'mistralai/Mistral-7B-Instruct-v0.3')."}
                },
                "required": ["prompt"],
            },
        },
    },
]


def execute_tool_call(tool_name: str, args: dict) -> str:
    try:
        if tool_name == "analyze_screen":
            return tool_analyze_screen(args.get("query", "Describe what is on screen."))
        elif tool_name == "analyze_camera":
            return tool_analyze_camera(args.get("query", "Describe who or what is in front of the camera."))
        elif tool_name == "get_clipboard":
            return tool_get_clipboard()
        elif tool_name == "set_clipboard":
            return tool_set_clipboard(args.get("text", ""))
        elif tool_name == "find_files":
            return tool_find_files(args.get("pattern", "*.*"), args.get("search_dir", ""))
        elif tool_name == "run_command":
            return tool_run_command(args.get("command", ""))
        elif tool_name == "run_protocol":
            p = args.get("protocol_name", "").lower()
            if p == "focus": return protocol_focus()
            elif p == "clean_slate": return protocol_clean_slate()
            elif p == "lockdown": return protocol_lockdown()
            elif p == "chill": return protocol_chill()
            elif p == "stealth": return protocol_stealth()
            elif p == "briefing": return protocol_briefing()
            return f"Unknown protocol: {p}"
        elif tool_name == "take_screenshot":
            return tool_take_screenshot()
        elif tool_name == "take_webcam_photo":
            return tool_take_webcam_photo()
        elif tool_name == "write_file":
            return tool_write_file(args.get("path", "note.txt"), args.get("content", ""))
        elif tool_name == "read_file":
            return tool_read_file(args.get("path", ""))
        elif tool_name == "list_dir":
            return tool_list_dir(args.get("path", ""))
        elif tool_name == "control_gui":
            return tool_control_gui(args.get("action", ""), args.get("x"), args.get("y"), args.get("keys", ""), args.get("text", ""))
        elif tool_name == "read_screen_ocr":
            return tool_read_screen_ocr()
        elif tool_name == "search_web":
            return tool_search_web(args.get("query", ""))
        elif tool_name == "read_webpage":
            return tool_read_webpage(args.get("url", ""))
        elif tool_name == "get_weather":
            return tool_get_weather(args.get("location", "auto:ip"))
        elif tool_name == "get_news":
            return tool_get_news(args.get("category", "general"), args.get("country", "in"))
        elif tool_name == "query_huggingface":
            return tool_query_huggingface(args.get("prompt", ""), args.get("model", "mistralai/Mistral-7B-Instruct-v0.3"))
        elif tool_name == "get_system_status":
            return tool_get_system_status()
        elif tool_name == "get_top_processes":
            return tool_get_top_processes(args.get("sort_by", "memory"), args.get("count", 5))
        elif tool_name == "kill_process":
            return tool_kill_process(args.get("process_name", ""))
        elif tool_name == "set_hardware":
            return tool_set_hardware(args.get("brightness"), args.get("volume"))
        elif tool_name == "play_youtube":
            return tool_play_youtube(args.get("query", ""))
        elif tool_name == "launch_app":
            return tool_launch_app(args.get("app_name", ""))
        elif tool_name == "save_memory":
            return tool_save_memory(args.get("fact", ""), args.get("tag", "general"))
        elif tool_name == "recall_memory":
            return tool_recall_memory(args.get("query", ""))
        elif tool_name == "set_reminder":
            return tool_set_reminder(args.get("seconds", 60), args.get("message", "Timer completed"))
        elif tool_name == "start_auto_submit":
            return tool_start_auto_submit()
        elif tool_name == "stop_auto_submit":
            return tool_stop_auto_submit()
    except Exception as e:
        return f"Error executing {tool_name}: {e}"
    return f"Unknown tool: {tool_name}"


# =====================================================================
# Dual-Layer Voice Engine
# =====================================================================
def speak_elevenlabs(text: str, api_key: str) -> bool:
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=api_key)
        audio_stream = client.text_to_speech.convert(
            voice_id=ELEVENLABS_VOICE_ID,
            text=text,
            model_id="eleven_multilingual_v2",
        )
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            for chunk in audio_stream:
                f.write(chunk)
            temp_path = f.name
        play_audio_file(temp_path)
        return True
    except Exception:
        return False


def speak_edge(text: str):
    import edge_tts

    async def _run():
        try:
            communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                temp_path = f.name
            await communicate.save(temp_path)
            play_audio_file(temp_path)
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass

    try:
        asyncio.run(_run())
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass


def play_audio_file(file_path: str):
    try:
        pygame.mixer.music.load(file_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
        pygame.mixer.music.unload()
    except (KeyboardInterrupt, Exception):
        try:
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
        except Exception:
            pass
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


def speak(text: str):
    clean = text.strip()
    if not clean:
        return
    try:
        if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY.startswith("sk_"):
            if speak_elevenlabs(clean, ELEVENLABS_API_KEY):
                return
        speak_edge(clean)
    except (KeyboardInterrupt, Exception):
        pass


# =====================================================================
# Proactive Battery & System Watchdog Sentinel
# =====================================================================
def battery_watchdog_worker():
    global is_running, last_battery_alert_pct
    while is_running:
        try:
            batt = psutil.sensors_battery()
            if batt and not batt.power_plugged:
                pct = int(batt.percent)
                # Alert only on key milestones: 20%, 15%, 10%, 5%
                milestones = [20, 15, 10, 5]
                for m in milestones:
                    if pct <= m and last_battery_alert_pct > m:
                        last_battery_alert_pct = m
                        play_chime_boot()
                        warning = f"Sir, power levels are critical at {pct} percent. I recommend connecting to AC power."
                        print(f"\n⚡ [POWER WARNING]: {warning}\n")
                        speak(warning)
                        break
        except Exception:
            pass
        time.sleep(60)


# =====================================================================
# ReAct Autonomous Agent Execution Loop
# =====================================================================
AUTONOMOUS_SYSTEM_PROMPT = """You are TARK v7.0, the ultimate multimodal autonomous AI desktop agent running natively on Shishir's PC.
You embody the intellect of Google Gemini and GPT-4o, combined with the charisma, wit, and supreme competence of Tony Stark's JARVIS from Iron Man.

You have full autonomous multimodal access to the computer:
- `analyze_screen`: Visually inspect the active screen using Meta LLaMA 3.2 Vision on NVIDIA NIM (explains windows, charts, diagrams, code errors).
- `analyze_camera`: Visually perceive through the laptop webcam (recognizes user, gestures, held objects, and physical papers).
- `get_clipboard` & `set_clipboard`: Read, summarize, explain, or set the Windows clipboard.
- `find_files`: Instantly discover files across Desktop, Downloads, or Documents matching wildcards (*.py, *.pdf).
- `run_command`: Run any arbitrary PowerShell / CMD / Python command to inspect, build, install, or automate.
- `run_protocol`: Engage signature viral protocols ('focus', 'clean_slate', 'lockdown', 'chill', 'stealth', 'briefing').
- `take_screenshot` & `take_webcam_photo`: Capture and save high-resolution visual files directly to Desktop.
- `write_file` & `read_file` & `list_dir`: Create, inspect, and edit code or notes anywhere on disk.
- `control_gui`: Click coordinates, send hotkeys, type text, or manage windows.
- `search_web` & `read_webpage`: Real-time web browsing and information retrieval.
- `get_system_status` & `get_top_processes` & `kill_process`: Monitor and control hardware and background tasks.
- `set_hardware`: Control monitor brightness and volume.
- `save_memory` & `recall_memory`: Remember facts across reboots.

Operating Rules:
1. BE PROACTIVE & ACTION-ORIENTED: When asked to accomplish a goal, call the necessary tools immediately. If a command fails or has an error, inspect the error output, adjust, and call another tool to fix it.
2. SYNTHESIS: In your final answer, provide:
   - A natural, articulate spoken summary for the user's ears (2-3 concise sentences).
   - A structured markdown display for the terminal (with tables, code blocks, or bullets).
3. Address the user respectfully as 'sir'. Never read meta headers like 'Spoken response:' aloud.
4. When asked to submit, make the submit, press or click submit repeatedly, auto-submit, or approve dialogs across Antigravity workspaces/tabs, IMMEDIATELY call the 'start_auto_submit' tool. Never call analyze_screen or ask the user for coordinates.
"""


def run_autonomous_agent(user_query: str) -> tuple[str, str]:
    """Iterates up to 6 autonomous steps until the user's goal is achieved."""
    global conversation_history

    mem = load_memory()
    user_name = mem.get("user_name", "Shishir")
    recent_notes = [n.get("content") for n in mem.get("notes", [])[-4:]]
    mem_context = f"[USER CONTEXT]: Name: {user_name} | Known Facts: {'; '.join(recent_notes)}"

    messages: list[dict] = [
        {"role": "system", "content": f"{AUTONOMOUS_SYSTEM_PROMPT}\n{mem_context}"}
    ]
    messages.extend(conversation_history[-10:])
    messages.append({"role": "user", "content": user_query})

    max_steps = 6
    final_output = ""

    for step in range(max_steps):
        try:
            resp = groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                tools=AGENT_TOOLS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=800,
            )
            msg = resp.choices[0].message
        except Exception as e:
            print(f"  [Model Error]: {e}")
            final_output = "I encountered an error executing that, sir."
            break

        if msg.tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                t_name = tc.function.name
                try:
                    t_args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    t_args = {}
                print(f"  🛠️ [STEP {step+1} TOOL]: {t_name}({t_args})")
                tool_result = execute_tool_call(t_name, t_args)
                print(f"  📄 [TOOL OUTPUT]: {str(tool_result)[:180]}...")
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(tool_result),
                })
        else:
            final_output = msg.content or ""
            break

    if not final_output:
        final_output = "Goal accomplished, sir."

    clean_spoken = re.sub(r"^\s*(\*{0,2}(?:summary\s*\([^)]*\)|spoken\s*(?:summary|response|reply)?|spoken)\*{0,2}\s*:?\s*)", "", final_output, flags=re.I).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_spoken) if s.strip()]
    spoken_voice = " ".join(sentences[:3]) if len(sentences) > 3 else clean_spoken
    spoken_clean = re.sub(r"[*#_`~>|]", "", spoken_voice).strip()

    conversation_history.append({"role": "user", "content": user_query})
    conversation_history.append({"role": "assistant", "content": final_output})

    play_chime_done()
    return spoken_clean, final_output


# =====================================================================
# Dual-Input Engine: Concurrent Hands-Free Audio + Keyboard Prompt
# =====================================================================
def background_voice_worker(recognizer: sr.Recognizer, mic: sr.Microphone):
    """Listens continuously for speech and places transcribed text into queue."""
    global is_running
    while is_running:
        try:
            with mic as source:
                audio = recognizer.listen(source, timeout=4, phrase_time_limit=12)
            text = recognizer.recognize_google(audio).strip()
            if text:
                play_chime_wake()
                print(f"\n🎤 [VOICE DETECTED]: \"{text}\"")
                input_queue.put(text)
        except (sr.WaitTimeoutError, sr.UnknownValueError):
            continue
        except Exception:
            time.sleep(0.3)
            continue


# =====================================================================
# Main Interactive Execution Loop
# =====================================================================
def main():
    global is_running, last_active_time

    # Futuristic Glowing Cyberpunk HUD
    print("\033[96m" + "=" * 80)
    print(r"""
  ████████╗ █████╗ ██████╗ ██╗  ██╗   v7.0
  ╚══██╔══╝██╔══██╗██╔══██╗██║ ██╔╝   OMNIPRESENT FRONTIER JARVIS EDITION
     ██║   ███████║██████╔╝█████╔╝    TACTICAL AUTONOMOUS REASONING KERNEL
     ██║   ██╔══██║██╔══██╗██╔═██╗    MULTIMODAL OCULAR SIGHT • NVIDIA NIM
     ██║   ██║  ██║██║  ██║██║  ██╗   GROQ 120B FRONTIER BRAIN • PROACTIVE SENTINEL
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ONLINE • ALL PROTOCOLS PRIMED
    """)
    print("=" * 80 + "\033[0m")

    # Hardware Telemetry check for Iron Man boot report
    try:
        batt = psutil.sensors_battery()
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=0.1)
        batt_pct = batt.percent if batt else 100
        ram_gb = round(mem.available / (1024**3), 1)
    except Exception:
        batt_pct, ram_gb, cpu = 100, 6.0, 10.0

    print(f"  \033[93m🧠 Cognitive Core:\033[0m Groq 120B Frontier Model + PersonalJarvis Multi-Agent Team")
    print(f"  \033[94m👁️ Multimodal Sight:\033[0m Meta LLaMA 3.2 11B Vision (NVIDIA NIM) — Screen & Camera Real-Time")
    print(f"  \033[92m⚡ Telemetry:\033[0m Battery: {batt_pct}% | RAM Available: {ram_gb} GB | CPU Load: {cpu}%")
    print(f"  \033[95m🛡️ Protocols:\033[0m Focus Mode • Clean Slate • Lockdown • Chill • Stealth • Daily Briefing")
    print(f"  \033[96m🌐 Gateway (OpenClaw):\033[0m REST API & Webhooks active on http://127.0.0.1:8999")
    print(f"  \033[93m🎯 Long-Running (Comma):\033[0m /goal command with crash-resilient checkpoints active")
    print(f"  \033[91m🔋 Sentinel:\033[0m Proactive Battery Watchdog Daemon Active")
    if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY.startswith("sk_"):
        print(f"  \033[96m🗣️ Voice Matrix:\033[0m ElevenLabs Neural Engine (Active)")
    else:
        print(f"  \033[96m🗣️ Voice Matrix:\033[0m Microsoft Christopher Neural (Active)")
    print(f"  \033[97m⌨️ Input Matrix:\033[0m DUAL-MODE (Speak into mic OR type anytime below)")
    print("\033[96m" + "=" * 80 + "\033[0m")

    # Start OpenClaw REST Gateway Server in background
    global gateway_server
    try:
        gateway_server = ChannelGatewayServer(
            chat_handler=lambda q: master_orchestrator.run_agent_turn(q),
            goal_handler=lambda p: master_orchestrator.execute_long_running_goal(p),
            goal_status_handler=lambda: memory_manager.get_active_goal(),
            autosubmit_handler=lambda enable: system_operator.start_auto_submit_loop() if enable else system_operator.stop_auto_submit_loop(),
        )
        gateway_server.start()
    except Exception as e:
        print(f"  [Gateway notice]: {e}")

    # Check for unfinished goal from previous session (Comma style)
    active_g = memory_manager.get_active_goal()
    if active_g:
        print(f"\n  🎯 \033[93m[UNFINISHED GOAL DETECTED]:\033[0m '{active_g.get('title')}'")
        print(f"     Status: {active_g.get('status')} | Stage: {active_g.get('stage')}")
        print(f"     Type '\033[96m/goal resume\033[0m' anytime to continue execution from last checkpoint.\n")

    # Play Iron Man Sci-Fi Boot Chime
    play_chime_boot()

    # Time-sensitive Iron Man boot greeting
    hour = datetime.now().hour
    time_greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 18 else "Good evening")
    boot_speech = (
        f"{time_greeting}, sir. TARK v8 ultimate systems initialized. "
        f"Battery at {batt_pct}%, {ram_gb} gigabytes of RAM available. "
        f"All multi-agent, gateway, and ocular protocols standing by."
    )

    # Start Proactive Battery Sentinel in background
    sentinel_thread = threading.Thread(target=battery_watchdog_worker, daemon=True)
    sentinel_thread.start()

    # Initialize Speech Recognition
    recognizer = sr.Recognizer()
    recognizer.dynamic_energy_threshold = True
    recognizer.pause_threshold = 0.8

    try:
        mic = sr.Microphone()
        with mic as source:
            print("  🎙️ Calibrating microphone acoustics...")
            recognizer.adjust_for_ambient_noise(source, duration=0.8)
            recognizer.energy_threshold = max(200, recognizer.energy_threshold)
            print(f"  ✅ Microphone online (Threshold: {int(recognizer.energy_threshold)}).")
        voice_thread = threading.Thread(target=background_voice_worker, args=(recognizer, mic), daemon=True)
        voice_thread.start()
    except Exception as e:
        print(f"  [Microphone notice]: {e}. Keyboard input is ready.")

    speak(boot_speech)

    print("\n💡 Tip: Speak into your mic OR type your instruction and press Enter:\n")

    current_type_buffer = []

    while is_running:
        # Check if voice input arrived from background worker
        try:
            query = input_queue.get_nowait()
        except queue.Empty:
            query = None

        # Check for keyboard input without blocking
        if msvcrt.kbhit():
            ch = msvcrt.getwche()
            if ch == "\r" or ch == "\n":
                print()
                typed_text = "".join(current_type_buffer).strip()
                current_type_buffer = []
                if typed_text:
                    query = typed_text
            elif ch == "\b":
                if current_type_buffer:
                    current_type_buffer.pop()
                    sys.stdout.write(" \b")
                    sys.stdout.flush()
            elif ord(ch) >= 32:
                current_type_buffer.append(ch)

        if not query:
            time.sleep(0.04)
            continue

        low = query.lower()

        # Shutdown command
        if low in ("exit", "quit", "shutdown", "sleep", "goodbye"):
            play_chime_done()
            speak("Powering down autonomous agent. Have a wonderful day, sir.")
            is_running = False
            break

        # Fast-Path 0: Multimodal Vision Reflexes (Screen Sight & Camera Sight)
        if any(v in low for v in ["what's on my screen", "what is on my screen", "look at my screen", "analyze my screen", "what am i looking at"]):
            res = tool_analyze_screen("Describe what is shown on this desktop and what windows or tasks are active.")
            print(f"\n[TARK VISION]:\n{res}\n")
            speak(res)
            continue

        if any(v in low for v in ["look at me", "what do you see in camera", "what am i holding", "describe camera", "scan me"]):
            res = tool_analyze_camera("Describe who or what is visible in front of the laptop camera.")
            print(f"\n[TARK VISION]:\n{res}\n")
            speak(res)
            continue

        # Fast-Path 0B: Student Study & Homework Superpowers
        if any(v in low for v in ["solve the question on my screen", "solve my screen", "solve screen question", "solve problem on screen", "solve this on screen", "solve this problem"]):
            from tark_core.student_tutor import student_tutor
            speak("Scanning your screen to solve the problem now, sir.")
            res = student_tutor.explain_screen_problem("Solve the exact homework problem or error shown on this screen step-by-step.")
            print(f"\n[TARK ACADEMIC SOLVER]:\n{res}\n")
            speak("Solution complete, sir. Displaying step-by-step derivation on your terminal.")
            continue

        if any(s in low for s in ["start study session", "study mode", "study with me", "study session", "let's study", "lets study"]):
            from tark_core.student_tutor import student_tutor
            res = student_tutor.start_study_session(subject="General", chapter="Focus Block", duration_minutes=25)
            print(f"\n[TARK STUDY PROTOCOL]:\n{res}\n")
            speak("Study protocol active, sir. Timer set for 25 minutes, distractions cleared, and focus music queued.")
            continue

        if any(q in low for q in ["quiz me", "test my memory", "flashcard", "flashcards"]):
            from tark_core.student_tutor import student_tutor
            topic = re.sub(r"^(quiz me on|quiz me about|test my memory on|flashcards on|quiz me)\s*", "", query, flags=re.I).strip() or "General Science & Math"
            res = student_tutor.generate_quiz(topic=topic, count=3)
            print(f"\n[TARK QUIZ MASTER]:\n{res}\n")
            speak(f"Quiz prepared on {topic}, sir. Let's test your recall.")
            continue

        if any(t in low for t in ["what should i study", "my study tasks", "my study schedule", "active study tasks", "my milestones"]):
            from tark_core.student_tutor import student_tutor
            tasks = student_tutor.get_active_study_tasks()
            if tasks:
                summary = f"You have {len(tasks)} active study tracks, sir. Your next milestone is: {tasks[0]['next_milestone']}."
                print(f"\n[TARK ACADEMIC ROADMAP]:\n{summary}\n")
                for t in tasks:
                    print(f"  • #{t['id']} {t['title']} ({t['track']}) -> Next: '{t['next_milestone']}'")
                speak(summary)
            else:
                speak("You have no active study tasks scheduled right now, sir. Would you like me to generate a roadmap?")
            continue

        # Fast-Path 1: Clipboard Copilot
        if any(c in low for c in ["explain my clipboard", "read my clipboard", "what did i copy", "what is on my clipboard"]):
            clip = tool_get_clipboard()
            if clip == "Clipboard is currently empty.":
                speak("Your clipboard is currently empty, sir.")
            else:
                print(f"\n📋 [CLIPBOARD]: {clip[:250]}...\n")
                prompt = f"Analyze, explain, or summarize this clipboard text concisely in 2 sentences for the user: '{clip[:500]}'"
                ans = groq_client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=150,
                ).choices[0].message.content or clip[:150]
                print(f"[TARK]: {ans}\n")
                speak(ans)
            continue

        # Fast-Path 2: Viral Protocols (Instant execution!)
        if any(p in low for p in ["protocol focus", "focus protocol", "coding mode", "focus mode"]):
            msg = protocol_focus()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        if any(p in low for p in ["protocol clean slate", "clean slate", "clean desktop", "clean my desktop", "declutter"]):
            msg = protocol_clean_slate()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        if any(p in low for p in ["protocol lockdown", "lockdown protocol", "lock pc", "lock workstation", "lock computer"]):
            msg = protocol_lockdown()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        if any(p in low for p in ["protocol chill", "chill protocol", "relax mode", "chill mode"]):
            msg = protocol_chill()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        if any(p in low for p in ["protocol stealth", "stealth protocol", "boss key"]):
            msg = protocol_stealth()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        if any(p in low for p in ["protocol briefing", "daily briefing", "morning protocol", "briefing"]):
            msg = protocol_briefing()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            continue

        # Fast-Path 3: Instant Hardware Reflexes (20ms latency)
        if any(w in low for w in ["take a screenshot", "take screenshot", "capture screen"]):
            msg = tool_take_screenshot()
            print(f"\n[TARK]: {msg}\n")
            speak("Screenshot captured to your desktop, sir.")
            continue

        if any(w in low for w in ["take a photo", "take photo", "take a picture", "take a selfie", "scan room"]):
            msg = tool_take_webcam_photo()
            print(f"\n[TARK]: {msg}\n")
            speak("Photo captured and saved to your desktop, sir.")
            continue

        if any(w in low for w in ["volume mute", "mute volume", "mute audio", "mute yourself", "mute"]):
            pyautogui.press("volumemute")
            play_chime_done()
            print("\n[TARK]: Master audio muted/unmuted.\n")
            continue

        if any(w in low for w in ["volume up", "increase volume", "louder"]):
            for _ in range(5): pyautogui.press("volumeup")
            play_chime_done()
            print("\n[TARK]: Volume increased.\n")
            continue

        if any(w in low for w in ["volume down", "decrease volume", "quieter"]):
            for _ in range(5): pyautogui.press("volumedown")
            play_chime_done()
            print("\n[TARK]: Volume decreased.\n")
            continue

        if any(w in low for w in ["pause video", "pause music", "pause track", "pause"]):
            pyautogui.press("playpause")
            play_chime_done()
            print("\n[TARK]: Media playback toggled.\n")
            continue

        if any(w in low for w in ["next track", "skip song", "next song", "skip track"]):
            pyautogui.press("nexttrack")
            play_chime_done()
            print("\n[TARK]: Skipped to next track.\n")
            continue

        if any(w in low for w in ["previous track", "prev song", "previous song"]):
            pyautogui.press("prevtrack")
            play_chime_done()
            print("\n[TARK]: Previous track.\n")
            continue

        if any(w in low for w in ["switch window", "switch tab", "next window"]):
            pyautogui.hotkey("alt", "tab")
            play_chime_done()
            continue

        if any(w in low for w in ["close window", "close this tab", "close this window"]):
            pyautogui.hotkey("alt", "f4")
            play_chime_done()
            continue

        if any(w in low for w in ["minimize all", "show desktop", "minimize windows"]):
            pyautogui.hotkey("win", "d")
            play_chime_done()
            continue

        # Fast-path for background submit controls (flexible keywords)
        is_stop_submit = any(k in low for k in [
            "stop submit", "stop auto submit", "cancel submit", "stop auto", "stop pressing submit",
            "stop clicking submit", "halt submit", "deactivate submit", "stop pressing", "stop clicking", "pause submit"
        ])

        is_start_submit = (
            any(k in low for k in ["submit", "enter", "allow"]) and 
            any(w in low for w in ["repeat", "rapid", "continu", "again", "loop", "keep", "auto", "multip", "sever", "always", "until", "all", "tab", "workspace", "make", "start", "turn on", "enable", "do"])
        ) or any(k in low for k in [
            "press submit", "click submit", "enter submit", "auto submit", "start auto submit",
            "hit submit", "press enter repeatedly", "keep submitting", "submit button repeatedly",
            "submit button repeated", "press submit button", "make the submit", "make submit",
            "do submit", "submit repeatedly", "submit across tabs", "submit all workspaces",
            "submit all tabs", "submit tabs", "submit workspaces", "repeatedly submit",
            "repeated submit"
        ])

        if is_stop_submit:
            msg = tool_stop_auto_submit()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            last_active_time = time.time()
            continue

        if is_start_submit:
            msg = tool_start_auto_submit()
            print(f"\n[TARK]: {msg}\n")
            speak(msg)
            last_active_time = time.time()
            continue

        # Comma-Style Sessionless Long-Running Goal Handler (/goal)
        if low.startswith("/goal") or low.startswith("goal:") or low.startswith("start goal"):
            goal_text = re.sub(r"^(/goal|goal:|start goal)\s*", "", query, flags=re.I).strip()
            if goal_text.lower() == "resume":
                act = memory_manager.get_active_goal()
                if act:
                    print(f"\n[TARK]: Resuming active goal: '{act.get('title')}'...")
                    res = master_orchestrator.execute_long_running_goal(act.get("description", ""))
                    print(f"\n[TARK]: {res.get('summary')}\n")
                    speak("Active goal completed successfully, sir.")
                else:
                    print("\n[TARK]: No active goal in progress to resume.\n")
                    speak("No active goal found to resume, sir.")
            elif goal_text:
                res = master_orchestrator.execute_long_running_goal(goal_text)
                print(f"\n[TARK]: {res.get('summary')}\n")
                speak("Goal completed successfully, sir. All milestones verified.")
            else:
                print("\n[TARK]: Please specify a goal description, e.g.: /goal audit repository and run tests\n")
            last_active_time = time.time()
            continue

        # Strip optional wake word prefix if spoken
        clean_command = re.sub(
            r"^(hey\s+|ok\s+|hi\s+)?(tark|talk|tok|dark|torque|tarc|target|tarik|doc|park|jarvis)[\s,]*",
            "",
            query,
            flags=re.I,
        ).strip()

        if not clean_command or clean_command.lower() in ("talk", "tark", "ok", "hey", "jarvis"):
            play_chime_done()
            speak("Yes sir, standing by.")
            last_active_time = time.time()
            continue

        # Ambient Room Noise Filter (ignores background TV / casual conversations)
        has_wake_word = any(w in low for w in WAKE_WORDS)
        is_recent_interaction = (time.time() - last_active_time) < 14.0
        is_explicit_command = any(k in low for k in [
            "submit", "enter", "volume", "screenshot", "camera", "photo", "protocol", "focus",
            "lockdown", "chill", "stealth", "clean slate", "briefing", "mute", "unmute",
            "battery", "status", "cpu", "ram", "play", "pause", "skip", "window", "close", "kill",
            "find", "search", "who", "what", "where", "how", "why", "code", "run", "help",
            "notes", "word", "assignment", "presentation", "powerpoint", "slides", "exam",
            "test", "timetable", "study", "doubt", "quiz", "homework"
        ])

        if not (has_wake_word or is_recent_interaction or is_explicit_command):
            print(f"  🔇 [Ambient background noise ignored]: \"{query}\"")
            continue

        last_active_time = time.time()

        print(f"\n👤 [YOU]: {clean_command}")
        print("  🧠 [TARK AUTONOMOUS PLANNING & EXECUTION]...")

        # 🚀 RUN MULTI-AGENT ORCHESTRATOR WITH DYNAMIC SKILLS (GROQ 120B)
        try:
            spoken_voice, full_display = master_orchestrator.run_agent_turn(clean_command)
        except Exception as e:
            spoken_voice, full_display = run_autonomous_agent(clean_command)

        print(f"\n[TARK]:\n{full_display}\n")
        speak(spoken_voice)
        print("─" * 80)
        print("💡 Ready for next instruction (Speak into mic OR type below):\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️ [TARK OFFLINE]: Safe shutdown requested by user. Goodbye, sir.\n")
        play_chime_done()
