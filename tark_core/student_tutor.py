"""TARK Student Study Master & Academic Intelligence Engine.

Provides deep student mind-reading, pedagogical problem solving, screen doubt resolution,
interactive quizzing, and viral 'Study with Jarvis' focus protocols.
"""
from __future__ import annotations

import base64
from datetime import datetime
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import threading
import time
import urllib.request
from typing import Any

from PIL import ImageGrab
import pyautogui
from groq import Groq

from tark_core.config import (
    BASE_DIR,
    FALLBACK_REASONING_MODEL,
    GROQ_API_KEY,
    NVIDIA_NIM_API_KEY,
    PRIMARY_REASONING_MODEL,
    VISION_MODEL,
)
from tark_core.sound_fx import play_chime_boot, play_chime_done, play_chime_step

DB_PATH = BASE_DIR / "backend" / "tark.db"


class StudentTutor:
    """Specialist tutor engine that knows what students want and how to teach with maximum clarity."""

    def __init__(self):
        self.groq_client = Groq(api_key=GROQ_API_KEY)
        self.active_study_timer: threading.Timer | None = None
        self.study_session_active = False

    # =========================================================================
    # 1. Academic Context & Task Retrieval
    # =========================================================================
    def get_student_academic_profile(self) -> dict[str, Any]:
        """Loads student academic profile from SQLite or fallback defaults."""
        profile = {
            "name": "Shishir",
            "board": "CBSE",
            "grade": "10",
            "exam": "10th Board Exams & Foundations",
            "tutoring_style": "Step-by-step with formulas and exam tips",
            "weak_subjects": ["Physics Mechanics", "Calculus & Integrals", "Organic Chemistry"],
        }
        if DB_PATH.exists():
            try:
                conn = sqlite3.connect(str(DB_PATH), timeout=5)
                conn.row_factory = sqlite3.Row
                row = conn.execute("SELECT * FROM users WHERE username = 'shishir' LIMIT 1").fetchone()
                if row:
                    for k in ["board", "grade", "school", "exam", "tutoring_style"]:
                        if row[k]:
                            profile[k] = row[k]
                    if row["weak_subjects"]:
                        try:
                            profile["weak_subjects"] = json.loads(row["weak_subjects"])
                        except Exception:
                            pass
                conn.close()
            except Exception:
                pass
        return profile

    def get_active_study_tasks(self) -> list[dict[str, Any]]:
        """Retrieves active study roadmap tasks and next upcoming milestones."""
        tasks = []
        if DB_PATH.exists():
            try:
                conn = sqlite3.connect(str(DB_PATH), timeout=5)
                conn.row_factory = sqlite3.Row
                # Check if study_tasks table exists
                tbl_check = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='study_tasks'").fetchone()
                if tbl_check:
                    rows = conn.execute("SELECT id, title, track, status, milestones FROM study_tasks WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5").fetchall()
                    for r in rows:
                        ms = []
                        try:
                            ms = json.loads(r["milestones"])
                        except Exception:
                            pass
                        uncompleted = [m.get("title") for m in ms if not m.get("completed")]
                        tasks.append({
                            "id": r["id"],
                            "title": r["title"],
                            "track": r["track"],
                            "next_milestone": uncompleted[0] if uncompleted else "All milestones completed",
                            "remaining_count": len(uncompleted),
                        })
                conn.close()
            except Exception:
                pass
        return tasks

    # =========================================================================
    # 2. Pedagogical Problem & Doubt Solver (4-Tier Pedagogical Structure)
    # =========================================================================
    def solve_doubt(
        self,
        question: str,
        subject: str = "Science",
        grade: str = "10",
        board: str = "CBSE",
    ) -> str:
        """Solves student homework or exam questions using the 4-tier pedagogical answer structure."""
        prof = self.get_student_academic_profile()
        board = board or prof.get("board", "CBSE")
        grade = grade or prof.get("grade", "10")

        prompt = f"""You are Tark's Master Student Tutor. A Class {grade} ({board}) student has asked:
"{question}"

Answer using the following high-impact 4-tier structure:
1. 🎯 **Direct Core Answer & Formula**:
   State the exact answer / theorem / formula immediately in 1-2 lines.
2. 📐 **Step-by-Step Derivation / Method**:
   Clearly number each step: Given values, formula applied, mathematical substitution, and final result with proper SI units.
3. 💡 **Intuitive Analogy (Real-World Understanding)**:
   Explain the intuition using a simple everyday analogy that an Indian student easily visualizes.
4. ⚠️ **Exam Pro-Tip & Common Pitfall**:
   One critical trick to score full marks and the exact mistake students commonly make in board exams.

Keep formatting clean with clear bold headings and LaTeX math ($...$). Be encouraging, precise, and authoritative."""

        try:
            resp = self.groq_client.chat.completions.create(
                model=PRIMARY_REASONING_MODEL,
                messages=[
                    {"role": "system", "content": "You are Tark Master Tutor: precise, pedagogical, and inspiring."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=900,
            )
            return resp.choices[0].message.content or "Could not generate solution."
        except Exception:
            resp = self.groq_client.chat.completions.create(
                model=FALLBACK_REASONING_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=900,
            )
            return resp.choices[0].message.content or "Could not generate solution."

    # =========================================================================
    # 3. Screen Doubt & Diagram Explainer (Multimodal Ocular Sight)
    # =========================================================================
    def explain_screen_problem(self, instruction: str = "Solve and explain the problem shown on the screen.") -> str:
        """Captures active screen, reads the question/diagram via Vision AI, and outputs a complete solution."""
        try:
            screenshot = ImageGrab.grab()
            buf = io.BytesIO()
            screenshot.save(buf, format="JPEG", quality=85)
            b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

            url = "https://integrate.api.nvidia.com/v1/chat/completions"
            payload = {
                "model": VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Read the academic question, code error, or science diagram on this screen carefully. {instruction}\nTranscribe the exact problem statement, and provide the complete step-by-step solution with final answer and formula.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"},
                            },
                        ],
                    }
                ],
                "max_tokens": 800,
                "temperature": 0.2,
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {NVIDIA_NIM_API_KEY}",
                },
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                solution = data["choices"][0]["message"]["content"].strip()
                play_chime_done()
                return solution
        except Exception as e:
            return f"Screen vision analysis encountered an error: {e}"

    # =========================================================================
    # 4. Interactive Quizzing & Rapid Recall
    # =========================================================================
    def generate_quiz(self, topic: str, count: int = 3) -> str:
        """Generates a rapid conceptual flashcard quiz with answers for instant study recall."""
        prof = self.get_student_academic_profile()
        prompt = f"""Generate a high-yield {count}-question conceptual quiz on '{topic}' suitable for Class {prof.get('grade', '10')} {prof.get('board', 'CBSE')}.
Format each question as:
❓ **Question N**: <Question text>
💡 **Hint**: <1-line hint>
✅ **Answer & Key Concept**: <Exact answer + 1-sentence explanation>

Make questions test fundamental conceptual understanding rather than pure rote memorization."""

        resp = self.groq_client.chat.completions.create(
            model=PRIMARY_REASONING_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
        )
        return resp.choices[0].message.content or "Could not generate quiz."

    # =========================================================================
    # 5. Viral 'Study with Jarvis' Focus Protocol
    # =========================================================================
    def start_study_session(
        self,
        subject: str = "Physics",
        chapter: str = "General",
        duration_minutes: int = 25,
    ) -> str:
        """Engages the viral Jarvis Study Protocol:
        1. Minimizes distractions
        2. Sets study Pomodoro timer
        3. Queues study lofi / focus soundtrack
        4. Provides crisp syllabus milestone summary
        """
        self.study_session_active = True

        # 1. Minimize background clutter
        try:
            pyautogui.hotkey("win", "d")
        except Exception:
            pass

        # 2. Queue study music on YouTube
        try:
            import pywhatkit
            pywhatkit.playonyt("lofi hip hop radio beats to study to")
        except Exception:
            pass

        # 3. Schedule completion chime
        if self.active_study_timer:
            self.active_study_timer.cancel()

        def _on_session_complete():
            self.study_session_active = False
            play_chime_done()
            print(f"\n\n⏰ \033[92m[STUDY SESSION COMPLETE]:\033[0m {duration_minutes} minutes completed for {subject}: {chapter}!\n")

        self.active_study_timer = threading.Timer(duration_minutes * 60, _on_session_complete)
        self.active_study_timer.daemon = True
        self.active_study_timer.start()

        play_chime_boot()

        return (
            f"🎯 **Study Protocol Engaged for {subject} — {chapter}**\n\n"
            f"- ⏱️ **Timer**: {duration_minutes} minutes Pomodoro countdown active\n"
            f"- 🎵 **Audio**: Focus study soundscape queued\n"
            f"- 🛡️ **Workspace**: Distractions minimized; desktop primed for deep focus\n\n"
            f"Ready to conquer this session, sir. Ask any doubt or say 'what is on my screen' whenever you hit a barrier."
        )

    def solve_screen_to_word(self, instruction: str = "Solve this problem") -> str:
        """Captures problem from screen, solves it, and exports formatted solution into Word."""
        from tark_core.academic_worker import academic_worker, _launch_file, VAULT_DIR
        from docx import Document
        from docx.shared import Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        sol_text = self.explain_screen_problem(instruction)

        doc = Document()
        hp = doc.add_paragraph()
        hr = hp.add_run("HOMEWORK PROBLEM SOLUTION")
        hr.font.size = Pt(18)
        hr.font.bold = True
        hr.font.color.rgb = RGBColor(16, 44, 87)
        hp.alignment = WD_ALIGN_PARAGRAPH.CENTER

        mp = doc.add_paragraph()
        mr = mp.add_run(f"Captured from Screen | Student: Shishir | {datetime.now().strftime('%d %B %Y, %I:%M %p')}")
        mr.font.size = Pt(10)
        mr.font.italic = True
        mp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph("―" * 40)

        lines = sol_text.split("\n")
        for line in lines:
            if line.startswith("#"):
                p = doc.add_paragraph()
                r = p.add_run(line.lstrip("#").strip())
                r.font.size = Pt(13)
                r.font.bold = True
                r.font.color.rgb = RGBColor(30, 58, 138)
            elif line.startswith(("-", "*", "•")):
                p = doc.add_paragraph(style="List Bullet")
                p.add_run(line.lstrip("-*•").strip())
            else:
                p = doc.add_paragraph()
                p.add_run(line)

        filename = f"Screen_Solution_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        out_path = VAULT_DIR / filename
        doc.save(str(out_path))
        _launch_file(out_path)

        return (
            f"✅ **Problem Solved & Exported to Word**\n\n"
            f"- **File**: `{filename}`\n"
            f"- **Location**: `{out_path}`\n\n"
            f"Microsoft Word has been launched with the complete solution, sir."
        )

    def stop_study_session(self) -> str:
        """Ends active study session early."""
        if self.active_study_timer:
            self.active_study_timer.cancel()
            self.active_study_timer = None
        self.study_session_active = False
        play_chime_done()
        return "Study session concluded. Great effort on your study block, sir."


student_tutor = StudentTutor()
