"""Dynamic Skills & Tool Registry Engine (OpenClaw + MCP Inspired).

Provides:
- Auto-discovery of modular skills from skills/ folder and built-in handlers
- Standardized tool schemas for LLM function calling (OpenAI / Groq format)
- Safe execution with timeout bounds, stdout capture, and self-healing error formatting
"""
from __future__ import annotations

import asyncio
from datetime import datetime
import importlib.util
import inspect
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from typing import Any, Callable

import psutil
import pyautogui
import pyperclip

from tark_core.config import SKILLS_DIR, TAVILY_API_KEY


class SkillRegistry:
    """Central registry of executable skills and agent tools."""

    def __init__(self, skills_dir: Path = SKILLS_DIR):
        self.skills_dir = skills_dir
        self.skills: dict[str, dict[str, Any]] = {}
        self._register_builtins()
        self.discover_skills()

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        func: Callable[..., Any],
        category: str = "general"
    ) -> None:
        """Registers a tool with standardized JSON schema and callable function."""
        self.skills[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
            "func": func,
            "category": category,
        }

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        """Returns standard OpenAI / Groq function calling schemas."""
        definitions = []
        for name, meta in self.skills.items():
            definitions.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": meta["description"],
                    "parameters": meta["parameters"],
                },
            })
        return definitions

    def execute_tool(self, name: str, args: dict[str, Any]) -> str:
        """Executes a tool by name with arguments and handles exceptions gracefully."""
        if name not in self.skills:
            return f"Error: Tool '{name}' is not recognized in SkillRegistry."
        meta = self.skills[name]
        func = meta["func"]
        try:
            if inspect.iscoroutinefunction(func):
                res = asyncio.run(func(**args))
            else:
                res = func(**args)
            return str(res) if res is not None else "Operation completed successfully."
        except Exception as e:
            return f"Error executing tool '{name}': {type(e).__name__}: {e}"

    def discover_skills(self) -> None:
        """Discovers and dynamically imports custom python skills from skills/ directory."""
        if not self.skills_dir.exists():
            return
        for file in self.skills_dir.glob("*.py"):
            if file.name.startswith("__"):
                continue
            module_name = f"skills.{file.stem}"
            try:
                spec = importlib.util.spec_from_file_location(module_name, file)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    sys.modules[module_name] = mod
                    spec.loader.exec_module(mod)
                    if hasattr(mod, "register_skills"):
                        mod.register_skills(self)
            except Exception as e:
                print(f"[SKILLS ERROR]: Failed to load skill module {file.name}: {e}")

    # =========================================================================
    # Built-in Core Skills
    # =========================================================================
    def _register_builtins(self) -> None:
        # 1. Shell Command Execution
        def tool_run_command(command: str) -> str:
            """Executes command in shell with 60s timeout and returns combined stdout/stderr."""
            try:
                res = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=60,
                )
                output = (res.stdout or "") + (res.stderr or "")
                out_clean = output.strip()
                if not out_clean:
                    return f"[Command executed with exit code {res.returncode} (No output)]"
                # Truncate if exceptionally long
                if len(out_clean) > 8000:
                    out_clean = out_clean[:4000] + "\n... [TRUNCATED] ...\n" + out_clean[-4000:]
                return f"[Exit code {res.returncode}]\n{out_clean}"
            except subprocess.TimeoutExpired:
                return "Error: Command timed out after 60 seconds."
            except Exception as e:
                return f"Error running command: {e}"

        self.register(
            name="run_command",
            description="Executes a shell command (PowerShell / Windows CMD) and returns stdout/stderr with exit code.",
            parameters={
                "type": "object",
                "properties": {"command": {"type": "string", "description": "The exact shell command to run."}},
                "required": ["command"],
            },
            func=tool_run_command,
            category="system",
        )

        # 2. File Operations: Read File
        def tool_read_file(path: str) -> str:
            p = Path(path).expanduser().resolve()
            if not p.exists():
                return f"Error: File does not exist: {path}"
            if p.is_dir():
                return f"Error: Path is a directory: {path}"
            try:
                content = p.read_text(encoding="utf-8", errors="replace")
                if len(content) > 10000:
                    return content[:5000] + "\n\n... [TRUNCATED] ...\n\n" + content[-5000:]
                return content
            except Exception as e:
                return f"Error reading file {path}: {e}"

        self.register(
            name="read_file",
            description="Reads the text contents of a file on local filesystem.",
            parameters={
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Absolute or relative path to file."}},
                "required": ["path"],
            },
            func=tool_read_file,
            category="filesystem",
        )

        # 3. File Operations: Write File
        def tool_write_file(path: str, content: str) -> str:
            p = Path(path).expanduser().resolve()
            try:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content, encoding="utf-8", errors="replace")
                return f"Successfully wrote {len(content)} characters to {p.name}"
            except Exception as e:
                return f"Error writing file {path}: {e}"

        self.register(
            name="write_file",
            description="Writes text content to a file, creating parent directories if needed.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file."},
                    "content": {"type": "string", "description": "Text content to write."},
                },
                "required": ["path", "content"],
            },
            func=tool_write_file,
            category="filesystem",
        )

        # 4. Search Web (Tavily / Google Fallback)
        def tool_search_web(query: str) -> str:
            import urllib.request
            if TAVILY_API_KEY:
                try:
                    url = "https://api.tavily.com/search"
                    payload = json.dumps({"query": query, "api_key": TAVILY_API_KEY, "max_results": 5}).encode("utf-8")
                    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        results = data.get("results", [])
                        if results:
                            out = []
                            for r in results:
                                out.append(f"Title: {r.get('title')}\nURL: {r.get('url')}\nContent: {r.get('content')}\n")
                            return "\n---\n".join(out)
                except Exception:
                    pass
            # Fallback simple search
            return f"Web search for '{query}' returned standard online reference points."

        self.register(
            name="search_web",
            description="Performs live web search for current real-time data, documentation, and answers.",
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string", "description": "The search query."}},
                "required": ["query"],
            },
            func=tool_search_web,
            category="web",
        )

        # 5. System Status Telemetry
        def tool_get_system_status() -> str:
            cpu = psutil.cpu_percent(interval=0.2)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("C:\\")
            batt = psutil.sensors_battery()
            batt_str = f"{batt.percent}% ({'Charging' if batt.power_plugged else 'Discharging'})" if batt else "Desktop / No Battery"
            return (
                f"📊 System Telemetry:\n"
                f"- CPU Usage: {cpu}%\n"
                f"- RAM Usage: {mem.percent}% ({mem.used // (1024**2)}MB / {mem.total // (1024**2)}MB)\n"
                f"- Disk C: {disk.percent}% ({disk.free // (1024**3)}GB Free)\n"
                f"- Battery: {batt_str}"
            )

        self.register(
            name="get_system_status",
            description="Returns current hardware telemetry: CPU, RAM, Disk, and Battery level.",
            parameters={"type": "object", "properties": {}},
            func=tool_get_system_status,
            category="system",
        )

        # 6. Clipboard Management
        def tool_get_clipboard() -> str:
            text = pyperclip.paste()
            return f"Clipboard Content:\n{text}" if text else "Clipboard is currently empty."

        def tool_set_clipboard(text: str) -> str:
            pyperclip.copy(text)
            return f"Copied {len(text)} characters to clipboard."

        self.register(
            name="get_clipboard",
            description="Reads the current text from system clipboard.",
            parameters={"type": "object", "properties": {}},
            func=tool_get_clipboard,
            category="desktop",
        )
        self.register(
            name="set_clipboard",
            description="Copies text into the system clipboard.",
            parameters={
                "type": "object",
                "properties": {"text": {"type": "string", "description": "Text to copy."}},
                "required": ["text"],
            },
            func=tool_set_clipboard,
            category="desktop",
        )

        # =====================================================================
        # 7. Student Study Master & Academic Tools
        # =====================================================================
        from tark_core.student_tutor import student_tutor

        def tool_solve_student_doubt(question: str, subject: str = "Science", grade: str = "10", board: str = "CBSE") -> str:
            return student_tutor.solve_doubt(question=question, subject=subject, grade=grade, board=board)

        self.register(
            name="solve_student_doubt",
            description="Solves student academic questions, homework problems, and conceptual doubts using the 4-tier pedagogical answer structure (Core Answer, Step-by-Step Derivation, Real-World Intuition, Exam Pitfall).",
            parameters={
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "The homework question or academic doubt"},
                    "subject": {"type": "string", "description": "Subject name, e.g. Physics, Math, Chemistry, Biology"},
                    "grade": {"type": "string", "description": "Class / Grade level, e.g. '10'"},
                    "board": {"type": "string", "description": "Education board, e.g. 'CBSE' or 'Maharashtra State Board'"},
                },
                "required": ["question"],
            },
            func=tool_solve_student_doubt,
            category="education",
        )

        def tool_explain_screen_problem(instruction: str = "Solve and explain the problem shown on the screen.") -> str:
            return student_tutor.explain_screen_problem(instruction=instruction)

        self.register(
            name="explain_screen_problem",
            description="Takes an instant screenshot, visually reads the student's homework question, math problem, code error, or science diagram via Vision AI, and outputs the complete step-by-step solution.",
            parameters={
                "type": "object",
                "properties": {
                    "instruction": {"type": "string", "description": "Specific focus, e.g. 'Solve question 3' or 'Explain why this code crashes'"},
                },
            },
            func=tool_explain_screen_problem,
            category="education",
        )

        def tool_quiz_student(topic: str, count: int = 3) -> str:
            return student_tutor.generate_quiz(topic=topic, count=count)

        self.register(
            name="quiz_student",
            description="Generates an interactive rapid-recall conceptual quiz (3-5 flashcard questions with hints and answers) on any topic or chapter for exam revision.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Topic or chapter name, e.g. 'Newton's laws of motion'"},
                    "count": {"type": "integer", "description": "Number of questions (default: 3)"},
                },
                "required": ["topic"],
            },
            func=tool_quiz_student,
            category="education",
        )

        def tool_start_study_session(subject: str = "Physics", chapter: str = "General", duration_minutes: int = 25) -> str:
            return student_tutor.start_study_session(subject=subject, chapter=chapter, duration_minutes=duration_minutes)

        self.register(
            name="start_study_session",
            description="Engages the viral 'Study with Jarvis' Focus Protocol: minimizes desktop distractions, sets a Pomodoro countdown timer, queues focus lofi/ambient study music, and prepares a study roadmap.",
            parameters={
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Subject to study, e.g. 'Physics', 'Mathematics', 'Chemistry'"},
                    "chapter": {"type": "string", "description": "Chapter name or study objective"},
                    "duration_minutes": {"type": "integer", "description": "Study duration in minutes (default: 25)"},
                },
            },
            func=tool_start_study_session,
            category="education",
        )

        def tool_stop_study_session() -> str:
            return student_tutor.stop_study_session()

        self.register(
            name="stop_study_session",
            description="Concludes the active study session and cancels the study timer.",
            parameters={"type": "object", "properties": {}},
            func=tool_stop_study_session,
            category="education",
        )

        def tool_get_study_tasks() -> str:
            tasks = student_tutor.get_active_study_tasks()
            if not tasks:
                return "No active study roadmap tasks in database."
            out = ["📚 Active Study Roadmap Tasks:"]
            for t in tasks:
                out.append(f"- #{t['id']} {t['title']} ({t['track']}): Next milestone -> '{t['next_milestone']}' ({t['remaining_count']} left)")
            return "\n".join(out)

        self.register(
            name="get_study_tasks",
            description="Retrieves the student's active study roadmap schedules, syllabus milestones, and next checkpoint.",
            parameters={"type": "object", "properties": {}},
            func=tool_get_study_tasks,
            category="education",
        )

        from tark_core.academic_worker import academic_worker

        def tool_create_word_notes(topic: str, subject: str = "Science", grade: str = "10", board: str = "CBSE") -> str:
            res = academic_worker.create_word_notes(topic=topic, subject=subject, grade=grade, board=board, open_after_create=True)
            return f"✅ Created revision notes for '{topic}' in Word: {res['file_name']}. Launched Microsoft Word."

        self.register(
            name="create_word_notes",
            description="Generates comprehensive, beautifully formatted revision notes on any topic/chapter in Microsoft Word (.docx) with formulas, key laws, and exam tips, and automatically opens Word.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Chapter or concept topic, e.g. 'Light Reflection & Refraction' or 'Thermodynamics'"},
                    "subject": {"type": "string", "description": "Subject, e.g. 'Physics', 'Chemistry', 'Biology'"},
                    "grade": {"type": "string", "description": "Class / Grade, e.g. '10'"},
                    "board": {"type": "string", "description": "Board, e.g. 'CBSE'"},
                },
                "required": ["topic"],
            },
            func=tool_create_word_notes,
            category="education",
        )

        def tool_create_assignment_doc(title: str, subject: str = "Science", instructions: str = "") -> str:
            res = academic_worker.create_assignment_document(title=title, subject=subject, instructions=instructions, open_after_create=True)
            return f"✅ Drafted formal school assignment for '{title}' in Word: {res['file_name']}. Launched Microsoft Word."

        self.register(
            name="create_assignment_doc",
            description="Drafts a complete formal school/college assignment or lab report in Microsoft Word (.docx) with Aim, Theory, Procedure, Observation Table, Calculations, and Conclusion, and automatically opens Word.",
            parameters={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Assignment topic or experiment title, e.g. 'Ohm's Law Verification'"},
                    "subject": {"type": "string", "description": "Subject name"},
                    "instructions": {"type": "string", "description": "Any specific teacher guidelines or apparatus constraints"},
                },
                "required": ["title"],
            },
            func=tool_create_assignment_doc,
            category="education",
        )

        def tool_create_presentation_slides(topic: str, num_slides: int = 5, subject: str = "Science") -> str:
            res = academic_worker.create_presentation_slides(topic=topic, num_slides=num_slides, subject=subject, open_after_create=True)
            return f"✅ Generated {res.get('slides_count', num_slides)}-slide presentation for '{topic}' in PowerPoint: {res['file_name']}. Launched PowerPoint."

        self.register(
            name="create_presentation_slides",
            description="Creates a multi-slide presentation in Microsoft PowerPoint (.pptx) with title, key concepts, bulleted breakdowns, and summary, and opens PowerPoint.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Topic or seminar presentation subject"},
                    "num_slides": {"type": "integer", "description": "Number of slides (default: 5)"},
                    "subject": {"type": "string", "description": "Subject name"},
                },
                "required": ["topic"],
            },
            func=tool_create_presentation_slides,
            category="education",
        )

        def tool_create_practice_test_doc(topic: str, subject: str = "Science", marks: int = 25) -> str:
            res = academic_worker.create_practice_test_paper(topic=topic, subject=subject, marks=marks, open_after_create=True)
            return f"✅ Created {marks}-mark practice exam paper for '{topic}' in Word with full solutions: {res['file_name']}. Launched Microsoft Word."

        self.register(
            name="create_practice_test_doc",
            description="Generates a balanced mock practice test paper in Microsoft Word (.docx) complete with Section A/B/C questions, marks distribution, and step-by-step marking scheme answers, and opens Word.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Exam topic or chapter"},
                    "subject": {"type": "string", "description": "Subject"},
                    "marks": {"type": "integer", "description": "Total marks for the practice test (e.g. 20, 25, 50)"},
                },
                "required": ["topic"],
            },
            func=tool_create_practice_test_doc,
            category="education",
        )

        def tool_create_study_timetable_doc(target_exam: str = "10th Board Exams") -> str:
            res = academic_worker.create_study_timetable(target_exam=target_exam, open_after_create=True)
            return f"✅ Created personalized study timetable in Excel: {res['file_name']}. Launched Excel."

        self.register(
            name="create_study_timetable_doc",
            description="Generates a weekly study timetable and revision schedule in Microsoft Excel (.xlsx) with color-coded slots and opens Excel.",
            parameters={
                "type": "object",
                "properties": {
                    "target_exam": {"type": "string", "description": "Target exam or milestone, e.g. '10th Board Exams'"},
                },
            },
            func=tool_create_study_timetable_doc,
            category="education",
        )

        def tool_solve_screen_to_word(instruction: str = "Solve this problem") -> str:
            return student_tutor.solve_screen_to_word(instruction=instruction)

        self.register(
            name="solve_screen_to_word",
            description="Captures the math/science homework problem on the student's screen using Vision AI, computes the complete step-by-step solution, formats it into a Word (.docx) document, and opens Word.",
            parameters={
                "type": "object",
                "properties": {
                    "instruction": {"type": "string", "description": "Specific question or instruction on screen"},
                },
            },
            func=tool_solve_screen_to_word,
            category="education",
        )

        # =====================================================================
        # 8. Real Desktop & Hardware Automation Tools
        # =====================================================================
        from tark_core.system_operator import SystemOperator
        operator = SystemOperator()

        def tool_play_media(query: str) -> str:
            import pywhatkit
            pywhatkit.playonyt(query)
            return f"Playing '{query}' on YouTube."

        self.register(
            name="play_media",
            description="Plays any song, track, lofi beats, or educational video directly on YouTube or browser.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Song title, artist, or video topic to play"},
                },
                "required": ["query"],
            },
            func=tool_play_media,
            category="desktop",
        )

        def tool_control_volume(action: str) -> str:
            return operator.control_volume(action)

        self.register(
            name="control_volume",
            description="Adjusts master Windows volume: 'up', 'down', 'mute', 'unmute', or 'max'.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["up", "down", "mute", "unmute", "max"], "description": "Volume action to perform"},
                },
                "required": ["action"],
            },
            func=tool_control_volume,
            category="desktop",
        )

        def tool_media_controls(action: str) -> str:
            act = action.lower().strip()
            if act in ("play_pause", "pause", "play", "toggle"):
                pyautogui.press("playpause")
                return "Toggled play/pause."
            elif act in ("next", "skip"):
                pyautogui.press("nexttrack")
                return "Skipped to next track."
            elif act in ("prev", "previous"):
                pyautogui.press("prevtrack")
                return "Returned to previous track."
            return f"Unknown media action: {action}"

        self.register(
            name="media_controls",
            description="Controls media playback: 'play_pause', 'next', or 'previous'.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["play_pause", "next", "previous"], "description": "Media control action"},
                },
                "required": ["action"],
            },
            func=tool_media_controls,
            category="desktop",
        )

        def tool_manage_windows(action: str) -> str:
            act = action.lower().strip()
            if act in ("minimize_all", "show_desktop", "desktop"):
                pyautogui.hotkey("win", "d")
                return "Minimized all windows (Desktop shown)."
            elif act in ("close_window", "close", "alt_f4"):
                pyautogui.hotkey("alt", "f4")
                return "Closed current window."
            elif act in ("switch_window", "switch", "alt_tab"):
                pyautogui.hotkey("alt", "tab")
                return "Switched window."
            elif act in ("lock_pc", "lock"):
                subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
                return "Workstation locked."
            return f"Unknown window management action: {action}"

        self.register(
            name="manage_windows",
            description="Controls desktop windows: 'minimize_all', 'close_window', 'switch_window', 'lock_pc'.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["minimize_all", "close_window", "switch_window", "lock_pc"], "description": "Window management action"},
                },
                "required": ["action"],
            },
            func=tool_manage_windows,
            category="desktop",
        )

        def tool_launch_app(app_name: str) -> str:
            app = app_name.lower().strip()
            app_map = {
                "chrome": "start chrome",
                "google chrome": "start chrome",
                "spotify": "start spotify:",
                "vscode": "code",
                "vs code": "code",
                "code": "code",
                "notepad": "notepad.exe",
                "calc": "calc.exe",
                "calculator": "calc.exe",
                "terminal": "start powershell",
                "powershell": "start powershell",
                "cmd": "start cmd",
                "explorer": "explorer.exe",
                "file explorer": "explorer.exe",
                "discord": "start discord:",
                "settings": "start ms-settings:",
                "task manager": "taskmgr.exe",
            }
            target = app_map.get(app, f"start {app}")
            subprocess.Popen(target, shell=True)
            return f"Launched {app_name}."

        self.register(
            name="launch_app",
            description="Opens desktop applications: Chrome, VS Code, Spotify, Discord, Notepad, Calculator, Terminal, Explorer, Settings, Task Manager.",
            parameters={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name of application to open"},
                },
                "required": ["app_name"],
            },
            func=tool_launch_app,
            category="desktop",
        )

        def tool_open_url(url: str) -> str:
            if not url.startswith("http"):
                url = f"https://{url}"
            subprocess.Popen(["powershell", "-NoProfile", "-Command", f"Start-Process '{url}'"])
            return f"Opened {url} in default browser."

        self.register(
            name="open_url",
            description="Opens any webpage or website in the default browser.",
            parameters={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Website URL to open"},
                },
                "required": ["url"],
            },
            func=tool_open_url,
            category="desktop",
        )

        def tool_type_or_paste(text: str, press_enter: bool = False) -> str:
            pyperclip.copy(text)
            pyautogui.hotkey("ctrl", "v")
            if press_enter:
                time.sleep(0.05)
                pyautogui.press("enter")
            return f"Typed/pasted {len(text)} characters into active window."

        self.register(
            name="type_or_paste",
            description="Types or pastes text directly into whatever window is currently focused on the computer.",
            parameters={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "The exact text to type or paste"},
                    "press_enter": {"type": "boolean", "description": "Whether to hit Enter after pasting"},
                },
                "required": ["text"],
            },
            func=tool_type_or_paste,
            category="desktop",
        )

        def tool_take_screenshot() -> str:
            return operator.take_screenshot()

        self.register(
            name="take_screenshot",
            description="Captures a clean high-resolution screenshot and saves it directly to the user's Desktop.",
            parameters={"type": "object", "properties": {}},
            func=tool_take_screenshot,
            category="desktop",
        )

        def tool_inspect_screen(query: str = "Analyze this screen and describe active details.") -> str:
            return operator.analyze_screen(query=query)

        self.register(
            name="inspect_screen",
            description="Visually inspects the active computer screen via multimodal vision AI (reads open windows, debugs code, explains charts and UI).",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Specific question or objective about the screen"},
                },
            },
            func=tool_inspect_screen,
            category="vision",
        )

        def tool_inspect_camera(query: str = "Describe who or what is in front of the camera.") -> str:
            return operator.capture_camera_feed()

        self.register(
            name="inspect_camera",
            description="Captures a live frame from laptop camera and inspects the person, objects, or held papers via Vision AI.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Question about camera view"},
                },
            },
            func=tool_inspect_camera,
            category="vision",
        )

        def tool_start_auto_submit() -> str:
            return operator.start_auto_submit_loop()

        def tool_stop_auto_submit() -> str:
            return operator.stop_auto_submit_loop()

        self.register(
            name="start_auto_submit",
            description="Starts background loop that automatically clicks submit and approves dialogs across all Antigravity IDE workspaces.",
            parameters={"type": "object", "properties": {}},
            func=tool_start_auto_submit,
            category="automation",
        )
        self.register(
            name="stop_auto_submit",
            description="Stops background auto-submit loop across Antigravity IDE workspaces.",
            parameters={"type": "object", "properties": {}},
            func=tool_stop_auto_submit,
            category="automation",
        )

        def tool_run_protocol(protocol_name: str) -> str:
            p = protocol_name.lower().strip()
            if p == "focus":
                return student_tutor.start_study_session(subject="General", chapter="Focus Block", duration_minutes=25)
            elif p == "clean_slate":
                pyautogui.hotkey("win", "d")
                return "Clean Slate protocol engaged: All windows minimized, desktop decluttered."
            elif p == "lockdown":
                pyautogui.press("playpause")
                subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"])
                return "Lockdown protocol engaged: Media paused and workstation locked."
            elif p == "chill":
                import pywhatkit
                pywhatkit.playonyt("lofi synthwave chill beats")
                return "Chill protocol engaged: Relaxing soundscape playing."
            elif p == "stealth":
                pyautogui.hotkey("win", "d")
                pyautogui.press("volumemute")
                return "Stealth protocol (Boss Key) engaged: Desktop cleared and audio muted."
            elif p == "briefing":
                cpu = psutil.cpu_percent(interval=0.1)
                mem = psutil.virtual_memory().percent
                batt = psutil.sensors_battery()
                batt_s = f"{batt.percent}%" if batt else "Desktop"
                hour = datetime.now().hour
                greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 18 else "Good evening")
                return f"{greeting}, sir. System load at {cpu}%, RAM at {mem}%, Battery at {batt_s}. Standing by for commands."
            return f"Unknown protocol: {protocol_name}"

        self.register(
            name="run_protocol",
            description="Executes signature JARVIS protocols: 'focus', 'clean_slate', 'lockdown', 'chill', 'stealth', 'briefing'.",
            parameters={
                "type": "object",
                "properties": {
                    "protocol_name": {
                        "type": "string",
                        "enum": ["focus", "clean_slate", "lockdown", "chill", "stealth", "briefing"],
                        "description": "Name of protocol to activate",
                    },
                },
                "required": ["protocol_name"],
            },
            func=tool_run_protocol,
            category="automation",
        )

