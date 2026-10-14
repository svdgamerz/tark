"""Student Long-Term & Working Memory Engine for Tark.

Captures, persists, and recalls student facts, preferences, context, and academic
milestones across turns and conversations. When a student mentions context in one
prompt, Tark retains it permanently and weaves it into future turns so the AI
never forgets what the student shared.
"""
from __future__ import annotations

import logging
import re
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from app.config.db_path import get_db_path

logger = logging.getLogger("tark.memory")


class StudentMemoryStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = str(db_path or get_db_path("tark.db"))
        self._mem_conn = sqlite3.connect(":memory:") if self.db_path == ":memory:" else None
        self._init_db()

    @contextmanager
    def _conn(self):
        if self._mem_conn is not None:
            c = self._mem_conn
            c.row_factory = sqlite3.Row
            try:
                yield c
                c.commit()
            except Exception:
                c.rollback()
                raise
        else:
            c = sqlite3.connect(self.db_path, timeout=10)
            c.row_factory = sqlite3.Row
            try:
                yield c
                c.commit()
            finally:
                c.close()

    def _init_db(self) -> None:
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS student_memories (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_key       TEXT NOT NULL,
                    category       TEXT NOT NULL,
                    key            TEXT NOT NULL,
                    value          TEXT NOT NULL,
                    confidence     REAL NOT NULL DEFAULT 1.0,
                    source_message TEXT,
                    created_at     REAL NOT NULL,
                    updated_at     REAL NOT NULL,
                    UNIQUE(user_key, category, key)
                )"""
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_mem_user "
                "ON student_memories(user_key, category)"
            )

    def remember(
        self,
        user_key: str,
        category: str,
        key: str,
        value: str,
        source_message: str = "",
        confidence: float = 1.0,
    ) -> None:
        """Upsert a student memory fact."""
        uk = (user_key or "guest").strip().lower()
        cat = category.strip().lower()
        k = key.strip().lower()
        val = value.strip()
        if not uk or not cat or not k or not val:
            return

        now = time.time()
        try:
            with self._conn() as c:
                c.execute(
                    """INSERT INTO student_memories
                           (user_key, category, key, value, confidence, source_message, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(user_key, category, key) DO UPDATE SET
                           value = excluded.value,
                           confidence = excluded.confidence,
                           source_message = excluded.source_message,
                           updated_at = excluded.updated_at""",
                    (uk, cat, k, val, confidence, source_message[:200], now, now),
                )
            logger.info(f"StudentMemory stored for {uk}: [{cat}] {k} -> {val}")
        except Exception as e:
            logger.warning(f"Failed to record student memory: {e}")

    def get_all(self, user_key: str) -> list[dict[str, Any]]:
        """Retrieve all memories for a student."""
        uk = (user_key or "guest").strip().lower()
        try:
            with self._conn() as c:
                rows = c.execute(
                    "SELECT category, key, value, updated_at FROM student_memories "
                    "WHERE user_key = ? ORDER BY updated_at DESC",
                    (uk,),
                ).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            logger.warning(f"Failed to read student memories: {e}")
            return []

    def get(self, user_key: str, category: str, key: str) -> str | None:
        """Get a specific memory value."""
        uk = (user_key or "guest").strip().lower()
        cat = category.strip().lower()
        k = key.strip().lower()
        try:
            with self._conn() as c:
                row = c.execute(
                    "SELECT value FROM student_memories WHERE user_key = ? AND category = ? AND key = ?",
                    (uk, cat, k),
                ).fetchone()
                return row["value"] if row else None
        except Exception:
            return None

    def extract_and_save(self, user_key: str, text: str) -> list[tuple[str, str, str]]:
        """Extract explicit student facts and preferences from student text and save them.
        
        Returns:
            List of (category, key, value) tuples newly stored.
        """
        if not text or not text.strip():
            return []

        cleaned = text.strip()
        saved: list[tuple[str, str, str]] = []

        # 1. Student Name
        name_match = re.search(
            r"\b(?:my name is|i am|i'm|call me|myself)\s+([A-Za-z]{2,20})\b",
            cleaned,
            re.I,
        )
        if name_match:
            candidate = name_match.group(1).strip().capitalize()
            # Exclude common adjectives, prepositions, or non-names
            non_names = {
                "fine", "good", "ready", "happy", "tired", "back", "studying",
                "trying", "preparing", "here", "just", "confused", "stuck",
                "student", "learning", "in", "from", "very", "also", "now", "not"
            }
            if candidate.lower() not in non_names:
                self.remember(user_key, "identity", "name", candidate, source_message=cleaned)
                saved.append(("identity", "name", candidate))

        # 2. Target Exam
        exam_match = re.search(
            r"\b(?:preparing for|target is|aiming for|studying for|target exam(?: is)?|exam is|appearing for)\s+([A-Za-z0-9\s.+_-]{2,30}?)(?:[.,;!]|\s+and\b|\s+exam|\s+boards|\s+next|\s+in|\n|$)",
            cleaned,
            re.I,
        )
        if exam_match:
            ex = exam_match.group(1).strip()
            if len(ex) >= 2 and not ex.lower().startswith("the "):
                self.remember(user_key, "academic", "target_exam", ex, source_message=cleaned)
                saved.append(("academic", "target_exam", ex))

        # 3. School / Institution
        school_match = re.search(
            r"\b(?:my school is|i (?:study at|go to|attend))\s+([A-Za-z0-9\s.,'&-]{3,60}?)(?:[.,;!]|\s+and\s+(?:i\s+am|i'm|my|i\s+study)|\n|$)",
            cleaned,
            re.I,
        )
        if school_match:
            sch = school_match.group(1).strip()
            if len(sch) >= 3 and sch.lower() not in ("home", "here", "school", "college"):
                self.remember(user_key, "academic", "school", sch, source_message=cleaned)
                saved.append(("academic", "school", sch))

        # 4. Class / Grade
        grade_match = re.search(
            r"\b(?:in\s+(?:class|grade)\s*(\d{1,2}|[A-Za-z]+)|(?:class|grade)\s*(\d{1,2})\s*student)\b",
            cleaned,
            re.I,
        )
        if grade_match:
            gr = (grade_match.group(1) or grade_match.group(2)).strip()
            self.remember(user_key, "academic", "grade", f"Class {gr}", source_message=cleaned)
            saved.append(("academic", "grade", f"Class {gr}"))

        # 5. Education Board
        board_match = re.search(
            r"\b(CBSE|ICSE|ISC|State Board|Maharashtra Board|Balbharati|Cambridge|IGCSE|IB)\b",
            cleaned,
            re.I,
        )
        if board_match:
            bd = board_match.group(1).strip()
            self.remember(user_key, "academic", "board", bd.upper(), source_message=cleaned)
            saved.append(("academic", "board", bd.upper()))

        # 6. Weak Subject / Topic
        weak_match = re.search(
            r"\b(?:weak (?:in|at|area|topic|chapter|subject|unit)|struggle with|having trouble with|hard for me to understand|difficult for me is|struggling with|my weak (?:area|topic|subject|chapter|unit) is)\s+([A-Za-z0-9\s,._-]{3,60}?)(?:[.,;!]|\s+and\b|\n|$)",
            cleaned,
            re.I,
        )
        if weak_match:
            wk = weak_match.group(1).strip()
            if len(wk) >= 3:
                self.remember(user_key, "academic", "weak_topic", wk, source_message=cleaned)
                saved.append(("academic", "weak_topic", wk))

        # 7. Favorite Subject / Strength
        fav_match = re.search(
            r"\b(?:my favorite (?:subject|topic|chapter) is|i love|i'm good at|my strength is)\s+([A-Za-z0-9\s,._-]{3,60}?)(?:[.,;!]|\s+and\b|\n|$)",
            cleaned,
            re.I,
        )
        if fav_match:
            fv = fav_match.group(1).strip()
            if len(fv) >= 3 and not fv.lower().startswith("it"):
                self.remember(user_key, "academic", "favorite_topic", fv, source_message=cleaned)
                saved.append(("academic", "favorite_topic", fv))

        # 8. Language Preference
        lang_match = re.search(
            r"\b(?:explain in (hinglish|hindi|marathi|english)|talk to me in (hinglish|hindi|marathi|english))\b",
            cleaned,
            re.I,
        )
        if lang_match:
            lg = (lang_match.group(1) or lang_match.group(2)).capitalize()
            self.remember(user_key, "preference", "language", lg, source_message=cleaned)
            saved.append(("preference", "language", lg))

        # 9. Upcoming Exam / Test / Deadline
        test_match = re.search(
            r"\b(?:i have a (?:test|exam|quiz|assessment)|my test is|exam is)\s+(?:on|this|tomorrow|next)\s+([A-Za-z0-9\s,._-]{3,50}?)(?:[.,;!]|\n|$)",
            cleaned,
            re.I,
        )
        if test_match:
            tm = test_match.group(1).strip()
            self.remember(user_key, "academic", "upcoming_test", f"Test: {tm}", source_message=cleaned)
            saved.append(("academic", "upcoming_test", f"Test: {tm}"))

        # 10. General explicit context / reminder note
        explicit_remind = re.search(
            r"\b(?:remember that|as i told you|as i mentioned|keep in mind that|note that)\s+([A-Za-z0-9\s,._-]{5,80}?)(?:[.,;!]|\n|$)",
            cleaned,
            re.I,
        )
        if explicit_remind:
            rem = explicit_remind.group(1).strip()
            if len(rem) >= 5:
                self.remember(user_key, "context", "student_note", rem, source_message=cleaned)
                saved.append(("context", "student_note", rem))

        return saved

    def format_memory_context(
        self,
        user_key: str,
        profile_fallback: dict[str, Any] | None = None,
    ) -> str:
        """Format active memories and context for the system prompt."""
        mems = self.get_all(user_key)
        mem_map: dict[str, str] = {f"{m['category']}:{m['key']}": m['value'] for m in mems}

        # Seed with fallback profile if not explicitly overridden in memories
        pf = profile_fallback or {}
        if pf.get("board") and "academic:board" not in mem_map:
            mem_map["academic:board"] = str(pf["board"])
        if pf.get("grade") and "academic:grade" not in mem_map:
            mem_map["academic:grade"] = f"Class {pf['grade']}"
        if pf.get("school") and "academic:school" not in mem_map:
            mem_map["academic:school"] = str(pf["school"])
        if pf.get("exam") and "academic:target_exam" not in mem_map:
            mem_map["academic:target_exam"] = str(pf["exam"])
        if pf.get("weak_subjects") and "academic:weak_topic" not in mem_map:
            ws = pf["weak_subjects"]
            if isinstance(ws, list):
                mem_map["academic:weak_topic"] = ", ".join(ws)
            elif isinstance(ws, str) and ws.strip():
                mem_map["academic:weak_topic"] = ws

        if not mem_map:
            return ""

        lines = [
            "================================================================================",
            "STUDENT PERMANENT CONTEXT & ACTIVE MEMORY (WHAT YOU REMEMBER ABOUT THIS LEARNER):",
            "You have interacted with this student before and remember the following verified context:",
        ]

        if "identity:name" in mem_map:
            lines.append(f"• Student Name: {mem_map['identity:name']}")
        if "academic:board" in mem_map:
            lines.append(f"• Curriculum Board: {mem_map['academic:board']}")
        if "academic:grade" in mem_map:
            lines.append(f"• Grade / Class: {mem_map['academic:grade']}")
        if "academic:target_exam" in mem_map:
            lines.append(f"• Target Exam / Milestone: {mem_map['academic:target_exam']}")
        if "academic:school" in mem_map:
            lines.append(f"• School: {mem_map['academic:school']}")
        if "academic:weak_topic" in mem_map:
            lines.append(f"• Student's Weak Areas (needs extra guidance): {mem_map['academic:weak_topic']}")
        if "academic:favorite_topic" in mem_map:
            lines.append(f"• Favorite Subjects / Strengths: {mem_map['academic:favorite_topic']}")
        if "academic:upcoming_test" in mem_map:
            lines.append(f"• Upcoming Test / Deadline: {mem_map['academic:upcoming_test']}")
        if "preference:language" in mem_map:
            lines.append(f"• Preferred Language: {mem_map['preference:language']}")
        if "context:student_note" in mem_map:
            lines.append(f"• Specific Student Note: {mem_map['context:student_note']}")

        # Other custom keys
        for k, v in mem_map.items():
            if k not in (
                "identity:name", "academic:board", "academic:grade", "academic:target_exam",
                "academic:school", "academic:weak_topic", "academic:favorite_topic",
                "academic:upcoming_test", "preference:language", "context:student_note"
            ):
                label = k.split(":", 1)[-1].replace("_", " ").title()
                lines.append(f"• {label}: {v}")

        lines.extend([
            "",
            "CRITICAL CONVERSATIONAL MEMORY DIRECTIVES:",
            "1. When the student asks 'Do you remember...', 'What did I say earlier...', 'What is my name...', or tests your recall, ALWAYS warmly, immediately, and accurately confirm these remembered details without hesitation!",
            "2. Seamlessly anchor your explanations, question difficulty, and examples to their target exam, board, and weak areas without making them repeat themselves.",
            "3. NEVER contradict what they told you or pretend you have no memory of what they shared.",
            "================================================================================",
        ])

        return "\n".join(lines)


# Global singleton instance
student_memory = StudentMemoryStore()
