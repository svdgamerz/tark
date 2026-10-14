"""TARK v7.0 — Autonomous Silent Background Agent for Windows (System Tray).

Runs silently in Windows System Tray with:
- 👁️ Real-Time Multimodal Sight: Meta LLaMA 3.2 11B Vision on NVIDIA NIM (Screen & Camera)
- 🧠 Frontier Cognitive Core: Groq 120B (`openai/gpt-oss-120b`)
- 🛡️ Signature Protocols: Focus Mode, Clean Slate, Lockdown, Chill, Stealth, Daily Briefing
- ⚡ 20ms Fast-Path Reflexes: Instant Volume, Media, Screenshot, Webcam, Window, & Clipboard controls
- 🔋 Proactive Battery Sentinel: Automatic background power watchdog
- 🎵 Procedural Sci-Fi Audio Chimes & Neural Speech (ElevenLabs / Christopher Neural)
- 🛡️ Tray Menu: Mute, Continuous Mode, Logs, and Exit
"""
from __future__ import annotations

import asyncio
import base64
from datetime import datetime
import io
import json
import math
import os
from pathlib import Path
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

import cv2
from PIL import Image, ImageDraw, ImageGrab
import psutil
import pyautogui
import pygame
import pyperclip
import pystray
import pywhatkit
import speech_recognition as sr
from groq import Groq

# Safety configuration
pyautogui.FAILSAFE = False

# --- Configuration & Credentials ---
from tark_core.config import (
    GROQ_API_KEY,
    NVIDIA_NIM_API_KEY,
    ELEVENLABS_API_KEY,
    TAVILY_API_KEY,
    ELEVENLABS_VOICE_ID,
)

groq_client = Groq(api_key=GROQ_API_KEY)
try:
    pygame.mixer.init()
except Exception:
    pass

# --- State Variables ---
is_running = True
is_muted = False
continuous_mode = True
last_active_time = 0.0
tray_icon: pystray.Icon | None = None
MEMORY_FILE = Path(__file__).parent / "tark_memory.json"
LOG_FILE = Path(__file__).parent / "tark_activity.log"
conversation_history: list[dict] = []
last_battery_alert_pct: int | None = None


def log_message(msg: str):
    try:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {msg}\n")
    except Exception:
        pass


WAKE_WORDS = [
    "tark", "talk", "tok", "dark", "torque", "tarc", "tarck", "target", "tarik", "doc", "park",
    "hey tark", "ok tark", "hi tark", "hey talk", "ok talk", "hi talk", "jarvis", "hey jarvis"
]


# =====================================================================
# Procedural Audio Chimes
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
    global is_muted
    if is_muted:
        return
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
# Memory
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
    except Exception:
        pass


# =====================================================================
# Multimodal Sight Engine (NVIDIA NIM)
# =====================================================================
def call_nvidia_vision(image_bytes: bytes, prompt: str) -> str:
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
    play_chime_vision()
    try:
        import ctypes
        grabbed_img: list[Image.Image] = []

        def _worker():
            try:
                user32 = ctypes.windll.user32
                hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
                if hdesk: user32.SetThreadDesktop(hdesk)
                grabbed_img.append(ImageGrab.grab())
            except Exception:
                pass

        t = threading.Thread(target=_worker)
        t.start()
        t.join(timeout=6)

        if not grabbed_img:
            return "Failed to capture display for vision analysis."

        img = grabbed_img[0]
        img.thumbnail((512, 288))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=60)

        prompt_text = f"You are JARVIS inspecting Shishir's computer display. User Question: '{query}'. Provide a clear, natural, and helpful answer in 2-3 sentences."
        ans = call_nvidia_vision(buf.getvalue(), prompt_text)

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
    play_chime_vision()
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return "Camera could not be accessed."
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
# Viral Protocols
# =====================================================================
def protocol_focus() -> str:
    play_chime_done()
    subprocess.Popen(["cmd", "/c", "start", "code"])
    pywhatkit.playonyt("lofi hip hop radio beats to relax study to")
    tool_set_hardware(brightness=60, volume=35)
    return "Focus protocol engaged, sir. Code environment launched and audio ambiance active."


def protocol_clean_slate() -> str:
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
    except Exception:
        pass
    pyautogui.hotkey("win", "d")
    return f"Clean slate protocol completed, sir. {moved_count} files organized into Archive_{today_str}."


