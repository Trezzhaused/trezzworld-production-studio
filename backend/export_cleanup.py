"""
Export Cleanup — deletes generated files older than EXPORT_RETENTION_HOURS.

Protects disk usage regardless of whether exports live on Railway's ephemeral
/tmp or a small mounted Volume — without this, a Volume sized for API keys
(megabytes) fills up fast once videos start accumulating on it.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

DEFAULT_RETENTION_HOURS = 48


def _retention_seconds() -> float:
    try:
        hours = float(os.environ.get("EXPORT_RETENTION_HOURS", DEFAULT_RETENTION_HOURS))
    except ValueError:
        hours = DEFAULT_RETENTION_HOURS
    return max(1.0, hours) * 3600


def sweep_old_exports(directory: Path) -> int:
    """Delete files under `directory` older than the retention window. Returns count deleted."""
    if not directory.exists():
        return 0
    cutoff = time.time() - _retention_seconds()
    deleted = 0
    try:
        for entry in directory.rglob("*"):
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink(missing_ok=True)
                    deleted += 1
            except OSError:
                continue
    except OSError:
        return deleted
    return deleted
