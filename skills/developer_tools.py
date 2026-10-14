"""Developer & Code Workspace Skills (PersonalJarvis Inspired).

Provides tools for Git repository inspection, code symbol searching, and project analysis.
Auto-discovered by TARK SkillRegistry.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
from typing import Any


def register_skills(registry: Any) -> None:
    """Auto-discovered hook called by SkillRegistry on startup."""

    def skill_git_status() -> str:
        """Returns clean summary of current git repository status."""
        try:
            res = subprocess.run(
                "git status -s -b",
                shell=True,
                capture_output=True,
                text=True,
                timeout=10,
                encoding="utf-8",
                errors="replace",
            )
            out = res.stdout.strip()
            return f"Git Status:\n{out}" if out else "Working directory clean."
        except Exception as e:
            return f"Git error: {e}"

    def skill_find_symbol(symbol: str, path: str = ".") -> str:
        """Finds class or function definitions across Python and JS/TS files."""
        root = Path(path).resolve()
        matches = []
        for ext in ["*.py", "*.ts", "*.js", "*.dart"]:
            for f in root.rglob(ext):
                # Skip virtual environments and node_modules
                if any(p in str(f) for p in [".venv", "node_modules", ".git", "__pycache__"]):
                    continue
                try:
                    lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
                    for idx, line in enumerate(lines):
                        if symbol.lower() in line.lower() and any(k in line for k in ["def ", "class ", "function ", "const ", "var "]):
                            matches.append(f"{f.name}:{idx+1} -> {line.strip()[:100]}")
                            if len(matches) >= 15:
                                break
                except Exception:
                    pass
                if len(matches) >= 15:
                    break
        return "\n".join(matches) if matches else f"No definitions found for symbol: '{symbol}'"

    registry.register(
        name="git_status",
        description="Returns current Git branch and modified files summary.",
        parameters={"type": "object", "properties": {}},
        func=skill_git_status,
        category="developer",
    )

    registry.register(
        name="find_symbol",
        description="Searches code files for function, class, or variable declarations matching the symbol name.",
        parameters={
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "The function or class name to search."},
                "path": {"type": "string", "description": "Root directory path to search in (default is current)."},
            },
            "required": ["symbol"],
        },
        func=skill_find_symbol,
        category="developer",
    )