def protocol_lockdown() -> str:
    play_chime_done()
    subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
    return "Workstation locked. Security protocol enforced, sir."


def protocol_chill() -> str:
    play_chime_done()
    pywhatkit.playonyt("synthwave chill beats relax")
    tool_set_hardware(brightness=75, volume=65)
    return "Relax protocol engaged, sir. Ambient lounge audio active."


def protocol_stealth() -> str:
    pyautogui.hotkey("win", "d")
    pyautogui.press("volumemute")
    return "Stealth protocol active."


def protocol_briefing() -> str:
    play_chime_done()
    status_raw = tool_get_system_status()
    try:
        status = json.loads(status_raw)
    except Exception:
        status = {}

    news_headline = "Global systems nominal."
    if TAVILY_API_KEY:
        try:
            news_raw = tool_search_web("top world news headline today")
            first_line = news_raw.split("\n")[0] if news_raw else ""
            if first_line:
                news_headline = first_line[:120]
        except Exception:
            pass

    now_str = datetime.now().strftime("%A, %B %d, at %I:%M %p")
    batt = status.get("battery_percent", 100)
    ram = status.get("ram_free_gb", 6.0)
    cpu = status.get("cpu_percent", 10.0)

    report = (
        f"Good day, sir. The time is {now_str}. "
        f"Your battery is at {batt}%, with {ram} gigabytes of RAM free, and CPU load at {cpu}%. "
        f"Today's top briefing: {news_headline}."
    )
    return report


# =====================================================================
# Tools
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
            return out if out else "Command executed successfully."
        return f"Return Code {res.returncode}\nStdout: {out}\nStderr: {err}"
    except Exception as e:
        return f"Command execution error: {e}"


def tool_get_clipboard() -> str:
    try:
        t = pyperclip.paste().strip()
        return t if t else "Clipboard is empty."
    except Exception as e:
        return f"Clipboard error: {e}"


def tool_set_clipboard(text: str) -> str:
    try:
        pyperclip.copy(text)
        play_chime_done()
        return "Copied to clipboard."
    except Exception as e:
        return f"Clipboard error: {e}"


def tool_find_files(pattern: str = "*.*", search_dir: str = "") -> str:
    try:
        root = Path(search_dir).expanduser() if search_dir else Path.home() / "Desktop"
        matches = list(root.glob(pattern))[:15]
        if not matches:
            return f"No files matching '{pattern}' in {root}."
        return "\n".join([f"{f.name} ({round(f.stat().st_size/1024, 1)} KB)" for f in matches])
    except Exception as e:
        return f"Error: {e}"


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
                if hdesk: user32.SetThreadDesktop(hdesk)
                img = ImageGrab.grab()
                img.save(str(target_path))
            except Exception as ex:
                grab_error = ex

        t = threading.Thread(target=_grab_worker)
        t.start()
        t.join(timeout=8)

        if grab_error or not target_path.exists():
            return f"Screenshot error: {grab_error}"

        play_chime_done()
        return f"Screenshot saved to Desktop: {target_path.name}"
    except Exception as e:
        return f"Screenshot error: {e}"


def tool_take_webcam_photo() -> str:
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return "Camera could not be accessed."
        time.sleep(0.35)
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            return "Failed to grab photo frame from camera."
        desktop = Path.home() / "Desktop"
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = desktop / f"tark_photo_{ts}.jpg"
        cv2.imwrite(str(target_path), frame)
        play_chime_done()
        return f"Photo captured and saved to Desktop: {target_path.name}"
    except Exception as e:
        return f"Camera capture error: {e}"


def tool_write_file(path: str, content: str) -> str:
    try:
        p = Path(path).expanduser()
        if not p.is_absolute():
            p = (Path.home() / "Desktop" / p).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {p}."
    except Exception as e:
        return f"Failed to write file: {e}"


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
        return f"Failed to read file: {e}"


def tool_list_dir(path: str = "") -> str:
    try:
        p = Path(path).expanduser() if path else Path.home() / "Desktop"
        if not p.exists():
            return f"Directory not found: {p}"
        items = []
        for child in list(p.iterdir())[:30]:
            kind = "DIR " if child.is_dir() else "FILE"
            size = f"{child.stat().st_size} bytes" if child.is_file() else ""
            items.append(f"{kind} | {child.name} {size}")
        return "\n".join(items) if items else "Directory is empty."
    except Exception as e:
        return f"Error: {e}"


