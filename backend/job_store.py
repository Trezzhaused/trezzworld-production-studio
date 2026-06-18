"""
Job Store — SQLite persistence for video/music/Roblox job history.

Job objects (VideoJob/MusicJob/RobloxJob) live in an in-memory dict while a
process is running (cheap, fast). This module mirrors each job's to_dict()
snapshot to SQLite on every status change, so job history (status, progress,
messages, output paths) survives a restart/redeploy instead of vanishing —
the in-memory dicts alone don't survive Railway's container lifecycle.

Lives in the same DATA_DIR as mission_store.py/user_key_store.py so it
benefits from the same persistent-Volume setup.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .mission_store import DATA_DIR

_DB_PATH = DATA_DIR / "jobs.sqlite"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    kind        TEXT NOT NULL,
    job_id      TEXT NOT NULL,
    data        TEXT NOT NULL,
    updated_at  REAL NOT NULL,
    PRIMARY KEY (kind, job_id)
);
"""

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    global _conn  # noqa: PLW0603
    if _conn is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _conn.execute(_SCHEMA)
        _conn.commit()
    return _conn


def save_job(kind: str, job_id: str, data: dict[str, Any]) -> None:
    """Upsert a job's snapshot. Best-effort — never raises."""
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO jobs (kind, job_id, data, updated_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(kind, job_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
            (kind, job_id, json.dumps(data), data.get("updatedAt", 0)),
        )
        conn.commit()
    except Exception:
        pass


def load_jobs(kind: str) -> list[dict[str, Any]]:
    """Return all persisted job snapshots for a kind, most recent first. Best-effort."""
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT data FROM jobs WHERE kind = ? ORDER BY updated_at DESC", (kind,)
        ).fetchall()
        return [json.loads(r[0]) for r in rows]
    except Exception:
        return []
