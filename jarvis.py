"""Jarvis — Autonomous AI Voice & Real Computer Automation Assistant for Windows.

Capabilities:
- 🧠 Ultra-Fast Reasoning: Groq 120B Model (`openai/gpt-oss-120b`)
- 🗣️ Natural Human Speech: ElevenLabs Neural Engine (with Edge-TTS fallback)
- 👂 Microphone & Hands-Free Listening: SpeechRecognition + Google STT
- 💻 Real Computer Automation:
    * YouTube Song & Video Playing (`pywhatkit.playonyt`)
    * Master System Volume (Up, Down, Mute, Max)
    * Media Controls (Play, Pause, Next Track, Prev Track)
    * Keyboard Automation (Instant text typing, hotkeys, window closing)
    * Workspace Management (Minimize all windows, lock PC, task switching)
    * Screenshots (Saved directly to your Desktop)
    * Google Search & URL navigation
    * Native Windows App launching (Chrome, Spotify, VS Code, Notepad, Calc, etc.)
"""
from __future__ import annotations

import asyncio
from datetime import datetime
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.parse

# Ensure console supports UTF-8 characters without crashes
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import ctypes
import pyautogui
import pygame
import pyperclip
import pywhatkit
import psutil
import speech_recognition as sr
from groq import Groq

from tark_core.student_tutor import student_tutor
from tark_core.system_operator import SystemOperator

from tark_core.config import GROQ_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

system_operator = SystemOperator()

# PyAutoGUI safety configuration
pyautogui.FAILSAFE = False

groq_client = Groq(api_key=GROQ_API_KEY)
pygame.mixer.init()


# =====================================================================
# Voice Engine (TTS: ElevenLabs & Edge-TTS)
# =====================================================================
def speak_elevenlabs(text: str, api_key: str) -> bool:
    """Streams and speaks using ElevenLabs Neural API."""
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
    except Exception as e:
        print(f"  [ElevenLabs Notice]: {e}. Falling back to Neural Edge-TTS.")
        return False


def speak_edge(text: str):
    """Fallback to Microsoft Edge Neural Voice (Christopher / Guy)."""
    import edge_tts

    async def _run():
        communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name
        await communicate.save(temp_path)
        play_audio_file(temp_path)

    asyncio.run(_run())


def play_audio_file(file_path: str):
    """Plays an audio MP3 using pygame mixer cleanly."""
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
    """Speaks text using the best available voice engine."""
    print(f"\n[JARVIS]: {text}")
    if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY.startswith("sk_"):
        if speak_elevenlabs(text, ELEVENLABS_API_KEY):
            return
    speak_edge(text)