def tool_control_gui(action: str, x: int | None = None, y: int | None = None, keys: str = "", text: str = "") -> str:
    try:
        act = action.lower().strip()
        if act == "click" and x is not None and y is not None:
            pyautogui.click(x, y)
            return f"Clicked ({x}, {y})."
        elif act == "hotkey" and keys:
            parts = [k.strip() for k in keys.split("+")]
            pyautogui.hotkey(*parts)
            return f"Pressed {keys}."
        elif act == "type_text" and text:
            pyperclip.copy(text)
            pyautogui.hotkey("ctrl", "v")
            return "Pasted text."
        elif act == "minimize_all":
            pyautogui.hotkey("win", "d")
            return "Minimized all."
        elif act == "switch_window":
            pyautogui.hotkey("alt", "tab")
            return "Switched window."
        elif act == "close_window":
            pyautogui.hotkey("alt", "f4")
            return "Closed window."
        elif act == "lock_pc":
            subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
            return "Workstation locked."
        return f"Unknown GUI action: {action}"
    except Exception as e:
        return f"GUI error: {e}"


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
                if hdesk: user32.SetThreadDesktop(hdesk)
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
                return "OCR unavailable."
            result = await engine.recognize_async(software_bitmap)
            return result.text

        res = asyncio.run(_ocr())
        return res[:2500] if res else "No text detected."
    except Exception as e:
        return f"OCR error: {e}"
    finally:
        if os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass


