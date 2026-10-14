"""3-Tier Persistent Memory & Sessionless Goal Engine (Comma + OpenClaw Inspired).

Tiers:
1. Short-Term Working Memory (Session context, active turns)
2. Long-Term Semantic Memory (tark_memory.json: user facts, identity, preferences)
3. Sessionless Goal Store (tark_goals.json: persistent multi-stage task DAGs, checkpoints, crash-resilience)
"""
from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
from typing import Any

from tark_core.config import GOALS_FILE, MEMORY_FILE


class MemoryManager:
    """Manages local-first semantic memory and sessionless goal checkpoints."""

    def __init__(self, memory_file: Path = MEMORY_FILE, goals_file: Path = GOALS_FILE):
        self.memory_file = memory_file
        self.goals_file = goals_file
        self._ensure_files()

    def _ensure_files(self):
        if not self.memory_file.exists():
            default_mem = {
                "user_name": "Shishir",
                "assistant_name": "TARK",
                "notes": [
                    {
                        "content": "User prefers concise, direct action-oriented responses without fluff.",
                        "timestamp": datetime.now().isoformat(),
                    }
                ],
                "preferences": {
                    "voice_speed": "+15%",
                    "auto_submit": True,
                    "default_editor": "Antigravity",
                },
            }
            self.memory_file.write_text(json.dumps(default_mem, indent=2), encoding="utf-8")

        if not self.goals_file.exists():
            self.goals_file.write_text(json.dumps({"goals": []}, indent=2), encoding="utf-8")

    # --- Tier 2: Semantic Memory ---
    def load_memory(self) -> dict[str, Any]:
        try:
            return json.loads(self.memory_file.read_text(encoding="utf-8"))
        except Exception:
            return {"user_name": "Shishir", "notes": [], "preferences": {}}

    def save_memory(self, memory_data: dict[str, Any]) -> None:
        try:
            self.memory_file.write_text(json.dumps(memory_data, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[MEMORY ERROR]: Could not save semantic memory: {e}")

    def add_note(self, content: str) -> str:
        mem = self.load_memory()
        notes = mem.setdefault("notes", [])
        notes.append({"content": content, "timestamp": datetime.now().isoformat()})
        # Keep last 50 notes
        if len(notes) > 50:
            mem["notes"] = notes[-50:]
        self.save_memory(mem)
        return f"Successfully saved to long-term memory: '{content}'"

    def recall_notes(self, query: str = "") -> list[dict[str, Any]]:
        mem = self.load_memory()
        notes = mem.get("notes", [])
        if not query:
            return notes[-10:]
        q = query.lower()
        return [n for n in notes if q in n.get("content", "").lower()]

    # --- Tier 3: Sessionless Goal Store (Comma-style) ---
    def load_goals(self) -> list[dict[str, Any]]:
        try:
            data = json.loads(self.goals_file.read_text(encoding="utf-8"))
            return data.get("goals", [])
        except Exception:
            return []

    def save_goals(self, goals: list[dict[str, Any]]) -> None:
        try:
            self.goals_file.write_text(json.dumps({"goals": goals}, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[GOALS ERROR]: Could not save goals store: {e}")

    def create_goal(self, goal_title: str, description: str, milestones: list[str]) -> dict[str, Any]:
        """Creates and persists a new long-running autonomous goal with checkpoint tracking."""
        goals = self.load_goals()
        goal_id = f"goal_{int(datetime.now().timestamp())}_{len(goals)+1}"
        new_goal = {
            "id": goal_id,
            "title": goal_title,
            "description": description,
            "status": "IN_PROGRESS",  # IN_PROGRESS, PAUSED, COMPLETED, FAILED
            "stage": "PLANNING",      # PLANNING, EXECUTING, AUDITING, FINISHED
            "current_step_index": 0,
            "milestones": [
                {"index": i, "title": m, "status": "PENDING", "result": None}
                for i, m in enumerate(milestones)
            ],
            "checkpoints": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        goals.append(new_goal)
        self.save_goals(goals)
        return new_goal

    def update_goal_checkpoint(
        self,
        goal_id: str,
        stage: str,
        step_index: int,
        checkpoint_note: str,
        status: str = "IN_PROGRESS"
    ) -> None:
        """Saves intermediate execution progress to survive reboots or interruptions."""
        goals = self.load_goals()
        for g in goals:
            if g["id"] == goal_id:
                g["stage"] = stage
                g["current_step_index"] = step_index
                g["status"] = status
                g["updated_at"] = datetime.now().isoformat()
                g.setdefault("checkpoints", []).append({
                    "timestamp": datetime.now().isoformat(),
                    "step_index": step_index,
                    "stage": stage,
                    "note": checkpoint_note
                })
                break
        self.save_goals(goals)

    def mark_milestone_done(self, goal_id: str, milestone_index: int, result: str) -> None:
        goals = self.load_goals()
        for g in goals:
            if g["id"] == goal_id:
                if 0 <= milestone_index < len(g["milestones"]):
                    g["milestones"][milestone_index]["status"] = "COMPLETED"
                    g["milestones"][milestone_index]["result"] = result
                    g["updated_at"] = datetime.now().isoformat()
                # If all milestones are completed, mark goal completed
                if all(m["status"] == "COMPLETED" for m in g["milestones"]):
                    g["status"] = "COMPLETED"
                    g["stage"] = "FINISHED"
                break
        self.save_goals(goals)

    def get_active_goal(self) -> dict[str, Any] | None:
        """Finds any active unfinished goal to resume on startup."""
        goals = self.load_goals()
        for g in reversed(goals):
            if g.get("status") == "IN_PROGRESS":
                return g
        return None