# =====================================================================
# Real Windows Computer Automation Engine
# =====================================================================
def execute_single_action(action_str: str) -> str:
    """Executes a single autonomous action on the Windows desktop."""
    action = action_str.strip()
    if not action:
        return ""

    try:
        # 1. YouTube Song & Video Playing
        if action.startswith("play_yt:"):
            query = action.split("play_yt:", 1)[1].strip()
            print(f"  ⚡ [YouTube]: Searching and playing '{query}'...")
            pywhatkit.playonyt(query)
            return f"Playing '{query}' on YouTube"

        # 2. Volume Controls
        elif action == "volume_up":
            for _ in range(5):  # 10% increase
                pyautogui.press("volumeup")
            return "Volume increased"

        elif action == "volume_down":
            for _ in range(5):  # 10% decrease
                pyautogui.press("volumedown")
            return "Volume decreased"

        elif action == "volume_mute":
            pyautogui.press("volumemute")
            return "Volume muted/unmuted"

        elif action == "volume_max":
            for _ in range(50):
                pyautogui.press("volumeup")
            return "Volume set to maximum"

        # 3. Media Controls
        elif action in ("media_play_pause", "media_pause", "media_play"):
            pyautogui.press("playpause")
            return "Toggled play/pause"

        elif action == "media_next":
            pyautogui.press("nexttrack")
            return "Skipped to next track"

        elif action == "media_prev":
            pyautogui.press("prevtrack")
            return "Returned to previous track"

        # 4. Keyboard Typing & Text Insertion
        elif action.startswith("type_text:"):
            text = action.split("type_text:", 1)[1]
            print(f"  ⚡ [Keyboard]: Typing '{text}' into active window...")
            # Use clipboard paste for instant, error-free typing with emojis & formatting
            pyperclip.copy(text)
            pyautogui.hotkey("ctrl", "v")
            return f"Typed: {text[:40]}..."

        elif action.startswith("press_key:"):
            key = action.split("press_key:", 1)[1].strip()
            pyautogui.press(key)
            return f"Pressed key '{key}'"

        # 5. Workspace & Window Management
        elif action == "minimize_all":
            pyautogui.hotkey("win", "d")
            return "Minimized all windows (Desktop shown)"

        elif action == "close_window":
            pyautogui.hotkey("alt", "f4")
            return "Closed current window"

        elif action == "switch_window":
            pyautogui.hotkey("alt", "tab")
            return "Switched window"

        elif action == "lock_pc":
            subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
            return "Locked workstation"

        # 6. Screenshot Capture
        elif action == "take_screenshot":
            desktop_dir = Path.home() / "Desktop"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = desktop_dir / f"jarvis_screenshot_{timestamp}.png"
            pyautogui.screenshot(str(screenshot_path))
            print(f"  ⚡ [Screenshot]: Saved to {screenshot_path}")
            return f"Saved screenshot to {screenshot_path.name}"

        # 7. Web & Google Searching
        elif action.startswith("search_google:"):
            query = action.split("search_google:", 1)[1].strip()
            url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
            subprocess.Popen(["powershell", "-NoProfile", "-Command", f"Start-Process '{url}'"])
            return f"Searched Google for '{query}'"

        elif action.startswith("open_url:"):
            url = action.split("open_url:", 1)[1].strip()
            if not url.startswith("http"):
                url = f"https://{url}"
            subprocess.Popen(["powershell", "-NoProfile", "-Command", f"Start-Process '{url}'"])
            return f"Opened {url}"

        # 8. Application Launching
        elif action.startswith("open_app:"):
            raw_app = action.split("open_app:", 1)[1].strip().lower()
            app_map = {
                "chrome": "chrome",
                "google chrome": "chrome",
                "spotify": "spotify",
                "vscode": "code",
                "vs code": "code",
                "code": "code",
                "notepad": "notepad",
                "calc": "calc",
                "calculator": "calc",
                "terminal": "powershell",
                "cmd": "cmd",
                "explorer": "explorer",
                "file explorer": "explorer",
                "discord": "discord",
                "settings": "ms-settings:",
                "task manager": "taskmgr",
            }
            target = app_map.get(raw_app, raw_app)
            subprocess.Popen(["cmd", "/c", "start", target])
            return f"Launched {raw_app}"

        # 9. Generic PowerShell Command
        elif action.startswith("run_cmd:"):
            cmd = action.split("run_cmd:", 1)[1].strip()
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", cmd],
                capture_output=True,
                text=True,
                timeout=15,
            )
            out = (res.stdout or res.stderr).strip()
            return out if out else "Command executed."

        # 10. Student Academic Problem Solver
        elif action.startswith("solve_doubt:"):
            q = action.split("solve_doubt:", 1)[1].strip()
            print(f"\n📚 [JARVIS ACADEMIC SOLVER]: Analyzing problem '{q[:60]}...'")
            ans = student_tutor.solve_doubt(q)
            print(f"\n{ans}\n")
            return "Academic solution provided."

        # 11. Screen Ocular Vision (Reading homework/problems from screen)
        elif action.startswith("explain_screen"):
            instruction = action.split("explain_screen:", 1)[1].strip() if ":" in action else "Solve the problem shown on screen."
            print(f"\n👁️ [JARVIS VISION]: Reading active screen...")
            ans = student_tutor.explain_screen_problem(instruction)
            print(f"\n{ans}\n")
            return "Screen visual analysis complete."

        # 12. Interactive Quizzing
        elif action.startswith("quiz:"):
            top = action.split("quiz:", 1)[1].strip()
            print(f"\n❓ [JARVIS QUIZ MASTER]: Generating recall questions on '{top}'...")
            ans = student_tutor.generate_quiz(top)
            print(f"\n{ans}\n")
            return f"Generated quiz on {top}."

        # 13. Viral Study Focus Protocol ("Study with Jarvis")
        elif action.startswith("study_session:"):
            parts = action.split("study_session:", 1)[1].split(":")
            sub = parts[0].strip() if parts else "General"
            mins = int(parts[1].strip()) if len(parts) > 1 and parts[1].strip().isdigit() else 25
            print(f"\n🎯 [STUDY PROTOCOL ENGAGED]: {sub} for {mins} minutes")
            ans = student_tutor.start_study_session(subject=sub, duration_minutes=mins)
            print(f"\n{ans}\n")
            return f"Study protocol active for {sub}."

        elif action == "stop_study":
            return student_tutor.stop_study_session()

        # 14. Academic Deliverables & Document Automation (Word, PPT, Excel)
        elif action.startswith("word_notes:"):
            topic = action.split("word_notes:", 1)[1].strip()
            print(f"\n📝 [JARVIS NOTE MAKER]: Generating formatted revision notes in Word for '{topic}'...")
            from tark_core.academic_worker import academic_worker
            res = academic_worker.create_word_notes(topic=topic, open_after_create=True)
            print(f"  ✓ Saved to: {res['file_path']}\n")
            return f"Revision notes for {topic} created and opened in Word."

        elif action.startswith("assignment:"):
            title = action.split("assignment:", 1)[1].strip()
            print(f"\n📋 [JARVIS ASSIGNMENT WRITER]: Drafting formal assignment in Word for '{title}'...")
            from tark_core.academic_worker import academic_worker
            res = academic_worker.create_assignment_document(title=title, open_after_create=True)
            print(f"  ✓ Saved to: {res['file_path']}\n")
            return f"Assignment on {title} drafted and opened in Word."

        elif action.startswith("presentation:"):
            topic = action.split("presentation:", 1)[1].strip()
            print(f"\n📊 [JARVIS SLIDE MAKER]: Creating PowerPoint slides for '{topic}'...")
            from tark_core.academic_worker import academic_worker
            res = academic_worker.create_presentation_slides(topic=topic, open_after_create=True)
            print(f"  ✓ Saved to: {res['file_path']}\n")
            return f"PowerPoint presentation for {topic} created and launched."

        elif action.startswith("practice_test:"):
            topic = action.split("practice_test:", 1)[1].strip()
            print(f"\n📝 [JARVIS EXAM MAKER]: Setting mock exam paper in Word for '{topic}'...")
            from tark_core.academic_worker import academic_worker
            res = academic_worker.create_practice_test_paper(topic=topic, open_after_create=True)
            print(f"  ✓ Saved to: {res['file_path']}\n")
            return f"Mock test paper for {topic} created and opened in Word."

        elif action.startswith("timetable"):
            print(f"\n📅 [JARVIS TIMETABLE MAKER]: Generating revision schedule in Excel...")
            from tark_core.academic_worker import academic_worker
            res = academic_worker.create_study_timetable(open_after_create=True)
            print(f"  ✓ Saved to: {res['file_path']}\n")
            return "Revision timetable created and opened in Excel."

        elif action.startswith("solve_screen_to_word"):
            print(f"\n👁️📝 [JARVIS VISION TO WORD]: Reading screen and generating Word solution...")
            ans = student_tutor.solve_screen_to_word()
            print(f"\n{ans}\n")
            return "Screen problem solved and launched in Word."

        # 14. Anti-gravity Workspace Submit Loop
        elif action == "auto_submit":
            return system_operator.start_auto_submit_loop()

        elif action == "stop_auto_submit":
            return system_operator.stop_auto_submit_loop()

        # 15. Viral Protocols
        elif action.startswith("run_protocol:"):
            proto = action.split("run_protocol:", 1)[1].strip().lower()
            if proto == "focus":
                return student_tutor.start_study_session(subject="General", duration_minutes=25)
            elif proto == "clean_slate":
                pyautogui.hotkey("win", "d")
                return "Desktop decluttered."
            elif proto == "lockdown":
                pyautogui.press("playpause")
                subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
                return "Workstation locked."
            elif proto == "chill":
                pywhatkit.playonyt("lofi chill study beats")
                return "Chill mode active."
            elif proto == "stealth":
                pyautogui.hotkey("win", "d")
                pyautogui.press("volumemute")
                return "Stealth mode engaged."
            elif proto == "briefing":
                cpu = psutil.cpu_percent()
                mem = psutil.virtual_memory().percent
                return f"System telemetry: CPU {cpu}%, RAM {mem}%."

    except Exception as e:
        return f"Action failed: {e}"

    return f"Unrecognized action: {action}"