def tool_search_web(query: str) -> str:
    if not TAVILY_API_KEY:
        return "Tavily API key missing."
    try:
        data = json.dumps({"api_key": TAVILY_API_KEY, "query": query, "max_results": 3}).encode("utf-8")
        req = urllib.request.Request("https://api.tavily.com/search", data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            results = body.get("results", [])
            return "\n\n".join([f"Source: {r.get('title')}\n{r.get('content')}" for r in results[:3]])
    except Exception as e:
        return f"Search error: {e}"


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
        return f"Webpage error: {e}"


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
        return f"Process error: {e}"


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
        return f"Error: {e}"


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
    return " ".join(res) if res else "No hardware setting changed."


def tool_play_youtube(query: str) -> str:
    try:
        log_message(f"YouTube play: {query}")
        pywhatkit.playonyt(query)
        return f"Playing '{query}' on YouTube."
    except Exception as e:
        return f"Play error: {e}"


def tool_launch_app(app_name: str) -> str:
    try:
        raw = app_name.lower().strip()
        app_map = {
            "chrome": "chrome", "spotify": "spotify", "vscode": "code",
            "notepad": "notepad", "calc": "calc", "terminal": "powershell",
            "cmd": "cmd", "explorer": "explorer", "discord": "discord",
        }
        target = app_map.get(raw, raw)
        subprocess.Popen(["cmd", "/c", "start", target])
        return f"Launched {raw}."
    except Exception as e:
        return f"Launch error: {e}"


def tool_save_memory(fact: str, tag: str = "general") -> str:
    try:
        mem = load_memory()
        mem.setdefault("notes", []).append({
            "tag": tag,
            "content": fact,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        })
        save_memory(mem)
        return f"Saved fact: '{fact}'"
    except Exception as e:
        return f"Memory error: {e}"


def tool_recall_memory(query: str = "") -> str:
    try:
        mem = load_memory()
        notes = mem.get("notes", [])
        if not notes:
            return "No notes saved."
        if query:
            q = query.lower()
            matched = [n for n in notes if q in n.get("content", "").lower()]
            return json.dumps(matched if matched else notes[-5:])
        return json.dumps(notes[-8:])
    except Exception as e:
        return f"Error: {e}"


def tool_set_reminder(seconds: int, message: str) -> str:
    try:
        sec = max(1, int(seconds))

        def _worker():
            time.sleep(sec)
            alert = f"Sir, reminder alert: {message}"
            log_message(alert)
            speak(alert)

        threading.Thread(target=_worker, daemon=True).start()
        return f"Reminder set for {sec} seconds: '{message}'"
    except Exception as e:
        return f"Reminder error: {e}"


# =====================================================================
# Automated Submit Engine for Antigravity & Dialogs (Cursor-Preserving)
# =====================================================================
auto_submit_active = False
auto_submit_thread: threading.Thread | None = None


def find_and_click_submit_target() -> str:
    """Submits to Antigravity IDE and dialogs whether Antigravity is active or running in the background behind other tabs."""
    import ctypes
    import struct
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32

    hdesk = user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
    if hdesk:
        user32.SetThreadDesktop(hdesk)

    # 1. Locate Antigravity IDE top window and render child
    ag_top = None
    def _enum(hwnd, extra):
        nonlocal ag_top
        if user32.IsWindowVisible(hwnd):
            buff = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, buff, 512)
            if "antigravity ide" in buff.value.lower():
                ag_top = hwnd
                return False
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    user32.EnumDesktopWindows(hdesk, WNDENUMPROC(_enum), 0)

    if not ag_top:
        return "Antigravity IDE window not found."

    render_hwnd = None
    def _enum_child(hwnd, extra):
        nonlocal render_hwnd
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        if cbuff.value == "Chrome_RenderWidgetHostHWND":
            render_hwnd = hwnd
            return False
        return True

    user32.EnumChildWindows(ag_top, WNDENUMPROC(_enum_child), 0)
    target_render = render_hwnd if render_hwnd else ag_top

    r = (ctypes.c_long * 4)()
    user32.GetWindowRect(ag_top, r)
    w = max(100, r[2] - r[0])
    h = max(100, r[3] - r[1])

    # Check if user is currently working in a different window or tab
    fg_current = user32.GetForegroundWindow()
    is_in_different_tab = (fg_current != ag_top)

    detected_target = None
    temp_scan = str(Path.home() / "Desktop" / "tark_ag_scan_bg.png")

    # 2. Capture Antigravity window directly from GPU backbuffer via PrintWindow (bypasses any occlusion/covering window)
    try:
        hdc_win = user32.GetWindowDC(ag_top)
        hdc_mem = gdi32.CreateCompatibleDC(hdc_win)
        hbm = gdi32.CreateCompatibleBitmap(hdc_win, w, h)
        gdi32.SelectObject(hdc_mem, hbm)

        PW_RENDERFULLCONTENT = 2
        user32.PrintWindow(ag_top, hdc_mem, PW_RENDERFULLCONTENT)

        bih = struct.pack("iiiHHiiiiii", 40, w, -h, 1, 32, 0, w * h * 4, 0, 0, 0, 0)
        buf = ctypes.create_string_buffer(w * h * 4)
        gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, bih, 0)
        img = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1)
        img.save(temp_scan)

        gdi32.DeleteObject(hbm)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(ag_top, hdc_win)

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

                # STRICT CRITERIA 1: Must be in the right-hand Antigravity Assistant Pane (X >= 1130)
                # Never scan the left pane (code editor or integrated terminal)!
                if center_x < 1130:
                    continue

                # STRICT CRITERIA 2: Must be in the dialog area above the bottom input bar (Y: 250..840)
                if center_y >= 840 or center_y < 250:
                    continue

                # STRICT CRITERIA 3: Exclude terminal outputs, chat logs, or phrases
                if any(bad in txt for bad in [
                    "pulse", "submit:", "foreground", "background", "clicked", "pulsed",
                    "sent", "enter", "tark", "suwit", "sutnit", "active", "focused",
                    "review", "files with changes", "debug", "start server", "ln", "spaces:"
                ]):
                    continue

                # STRICT CRITERIA 4: Real modal buttons have concise labels (<= 25 chars)
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
            detected_target = res
    except Exception:
        pass
    finally:
        if os.path.exists(temp_scan):
            try:
                os.remove(temp_scan)
            except Exception:
                pass

    if detected_target:
        client_x, client_y, label = detected_target
    else:
        # Default target: The Send Arrow / Submit action in Antigravity's chat input bar
        client_x, client_y = 1707, 867
        label = "Chat Send Button"

    screen_x = r[0] + client_x
    screen_y = r[1] + client_y

    # 3. Execution logic: Foreground vs Background Tab
    if is_in_different_tab:
        try:
            curr_x, curr_y = pyautogui.position()
            kernel32 = ctypes.windll.kernel32
            curr_tid = kernel32.GetCurrentThreadId()
            fg_tid = user32.GetWindowThreadProcessId(fg_current, None) if fg_current else 0
            ag_tid = user32.GetWindowThreadProcessId(ag_top, None)

            if fg_tid:
                user32.AttachThreadInput(curr_tid, fg_tid, True)
            if ag_tid:
                user32.AttachThreadInput(curr_tid, ag_tid, True)

            user32.SetForegroundWindow(ag_top)
            time.sleep(0.015)
            pyautogui.click(screen_x, screen_y)
            pyautogui.press("enter")

            if fg_current:
                user32.SetForegroundWindow(fg_current)
            if curr_x > 0 and curr_y > 0:
                pyautogui.moveTo(curr_x, curr_y)

            if fg_tid:
                user32.AttachThreadInput(curr_tid, fg_tid, False)
            if ag_tid:
                user32.AttachThreadInput(curr_tid, ag_tid, False)
            return f"Background Submit: Sent to '{label}' at ({client_x}, {client_y}) [Active tab restored in 15ms]"
        except Exception:
            WM_KEYDOWN = 0x0100
            WM_CHAR = 0x0102
            WM_KEYUP = 0x0101
            VK_RETURN = 0x0D
            lparam_down = 0x001C0001
            lparam_up = 0xC01C0001
            user32.PostMessageW(target_render, WM_KEYDOWN, VK_RETURN, lparam_down)
            user32.PostMessageW(target_render, WM_CHAR, VK_RETURN, lparam_down)
            user32.PostMessageW(target_render, WM_KEYUP, VK_RETURN, lparam_up)
            return f"Background Win32 Return posted to '{label}' at ({client_x}, {client_y})."
    else:
        try:
            curr_x, curr_y = pyautogui.position()
            pyautogui.click(screen_x, screen_y)
            pyautogui.press("enter")
            if curr_x > 0 and curr_y > 0:
                pyautogui.moveTo(curr_x, curr_y)
        except Exception:
            pass
        return f"Foreground Submit: Sent to '{label}' at ({client_x}, {client_y})."


