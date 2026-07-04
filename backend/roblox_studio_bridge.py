from __future__ import annotations

import threading
import time
from typing import Any


class RobloxStudioBridge:
    """Lightweight studio-sync bridge for Roblox jobs."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, list[dict[str, Any]]] = {}
        self._snapshots: dict[str, dict[str, Any]] = {}

    def register_session(self, job_id: str, websocket: Any) -> None:
        with self._lock:
            entries = self._sessions.setdefault(job_id, [])
            entries[:] = [entry for entry in entries if entry.get("websocket") is not websocket]
            entries.append({"websocket": websocket})

    def unregister_session(self, job_id: str, websocket: Any) -> None:
        with self._lock:
            entries = self._sessions.get(job_id, [])
            entries[:] = [entry for entry in entries if entry.get("websocket") is not websocket]
            if not entries:
                self._sessions.pop(job_id, None)

    def has_session(self, job_id: str) -> bool:
        with self._lock:
            return bool(self._sessions.get(job_id))

    def get_snapshot(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            snapshot = self._snapshots.get(job_id)
            if snapshot is None:
                return None
            return {
                "jobId": snapshot.get("jobId"),
                "prompt": snapshot.get("prompt", ""),
                "files": [dict(file_entry) for file_entry in snapshot.get("files", [])],
                "updatedAt": snapshot.get("updatedAt"),
            }

    def record_snapshot(self, job_id: str, *, prompt: str = "", files: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        payload = {
            "jobId": job_id,
            "prompt": prompt,
            "files": [dict(file_entry) for file_entry in (files or [])],
            "updatedAt": int(time.time()),
        }
        with self._lock:
            self._snapshots[job_id] = payload
        return payload

    def get_status(self, job_id: str) -> dict[str, Any]:
        snapshot = self.get_snapshot(job_id) or {}
        return {
            "jobId": job_id,
            "hasSession": self.has_session(job_id),
            "latestPrompt": snapshot.get("prompt", ""),
            "files": snapshot.get("files", []),
            "updatedAt": snapshot.get("updatedAt"),
        }

    async def publish(self, job_id: str, payload: dict[str, Any]) -> None:
        snapshot = self.get_snapshot(job_id) or {}
        event = {"type": payload.get("type", "SYNC"), "jobId": job_id, "snapshot": snapshot, **payload}
        with self._lock:
            sessions = [entry["websocket"] for entry in self._sessions.get(job_id, []) if entry.get("websocket") is not None]

        for websocket in sessions:
            try:
                await websocket.send_json(event)
            except Exception:
                continue


_bridge_instance: RobloxStudioBridge | None = None


def get_studio_bridge() -> RobloxStudioBridge:
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = RobloxStudioBridge()
    return _bridge_instance