# =====================================================================
# AI Brain Reasoning & Decision Router (Groq 120B)
# =====================================================================
def get_live_context() -> str:
    active_win = "Windows Desktop"
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if hwnd:
            buff = ctypes.create_unicode_buffer(512)
            ctypes.windll.user32.GetWindowTextW(hwnd, buff, 512)
            if buff.value:
                active_win = buff.value
    except Exception:
        pass

    now = datetime.now()
    time_str = now.strftime("%A, %B %d, %Y - %I:%M %p")
    try:
        batt = psutil.sensors_battery()
        batt_str = f"{batt.percent}% ({'Plugged in' if batt.power_plugged else 'Battery'})" if batt else "Desktop"
    except Exception:
        batt_str = "Nominal"

    prof = student_tutor.get_student_academic_profile()
    tasks = student_tutor.get_active_study_tasks()
    task_str = tasks[0]["next_milestone"] if tasks else "No upcoming deadlines"

    return (
        f"[CURRENT LIVE CONTEXT]:\n"
        f"• Student: {prof.get('name', 'Shishir')} (Class {prof.get('grade', '10')} {prof.get('board', 'CBSE')})\n"
        f"• Target Exam: {prof.get('exam', 'Board Exams')} | Weak Areas: {', '.join(prof.get('weak_subjects', []))}\n"
        f"• Active Focused Window: '{active_win}'\n"
        f"• System Time: {time_str} | Battery: {batt_str}\n"
        f"• Next Academic Milestone: '{task_str}'"
    )