def auto_submit_worker():
    global auto_submit_active
    log_message("Auto-submit loop active.")
    pulse_count = 0
    while auto_submit_active:
        action_desc = find_and_click_submit_target()
        pulse_count += 1
        log_message(f"Submit Pulse #{pulse_count}: {action_desc}")
        time.sleep(1.5)
    log_message("Auto-submit loop stopped.")


def tool_start_auto_submit() -> str:
    global auto_submit_active, auto_submit_thread
    if auto_submit_active:
        return "Auto-submit loop already running."
    auto_submit_active = True
    auto_submit_thread = threading.Thread(target=auto_submit_worker, daemon=True)
    auto_submit_thread.start()
    play_chime_done()
    return "Auto-submit loop activated for Antigravity (detecting dialog buttons & pressing Enter)."


def tool_stop_auto_submit() -> str:
    global auto_submit_active
    if not auto_submit_active:
        return "Auto-submit not currently active."
    auto_submit_active = False
    return "Auto-submit deactivated."


# =====================================================================
# Tools Schema
# =====================================================================
AGENT_TOOLS = [
    {"type": "function", "function": {"name": "analyze_screen", "description": "Visually inspects screen with LLaMA 3.2 Vision", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "analyze_camera", "description": "Visually inspects webcam with LLaMA 3.2 Vision", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "get_clipboard", "description": "Reads text from Windows clipboard", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "set_clipboard", "description": "Sets text in clipboard", "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {"name": "find_files", "description": "Finds files matching wildcard", "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}, "search_dir": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "run_command", "description": "Runs arbitrary PowerShell or CMD command", "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}},
    {"type": "function", "function": {"name": "run_protocol", "description": "Runs JARVIS protocols ('focus', 'clean_slate', 'lockdown', 'chill', 'stealth', 'briefing')", "parameters": {"type": "object", "properties": {"protocol_name": {"type": "string"}}, "required": ["protocol_name"]}}},
    {"type": "function", "function": {"name": "take_screenshot", "description": "Captures full desktop screenshot to Desktop", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "take_webcam_photo", "description": "Captures photo from webcam to Desktop", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "write_file", "description": "Writes or creates any file on disk", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "read_file", "description": "Reads text from file", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "list_dir", "description": "Lists files in directory", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "control_gui", "description": "Clicks, types, hotkeys, minimizes", "parameters": {"type": "object", "properties": {"action": {"type": "string"}, "x": {"type": "integer"}, "y": {"type": "integer"}, "keys": {"type": "string"}, "text": {"type": "string"}}, "required": ["action"]}}},
    {"type": "function", "function": {"name": "read_screen_ocr", "description": "Reads text on screen with Windows OCR", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "search_web", "description": "Performs live web search", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "read_webpage", "description": "Reads text from URL", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
    {"type": "function", "function": {"name": "get_system_status", "description": "Returns CPU, RAM, Battery, and Disk metrics", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "get_top_processes", "description": "Returns top processes by memory or CPU", "parameters": {"type": "object", "properties": {"sort_by": {"type": "string"}, "count": {"type": "integer"}}}}},
    {"type": "function", "function": {"name": "kill_process", "description": "Kills process by name", "parameters": {"type": "object", "properties": {"process_name": {"type": "string"}}, "required": ["process_name"]}}},
    {"type": "function", "function": {"name": "set_hardware", "description": "Sets screen brightness or volume", "parameters": {"type": "object", "properties": {"brightness": {"type": "integer"}, "volume": {"type": "integer"}}}}},
    {"type": "function", "function": {"name": "play_youtube", "description": "Plays song or video on YouTube", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "launch_app", "description": "Opens desktop application", "parameters": {"type": "object", "properties": {"app_name": {"type": "string"}}, "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "save_memory", "description": "Saves fact to persistent memory", "parameters": {"type": "object", "properties": {"fact": {"type": "string"}}, "required": ["fact"]}}},
    {"type": "function", "function": {"name": "recall_memory", "description": "Recalls saved memory notes", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "set_reminder", "description": "Sets timer with voice alert", "parameters": {"type": "object", "properties": {"seconds": {"type": "integer"}, "message": {"type": "string"}}, "required": ["seconds", "message"]}}},
    {"type": "function", "function": {"name": "start_auto_submit", "description": "Starts silent background submit", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "stop_auto_submit", "description": "Stops silent background submit", "parameters": {"type": "object", "properties": {}}}},
]


def execute_tool_call(tool_name: str, args: dict) -> str:
    try:
        if tool_name == "analyze_screen":
            return tool_analyze_screen(args.get("query", "Describe what is on screen."))
        elif tool_name == "analyze_camera":
            return tool_analyze_camera(args.get("query", "Describe what is visible in camera."))
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
# Speech Engine
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
        communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name
        await communicate.save(temp_path)
        play_audio_file(temp_path)

    asyncio.run(_run())


def play_audio_file(file_path: str):
    try:
        pygame.mixer.music.load(file_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
        pygame.mixer.music.unload()
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


def speak(text: str):
    global is_muted
    if is_muted:
        log_message(f"[MUTED]: {text}")
        return

    log_message(f"[TARK]: {text}")
    if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY.startswith("sk_"):
        if speak_elevenlabs(text, ELEVENLABS_API_KEY):
            return
    speak_edge(text)


# =====================================================================
# Watchdog Sentinel
# =====================================================================
def battery_watchdog_worker():
    global is_running, last_battery_alert_pct
    while is_running:
        try:
            batt = psutil.sensors_battery()
            if batt and not batt.power_plugged:
                pct = int(batt.percent)
                if pct <= 20 and last_battery_alert_pct != pct:
                    last_battery_alert_pct = pct
                    play_chime_boot()
                    warning = f"Sir, power levels are critical at {pct} percent. I advise connecting to AC power."
                    log_message(f"[WATCHDOG]: {warning}")
                    speak(warning)
        except Exception:
            pass
        time.sleep(60)


# =====================================================================
# ReAct Loop
# =====================================================================
AUTONOMOUS_SYSTEM_PROMPT = """You are TARK v7.0, an autonomous multimodal AI desktop agent running in the background on Shishir's PC.
Equipped with full computer tools: analyze_screen, analyze_camera, get_clipboard, set_clipboard, find_files, run_command, run_protocol, take_screenshot, take_webcam_photo, write_file, read_file, control_gui, vision OCR, web search, hardware, memory, timers.
Be proactive. If a command has an error, adjust and call another tool to fix it.
Respond concisely and stylishly in 2-3 spoken sentences. Address the user as 'sir'."""


def run_agent_turn(user_query: str) -> str:
    global conversation_history
    mem = load_memory()
    user_name = mem.get("user_name", "Shishir")
    recent_notes = [n.get("content") for n in mem.get("notes", [])[-3:]]
    mem_context = f"[USER CONTEXT]: Name: {user_name} | Known Facts: {'; '.join(recent_notes)}"

    messages: list[dict] = [
        {"role": "system", "content": f"{AUTONOMOUS_SYSTEM_PROMPT}\n{mem_context}"}
    ]
    messages.extend(conversation_history[-8:])
    messages.append({"role": "user", "content": user_query})

    final_output = ""
    for step in range(5):
        try:
            resp = groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                tools=AGENT_TOOLS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=600,
            )
            msg = resp.choices[0].message
        except Exception as e:
            log_message(f"Groq error: {e}")
            final_output = "I encountered an error executing that, sir."
            break

        if msg.tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in msg.tool_calls
                ],
            })
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    args = {}
                log_message(f"Tool {step+1}: {tc.function.name}({args})")
                res = execute_tool_call(tc.function.name, args)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(res)})
        else:
            final_output = msg.content or ""
            break

    if not final_output:
        final_output = "Goal accomplished, sir."

    clean_spoken = re.sub(r"^\s*(\*{0,2}(?:summary\s*\([^)]*\)|spoken\s*(?:summary|response|reply)?|spoken)\*{0,2}\s*:?\s*)", "", final_output, flags=re.I).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_spoken) if s.strip()]
    spoken = " ".join(sentences[:3]) if len(sentences) > 3 else clean_spoken
    spoken_clean = re.sub(r"[*#_`~>|]", "", spoken).strip()

    conversation_history.append({"role": "user", "content": user_query})
    conversation_history.append({"role": "assistant", "content": final_output})

    play_chime_done()
    return spoken_clean


