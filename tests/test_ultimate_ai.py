"""Comprehensive Integration Tests for TARK Ultimate Omni-Agent Engine.
Tests all synthesized features from PersonalJarvis, OpenClaw, Comma, and Mark-XL.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import time
import unittest
import urllib.request

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tark_core import (
    ChannelGatewayServer,
    MasterOrchestrator,
    MemoryManager,
    SkillRegistry,
    SystemOperator,
)


class TestUltimateAI(unittest.TestCase):

    def setUp(self):
        self.temp_mem_file = Path("scratch/test_memory.json")
        self.temp_goals_file = Path("scratch/test_goals.json")
        self.mem_mgr = MemoryManager(memory_file=self.temp_mem_file, goals_file=self.temp_goals_file)
        self.skill_reg = SkillRegistry()
        self.system_op = SystemOperator()
        self.orchestrator = MasterOrchestrator(self.mem_mgr, self.skill_reg, self.system_op)

    def tearDown(self):
        if self.temp_mem_file.exists():
            self.temp_mem_file.unlink()
        if self.temp_goals_file.exists():
            self.temp_goals_file.unlink()

    # 1. Test Comma-style Sessionless Memory & Goals
    def test_sessionless_memory_and_goals(self):
        # Semantic note
        msg = self.mem_mgr.add_note("Shishir prefers dark mode and fast answers.")
        self.assertIn("Successfully saved", msg)
        notes = self.mem_mgr.recall_notes("dark mode")
        self.assertTrue(len(notes) >= 1)

        # Goal creation & checkpointing
        goal = self.mem_mgr.create_goal(
            goal_title="Build Ultimate AI",
            description="Combine PersonalJarvis, OpenClaw, Comma, and Mark-XL",
            milestones=["Setup architecture", "Verify skills", "Deploy gateway"],
        )
        self.assertEqual(goal["status"], "IN_PROGRESS")
        self.assertEqual(len(goal["milestones"]), 3)

        # Checkpoint update
        self.mem_mgr.update_goal_checkpoint(goal["id"], "EXECUTING", 1, "Milestone 1 finished.")
        active = self.mem_mgr.get_active_goal()
        self.assertIsNotNone(active)
        self.assertEqual(active["id"], goal["id"])
        self.assertEqual(len(active["checkpoints"]), 1)

        # Milestone completion
        self.mem_mgr.mark_milestone_done(goal["id"], 0, "Architecture ready")
        self.mem_mgr.mark_milestone_done(goal["id"], 1, "Skills verified")
        self.mem_mgr.mark_milestone_done(goal["id"], 2, "Gateway deployed")
        completed_goal = self.mem_mgr.load_goals()[-1]
        self.assertEqual(completed_goal["status"], "COMPLETED")
        self.assertEqual(completed_goal["stage"], "FINISHED")

    # 2. Test OpenClaw Dynamic Skills Auto-Discovery
    def test_skills_auto_discovery(self):
        tools = self.skill_reg.skills
        # Check builtins
        self.assertIn("run_command", tools)
        self.assertIn("read_file", tools)
        self.assertIn("write_file", tools)
        self.assertIn("search_web", tools)
        self.assertIn("get_system_status", tools)

        # Check auto-discovered skills from skills/ folder
        self.assertIn("git_status", tools)
        self.assertIn("find_symbol", tools)
        self.assertIn("lock_workstation", tools)
        self.assertIn("minimize_all_windows", tools)
        self.assertIn("launch_app", tools)

        # Execute dynamic skill
        git_res = self.skill_reg.execute_tool("git_status", {})
        self.assertTrue("Git" in git_res or "fatal" in git_res or "clean" in git_res)

        # Test tool definitions schema
        schemas = self.skill_reg.get_tool_definitions()
        self.assertTrue(len(schemas) >= 10)
        self.assertTrue(all("function" in s for s in schemas))

    # 3. Test OpenClaw Gateway Server (REST API)
    def test_gateway_server_rest_api(self):
        test_port = 8998
        server = ChannelGatewayServer(
            chat_handler=lambda q: ("Affirmative sir.", f"Response to: {q}"),
            goal_handler=lambda p: {"status": "LAUNCHED", "prompt": p},
            goal_status_handler=lambda: {"title": "Test Goal", "status": "IN_PROGRESS"},
            autosubmit_handler=lambda en: f"Autosubmit set to {en}",
            port=test_port,
        )
        server.start()
        time.sleep(0.5)

        try:
            # Test GET /health
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/health") as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(data["status"], "ONLINE")
                self.assertEqual(data["assistant"], "TARK ULTIMATE")

            # Test GET /v1/goal/status
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/v1/goal/status") as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(data["active_goal"]["title"], "Test Goal")

            # Test POST /v1/chat
            req = urllib.request.Request(
                f"http://127.0.0.1:{test_port}/v1/chat",
                data=json.dumps({"query": "Hello TARK"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(data["spoken"], "Affirmative sir.")
        finally:
            server.stop()


if __name__ == "__main__":
    unittest.main()