BASE_SYSTEM_PROMPT = """You are JARVIS, an ultra-intelligent, confident, autonomous AI desktop assistant and student academic master running on the user's Windows PC.
You speak like Tony Stark's JARVIS: polite, concise, extremely capable, and stylish. Always address the user as 'sir'.
Keep spoken answers to ONE or TWO short, direct, articulate sentences suitable for neural voice synthesis.

You have REAL, DIRECT CONTROL over this Windows PC and deep student study superpowers.
Whenever the user requests an action, append one or more ACTION tags at the VERY END of your response.

Supported ACTION tags:
- ACTION:play_yt:<song or video query> (Plays songs, videos, or lofi on YouTube)
- ACTION:volume_up (Increases master volume by 10%)
- ACTION:volume_down (Decreases master volume by 10%)
- ACTION:volume_mute (Toggles mute)
- ACTION:volume_max (Sets volume to 100%)
- ACTION:media_play_pause (Plays or pauses currently playing music/video)
- ACTION:media_next (Skips to next track)
- ACTION:media_prev (Goes to previous track)
- ACTION:type_text:<exact text> (Directly types/pastes text into the active window)
- ACTION:press_key:<key name> (Presses enter, space, esc, backspace)
- ACTION:minimize_all (Minimizes all windows to show the desktop)
- ACTION:close_window (Closes current window / tab)
- ACTION:switch_window (Switches to another active window)
- ACTION:take_screenshot (Captures a screenshot directly to the Desktop)
- ACTION:search_google:<query> (Searches Google in the browser)
- ACTION:open_app:<app name> (Opens Chrome, Spotify, VS Code, Notepad, Calculator, Discord, Settings)
- ACTION:open_url:<url> (Opens any website)
- ACTION:lock_pc (Locks the Windows screen)
- ACTION:run_cmd:<powershell command> (Executes custom PowerShell scripts)
- ACTION:solve_doubt:<question> (Solves student homework/doubt with 4-tier pedagogical steps)
- ACTION:explain_screen (Reads student homework, math problem, or code error from screen using Vision AI and solves it)
- ACTION:quiz:<topic> (Generates rapid recall conceptual quiz flashcards)
- ACTION:study_session:<subject>:<minutes> (Engages Pomodoro study mode, focus audio, minimizes distractions)
- ACTION:stop_study (Concludes active study session)
- ACTION:word_notes:<topic> (Generates comprehensive, beautifully formatted revision notes in Word .docx and opens Word)
- ACTION:assignment:<title> (Drafts a complete formal school/college assignment or lab report in Word .docx and opens Word)
- ACTION:presentation:<topic> (Generates multi-slide presentation in PowerPoint .pptx and opens PowerPoint)
- ACTION:practice_test:<topic> (Sets a balanced mock exam paper in Word .docx with solutions and opens Word)
- ACTION:timetable (Generates an hourly study and revision timetable in Excel .xlsx and opens Excel)
- ACTION:solve_screen_to_word (Captures question from screen, solves with Vision AI, exports to Word, and opens Word)
- ACTION:auto_submit (Auto clicks submit & approves dialogs across Antigravity IDE workspaces)
- ACTION:stop_auto_submit (Stops auto submit loop)
- ACTION:run_protocol:<focus|clean_slate|lockdown|chill|stealth|briefing> (Runs signature protocol)

Examples:
User: Make notes on Light Reflection and Refraction in Word
JARVIS: Generating your revision notes on Light Reflection and Refraction and launching Word now, sir. ACTION:word_notes:Light Reflection and Refraction

User: Write my physics assignment on Ohm's law in Word
JARVIS: Drafting your formal Ohm's Law assignment with theory and observation tables in Word now, sir. ACTION:assignment:Verification of Ohm's Law

User: Make a presentation on Renewable Energy
JARVIS: Designing your slides on Renewable Energy and launching PowerPoint now, sir. ACTION:presentation:Renewable Energy

User: Create a practice test on Electricity in Word
JARVIS: Setting a 25-mark practice test paper with solutions in Word now, sir. ACTION:practice_test:Electricity

User: Make my study timetable
JARVIS: Structuring your weekly revision timetable in Excel now, sir. ACTION:timetable

User: Solve this question on my screen and put it in Word
JARVIS: Scanning your screen, solving the problem, and formatting the solution into Word now, sir. ACTION:solve_screen_to_word
User: Play Starboy on YouTube
JARVIS: Playing Starboy on YouTube now, sir. ACTION:play_yt:Starboy

User: Solve this physics question on my screen
JARVIS: Scanning your screen and solving the problem step-by-step, sir. ACTION:explain_screen

User: Explain Newton's second law
JARVIS: Force is the rate of change of momentum, expressed as F equals m a, sir. Let me provide the complete derivation. ACTION:solve_doubt:Explain Newton's second law of motion

User: I want to study Physics for 30 minutes
JARVIS: Engaging the study focus protocol for 30 minutes, sir. Clearing distractions and queueing focus audio now. ACTION:study_session:Physics:30

User: Turn up the volume and pause the music
JARVIS: Raising the volume and pausing your media, sir. ACTION:volume_up ACTION:media_play_pause

User: Minimize everything and take a screenshot
JARVIS: Clearing your desktop and capturing the screen now, sir. ACTION:minimize_all ACTION:take_screenshot
"""


