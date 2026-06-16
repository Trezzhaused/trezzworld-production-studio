"""
Mission Store — SQLite persistence for LUMI mission execution state.

Inspired by model/jailbreak-autoresearch/src/storage.py (Store + SCHEMA pattern).
Stores missions, pipeline jobs, chat history, and winning output fragments.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

STORE_PATH = Path(__file__).resolve().parents[1] / "runs" / "missions.sqlite"

_SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS missions (
    id          TEXT PRIMARY KEY,
    prompt      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    summary     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id           TEXT PRIMARY KEY,
    mission_id   TEXT NOT NULL,
    title        TEXT NOT NULL,
    capability   TEXT NOT NULL DEFAULT 'general',
    status       TEXT NOT NULL DEFAULT 'queued',
    worker_id    TEXT DEFAULT '',
    target_files TEXT DEFAULT '[]',
    output       TEXT DEFAULT '',
    score        REAL DEFAULT 0.0,
    error        TEXT DEFAULT '',
    started_at   TEXT DEFAULT '',
    completed_at TEXT DEFAULT '',
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS lumi_chat (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id  TEXT,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    model_used  TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS output_fragments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id  TEXT,
    capability  TEXT NOT NULL,
    fragment    TEXT NOT NULL,
    score       REAL DEFAULT 0.0,
    created_at  TEXT NOT NULL
);
"""


class MissionStore:
    """
    SQLite-backed store for mission execution state.

    Thread-safe for single-writer multi-reader access via WAL mode.
    """

    def __init__(self, path: Path = STORE_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ------------------------------------------------------------------
    # Missions
    # ------------------------------------------------------------------

    def create_mission(self, mission_id: str, prompt: str, now: str) -> None:
        self._conn.execute(
            "INSERT OR IGNORE INTO missions (id, prompt, status, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?)",
            (mission_id, prompt, now, now),
        )
        self._conn.commit()

    def update_mission_status(
        self,
        mission_id: str,
        status: str,
        now: str,
        summary: str = "",
    ) -> None:
        self._conn.execute(
            "UPDATE missions SET status=?, updated_at=?, summary=? WHERE id=?",
            (status, now, summary, mission_id),
        )
        self._conn.commit()

    def get_mission(self, mission_id: str) -> dict[str, Any] | None:
        row = self._conn.execute(
            "SELECT * FROM missions WHERE id=?", (mission_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_missions(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM missions ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Pipeline jobs
    # ------------------------------------------------------------------

    def create_job(
        self,
        job_id: str,
        mission_id: str,
        title: str,
        capability: str,
        target_files: list[str],
        worker_id: str,
        now: str,
    ) -> None:
        self._conn.execute(
            """INSERT OR IGNORE INTO pipeline_jobs
               (id, mission_id, title, capability, status, worker_id, target_files, started_at)
               VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)""",
            (job_id, mission_id, title, capability, worker_id, json.dumps(target_files), now),
        )
        self._conn.commit()

    def start_job(self, job_id: str, now: str) -> None:
        self._conn.execute(
            "UPDATE pipeline_jobs SET status='running', started_at=? WHERE id=?",
            (now, job_id),
        )
        self._conn.commit()

    def update_job(
        self,
        job_id: str,
        status: str,
        now: str,
        output: str = "",
        score: float = 0.0,
        error: str = "",
    ) -> None:
        self._conn.execute(
            """UPDATE pipeline_jobs
               SET status=?, output=?, score=?, error=?, completed_at=?
               WHERE id=?""",
            (status, output[:8000], score, error, now, job_id),
        )
        self._conn.commit()

    def get_jobs(self, mission_id: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM pipeline_jobs WHERE mission_id=? ORDER BY rowid ASC",
            (mission_id,),
        ).fetchall()
        jobs = []
        for row in rows:
            job = dict(row)
            try:
                job["target_files"] = json.loads(job.get("target_files") or "[]")
            except (json.JSONDecodeError, TypeError):
                job["target_files"] = []
            jobs.append(job)
        return jobs

    # ------------------------------------------------------------------
    # LUMI chat history
    # ------------------------------------------------------------------

    def add_chat(
        self,
        role: str,
        content: str,
        now: str,
        mission_id: str | None = None,
        model_used: str = "",
    ) -> None:
        self._conn.execute(
            "INSERT INTO lumi_chat (mission_id, role, content, model_used, created_at) VALUES (?, ?, ?, ?, ?)",
            (mission_id, role, content, model_used, now),
        )
        self._conn.commit()

    def get_chat_history(
        self,
        mission_id: str | None = None,
        limit: int = 40,
    ) -> list[dict[str, Any]]:
        if mission_id:
            rows = self._conn.execute(
                "SELECT * FROM lumi_chat WHERE mission_id=? ORDER BY id DESC LIMIT ?",
                (mission_id, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM lumi_chat ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in reversed(rows)]

    # ------------------------------------------------------------------
    # Output fragment memory (jailbreak-autoresearch Store pattern)
    # Stores winning output fragments for evolve/recombine strategies.
    # ------------------------------------------------------------------

    def add_fragment(
        self,
        capability: str,
        fragment: str,
        score: float,
        now: str,
        mission_id: str | None = None,
    ) -> None:
        self._conn.execute(
            "INSERT INTO output_fragments (mission_id, capability, fragment, score, created_at) VALUES (?, ?, ?, ?, ?)",
            (mission_id, capability, fragment[:4000], score, now),
        )
        self._conn.commit()

    def top_fragments(self, capability: str, limit: int = 5) -> list[dict[str, Any]]:
        """Return the highest-scoring fragments for a capability (for recombination)."""
        rows = self._conn.execute(
            "SELECT * FROM output_fragments WHERE capability=? ORDER BY score DESC LIMIT ?",
            (capability, limit),
        ).fetchall()
        return [dict(r) for r in rows]