# =====================================================================
# Background Listener
# =====================================================================
def background_listener_worker():
    global is_running, continuous_mode, last_active_time, is_muted

    log_message("Tark v7.0 Background Multimodal Agent initialized.")
    recognizer = sr.Recognizer()

    try:
        mic = sr.Microphone()
        with mic as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.8)
            recognizer.energy_threshold = max(200, recognizer.energy_threshold)
    except Exception as e:
        log_message(f"Microphone error: {e}")
        return

    threading.Thread(target=battery_watchdog_worker, daemon=True).start()

    play_chime_boot()
    speak("Tark v7 multimodal agent online in the background, sir.")

    while is_running:
        try:
            with mic as source:
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            query = recognizer.recognize_google(audio)
        except (sr.WaitTimeoutError, sr.UnknownValueError):
            continue
        except Exception:
            time.sleep(0.5)
            continue

        if not query or not is_running:
            continue

        low = query.lower()

        if "tark mute" in low or "mute yourself" in low:
            is_muted = True
            play_chime_done()
            speak("Voice muted.")
            continue
        elif "tark unmute" in low or "unmute yourself" in low:
            is_muted = False
            play_chime_done()
            speak("Voice output active, sir.")
            continue

        # Fast-Path Vision Reflexes
        if any(v in low for v in ["what's on my screen", "what is on my screen", "look at my screen", "analyze my screen", "what am i looking at"]):
            res = tool_analyze_screen("Describe what is shown on this desktop and what windows or tasks are active.")
            speak(res); continue
        if any(v in low for v in ["look at me", "what do you see in camera", "what am i holding", "describe camera", "scan me"]):
            res = tool_analyze_camera("Describe who or what is visible in front of the laptop camera.")
            speak(res); continue

        # Fast-Path Protocols
        if any(p in low for p in ["protocol focus", "focus protocol", "coding mode", "focus mode"]):
            msg = protocol_focus(); speak(msg); continue
        if any(p in low for p in ["protocol clean slate", "clean slate", "clean desktop", "clean my desktop", "declutter"]):
            msg = protocol_clean_slate(); speak(msg); continue
        if any(p in low for p in ["protocol lockdown", "lockdown protocol", "lock pc", "lock workstation"]):
            msg = protocol_lockdown(); speak(msg); continue
        if any(p in low for p in ["protocol chill", "chill protocol", "relax mode", "chill mode"]):
            msg = protocol_chill(); speak(msg); continue
        if any(p in low for p in ["protocol stealth", "stealth protocol", "boss key"]):
            msg = protocol_stealth(); speak(msg); continue
        if any(p in low for p in ["protocol briefing", "daily briefing", "morning protocol"]):
            msg = protocol_briefing(); speak(msg); continue

        # Fast-Path Hardware Reflexes
        if any(w in low for w in ["take a screenshot", "take screenshot", "capture screen"]):
            msg = tool_take_screenshot()
            speak("Screenshot captured to desktop, sir."); continue
        if any(w in low for w in ["take a photo", "take photo", "take a picture", "take a selfie"]):
            msg = tool_take_webcam_photo()
            speak("Photo captured to desktop, sir."); continue

        # Fast-path for background submit controls (flexible keywords)
        is_stop_submit = any(k in low for k in [
            "stop submit", "stop auto submit", "cancel submit", "stop auto", "stop pressing submit",
            "stop clicking submit", "halt submit", "deactivate submit", "stop pressing", "stop clicking", "pause submit"
        ])

        is_start_submit = (
            any(k in low for k in ["submit", "enter", "allow"]) and 
            any(w in low for w in ["repeat", "rapid", "continu", "again", "loop", "keep", "auto", "multip", "sever", "always", "until"])
        ) or any(k in low for k in [
            "press submit", "click submit", "enter submit", "auto submit", "start auto submit",
            "hit submit", "press enter repeatedly", "keep submitting", "submit button repeatedly",
            "submit button repeated", "press submit button"
        ])

        if is_stop_submit:
            msg = tool_stop_auto_submit()
            speak(msg)
            last_active_time = time.time()
            continue

        if is_start_submit:
            msg = tool_start_auto_submit()
            speak(msg)
            last_active_time = time.time()
            continue

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
            "find", "search", "who", "what", "where", "how", "why", "code", "run", "help"
        ])

        if not (has_wake_word or is_recent_interaction or is_explicit_command):
            log_message(f"Ambient noise ignored: '{query}'")
            continue

        last_active_time = time.time()

        log_message(f"User command: {clean_command}")
        spoken_reply = run_agent_turn(clean_command)
        speak(spoken_reply)