def ask_groq(prompt: str) -> tuple[str, list[str]]:
    """Sends user query to Groq 120B with dynamic live context and parses speech and actions."""
    context = get_live_context()
    full_prompt = f"{BASE_SYSTEM_PROMPT}\n\n{context}"

    resp = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": full_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=350,
    )
    raw = resp.choices[0].message.content or ""

    # Extract all ACTION tags (handles multiple actions on same or separate lines)
    actions = [a.strip() for a in re.findall(r"ACTION:(.*?)(?=(?:ACTION:|$))", raw, flags=re.DOTALL) if a.strip()]
    # Remove ACTION tags from speech
    clean_text = re.sub(r"ACTION:.*", "", raw, flags=re.DOTALL).strip()

    return clean_text, actions


# =====================================================================
# Microphone Ear (Speech Recognition)
# =====================================================================
def listen(recognizer: sr.Recognizer, mic: sr.Microphone) -> str:
    """Listens for voice commands with instant fallback."""
    try:
        with mic as source:
            print("\n  🎤 [LISTENING...] (Speak your command, or press Ctrl+C to type)")
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=6, phrase_time_limit=10)
        print("  ⚡ [RECOGNIZING SPEECH...]")
        return recognizer.recognize_google(audio)
    except sr.WaitTimeoutError:
        return ""
    except sr.UnknownValueError:
        return ""
    except KeyboardInterrupt:
        try:
            return input("\n  ⌨️ [TYPE COMMAND]: ").strip()
        except (KeyboardInterrupt, EOFError):
            return "exit"
    except Exception:
        try:
            return input("  ⌨️ [TYPE COMMAND]: ").strip()
        except (KeyboardInterrupt, EOFError):
            return "exit"


# =====================================================================
# Main Loop
# =====================================================================
def main():
    print("=" * 65)
    print("  🤖 JARVIS AUTONOMOUS SYSTEM ONLINE")
    print("  Brain: Groq 120B Reasoning Engine")
    if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY.startswith("sk_"):
        print("  Voice: ElevenLabs Neural Engine (Active)")
    else:
        print("  Voice: Microsoft Edge Neural Engine (Active)")
    print("  Capabilities: Full Windows Desktop Automation")
    print("=" * 65)

    recognizer = sr.Recognizer()
    try:
        mic = sr.Microphone()
    except Exception as e:
        print(f"  [Microphone warning]: {e}. Switching to keyboard input.")
        mic = None

    speak("Jarvis online and standing by for your commands, sir.")

    while True:
        if mic:
            query = listen(recognizer, mic)
        else:
            try:
                query = input("\n👤 [YOU]: ").strip()
            except (KeyboardInterrupt, EOFError):
                break

        if not query:
            continue

        print(f"👤 [YOU]: {query}")
        low = query.lower()
        if low in ("exit", "quit", "shutdown", "sleep", "goodbye"):
            speak("Powering down system. Good day, sir.")
            break

        spoken_reply, actions = ask_groq(query)

        # 1. Speak response first
        speak(spoken_reply)

        # 2. Execute all autonomous computer actions
        for act in actions:
            print(f"  ⚡ [EXECUTING]: {act}")
            result = execute_single_action(act)
            if result:
                print(f"  📄 [RESULT]: {result}")


if __name__ == "__main__":
    main()
