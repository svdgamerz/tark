"""SQLite-backed vector index with in-memory cosine search.

Lean by design (no external vector DB) — perfect for a small-scale corpus like a
single board's textbooks. Each chunk stores its text, citation metadata, and the
embedding (as a float32 blob). Search loads the matching rows and does cosine.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import logging
import numpy as np

from app.config.db_path import get_db_path

logger = logging.getLogger("tark.rag")

try:
    import tark_core
    _HAVE_RUST = True
    logger.info("tark_core native Rust vector acceleration active for RAG")
except ImportError:
    _HAVE_RUST = False


@dataclass
class Hit:
    score: float
    text: str
    citation: str
    page: int | None
    board: str | None = None
    source: str | None = None
    subject: str | None = None
    chapter: str | None = None


def _citation(row: sqlite3.Row) -> str:
    bits = [row["board"], f"Class {row['grade']}", row["subject"]]
    label = ", ".join(b for b in bits if b)
    if row["chapter"]:
        ch = str(row["chapter"])
        # Numeric chapters → "Ch. 5"; named sections (Part 1, Physics) → as-is.
        label += f", Ch. {ch}" if ch.isdigit() else f", {ch}"
    if row["page"]:
        label += f", p. {row['page']}"
    return label


class VectorIndex:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = str(db_path or get_db_path("tark_rag.db"))
        self._init()

    @contextmanager
    def _conn(self):
        c = sqlite3.connect(self.db_path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def _init(self) -> None:
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS chunks (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    board     TEXT, grade TEXT, subject TEXT, chapter TEXT,
                    page      INTEGER, source TEXT,
                    text      TEXT NOT NULL,
                    embedding BLOB NOT NULL
                )"""
            )
            c.commit()

    def add(self, rows: list[dict], embeddings: list[list[float]]) -> None:
        with self._conn() as c:
            for r, emb in zip(rows, embeddings):
                vec = np.asarray(emb, dtype=np.float32).tobytes()
                c.execute(
                    "INSERT INTO chunks(board,grade,subject,chapter,page,source,text,embedding)"
                    " VALUES(?,?,?,?,?,?,?,?)",
                    (r.get("board"), r.get("grade"), r.get("subject"),
                     r.get("chapter"), r.get("page"), r.get("source"), r["text"], vec),
                )
            c.commit()

    def clear(
        self,
        *,
        board: str | None = None,
        grade: str | None = None,
        subject: str | None = None,
    ) -> int:
        where, args = [], []
        for col, val in (("board", board), ("grade", grade), ("subject", subject)):
            if val:
                where.append(f"{col}=?"); args.append(val)
        q = "DELETE FROM chunks"
        if where:
            q += " WHERE " + " AND ".join(where)
        with self._conn() as c:
            cur = c.execute(q, args); c.commit(); return cur.rowcount

    def count(self) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

    def curriculum(self) -> list[dict]:
        """Distinct (board, grade, subject) groups currently in the index."""
        with self._conn() as c:
            rows = c.execute(
                "SELECT board, grade, subject, COUNT(*) AS n FROM chunks "
                "GROUP BY board, grade, subject ORDER BY board, grade, subject"
            ).fetchall()
        return [
            {"board": r["board"], "grade": r["grade"],
             "subject": r["subject"], "chunks": r["n"]}
            for r in rows
        ]

    def search(
        self,
        query_vec: list[float],
        *,
        top_k: int = 5,
        board: str | None = None,
        grade: str | None = None,
        subject: str | None = None,
    ) -> list[Hit]:
        where, args = [], []
        for col, val in (("board", board), ("grade", grade), ("subject", subject)):
            if val:
                where.append(f"{col}=?"); args.append(val)
        sql = "SELECT * FROM chunks"
        if where:
            sql += " WHERE " + " AND ".join(where)
        with self._conn() as c:
            rows = c.execute(sql, args).fetchall()
        if not rows:
            return []

        if _HAVE_RUST:
            raw_blobs = [r["embedding"] for r in rows]
            hits = tark_core.search_vectors(query_vec, raw_blobs, top_k)
            return [
                Hit(score, rows[idx]["text"], _citation(rows[idx]), rows[idx]["page"],
                    rows[idx]["board"], rows[idx]["source"],
                    rows[idx]["subject"], rows[idx]["chapter"])
                for idx, score in hits
            ]

        # NumPy fallback
        mat = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
        q = np.asarray(query_vec, dtype=np.float32)
        mat_n = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-8)
        q_n = q / (np.linalg.norm(q) + 1e-8)
        sims = mat_n @ q_n
        order = np.argsort(-sims)[:top_k]
        return [
            Hit(float(sims[i]), rows[i]["text"], _citation(rows[i]), rows[i]["page"],
                rows[i]["board"], rows[i]["source"],
                rows[i]["subject"], rows[i]["chapter"])
            for i in order
        ]