# =====================================================================
# System Tray UI
# =====================================================================
def create_tray_icon_image():
    image = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((4, 4, 60, 60), fill=(15, 23, 42, 255), outline=(56, 189, 248, 255), width=3)
    draw.ellipse((18, 18, 46, 46), fill=(14, 165, 233, 255), outline=(224, 242, 254, 255), width=2)
    draw.ellipse((28, 28, 36, 36), fill=(255, 255, 255, 255))
    return image


def toggle_mute(icon, item):
    global is_muted
    is_muted = not is_muted
    icon.notify(f"Tark is now {'Muted' if is_muted else 'Unmuted'}", "Tark Voice")


def open_logs(icon, item):
    if LOG_FILE.exists():
        subprocess.Popen(["notepad.exe", str(LOG_FILE)])


def exit_tark(icon, item):
    global is_running
    is_running = False
    icon.stop()
    sys.exit(0)


def main():
    global tray_icon

    listener_thread = threading.Thread(target=background_listener_worker, daemon=True)
    listener_thread.start()

    icon_image = create_tray_icon_image()
    menu = pystray.Menu(
        pystray.MenuItem("🛡️ Tark v7.0: Multimodal JARVIS Active", lambda: None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("🔇 Toggle Mute Voice", toggle_mute),
        pystray.MenuItem("📋 View Activity Log", open_logs),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("❌ Exit Tark", exit_tark),
    )

    tray_icon = pystray.Icon("TarkAssistant", icon_image, "Tark v7.0 Multimodal JARVIS", menu)

    try:
        tray_icon.notify("Tark v7.0 Multimodal JARVIS Online.", "Tark Online")
    except Exception:
        pass

    log_message("Tark v7.0 System Tray started.")
    tray_icon.run()


if __name__ == "__main__":
    main()
