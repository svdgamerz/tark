"""Database path resolution with OneDrive and permissions fallback.

On Windows, when a project is stored inside a OneDrive synced folder, SQLite
database locks are blocked by OneDrive's filesystem filter drivers, causing
`sqlite3.OperationalError: unable to open database file`.

This module provides a robust resolver `get_db_path(name)` that:
1. Uses `TARK_DATA_DIR` environment variable if set.
2. Checks if local `backend/data/` or `backend/` supports SQLite read/write.
3. Automatically falls back to user data directory (`~/.tark/` or `%LOCALAPPDATA%/tark`),
   seamlessly migrating existing database files on initial run.
"""
from __future__ import annotations

import logging
import os
import shutil
import sqlite3
from pathlib import Path

logger = logging.getLogger("tark.db")

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _test_sqlite_writable(directory: Path) -> bool:
    """Test if SQLite can open and write a temporary table in directory."""
    test_db = directory / ".sqlite_test.db"
    try:
        directory.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(test_db), timeout=1)
        conn.execute("CREATE TABLE IF NOT EXISTS _test_lock (id INT)")
        conn.execute("INSERT INTO _test_lock VALUES (1)")
        conn.commit()
        conn.close()
        try:
            test_db.unlink(missing_ok=True)
        except Exception:
            pass
        return True
    except Exception:
        try:
            test_db.unlink(missing_ok=True)
        except Exception:
            pass
        return False


def _resolve_data_dir() -> Path:
    # 1. Explicit env var
    env_dir = os.environ.get("TARK_DATA_DIR")
    if env_dir:
        p = Path(env_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    # 2. Try local backend directory
    local_data = BACKEND_DIR / "data"
    if _test_sqlite_writable(local_data):
        return local_data

    # 3. Fallback to ~/.tark or %LOCALAPPDATA%/tark
    fallback_dir = Path.home() / ".tark"
    try:
        fallback_dir.mkdir(parents=True, exist_ok=True)
        if _test_sqlite_writable(fallback_dir):
            return fallback_dir
    except Exception:
        pass

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        app_dir = Path(local_app_data) / "tark"
        app_dir.mkdir(parents=True, exist_ok=True)
        return app_dir

    return BACKEND_DIR


_DATA_DIR: Path | None = None


def get_data_dir() -> Path:
    global _DATA_DIR
    if _DATA_DIR is None:
        _DATA_DIR = _resolve_data_dir()
        logger.info(f"Using database directory: {_DATA_DIR}")
    return _DATA_DIR


def get_db_path(db_name: str) -> Path:
    """Return the absolute path to a SQLite database, auto-migrating if needed."""
    target_dir = get_data_dir()
    target_path = target_dir / db_name

    # If target doesn't exist, try to copy initial db from backend dir if present
    if not target_path.exists():
        for candidate_src in [BACKEND_DIR / db_name, BACKEND_DIR / "data" / db_name]:
            if candidate_src.exists() and candidate_src.resolve() != target_path.resolve():
                try:
                    shutil.copy2(candidate_src, target_path)
                    logger.info(f"Copied initial {db_name} from {candidate_src} to {target_path}")
                except Exception as e:
                    logger.warning(f"Could not copy seed {candidate_src} to {target_path}: {e}")
                break

    return target_path
