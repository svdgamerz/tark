"""System & Desktop Control Skills (OpenClaw + PersonalJarvis Inspired).

Provides tools for Windows system controls, locking screen, minimizing windows, and launching applications.
Auto-discovered by TARK SkillRegistry.
"""
from __future__ import annotations

import ctypes
import os
import subprocess
from typing import Any

import pyautogui


def register_skills(registry: Any) -> None:
    """Auto-discovered hook called by SkillRegistry on startup."""

    def skill_lock_workstation() -> str:
        """Locks the Windows desktop."""
        try:
            ctypes.windll.user32.LockWorkStation()
            return "Windows workstation locked."
        except Exception as e:
            return f"Error locking workstation: {e}"

    def skill_minimize_windows() -> str:
        """Minimizes all open windows to show desktop."""
        try:
            pyautogui.hotkey("win", "d")
            return "All windows minimized."
        except Exception as e:
            return f"Error minimizing windows: {e}"

    def skill_launch_app(app_name: str) -> str:
        """Launches a common desktop application."""
        app = app_name.lower().strip()
        app_map = {
            "notepad": "notepad.exe",
            "calc": "calc.exe",
            "calculator": "calc.exe",
            "chrome": "start chrome",
            "code": "code",
            "vscode": "code",
            "vs code": "code",
            "spotify": "start spotify:",
            "terminal": "start wt",
            "powershell": "start powershell",
            "explorer": "explorer.exe",
        }
        cmd = app_map.get(app)
        if cmd:
            subprocess.Popen(cmd, shell=True)
            return f"Launched application: {app}"
        else:
            # Try running command directly
            subprocess.Popen(f"start {app}", shell=True)
            return f"Dispatched launch command for: {app}"

    registry.register(
        name="lock_workstation",
        description="Locks the Windows workstation / computer.",
        parameters={"type": "object", "properties": {}},
        func=skill_lock_workstation,
        category="system",
    )

    registry.register(
        name="minimize_all_windows",
        description="Minimizes all open desktop windows.",
        parameters={"type": "object", "properties": {}},
        func=skill_minimize_windows,
        category="system",
    )

    registry.register(
        name="launch_app",
        description="Launches a desktop application like Notepad, Calculator, Chrome, VS Code, Spotify, or Explorer.",
        parameters={
            "type": "object",
            "properties": {"app_name": {"type": "string", "description": "The name of the application to launch."}},
            "required": ["app_name"],
        },
        func=skill_launch_app,
        category="system",
    )
