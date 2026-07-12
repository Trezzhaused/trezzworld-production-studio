from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv


LOADED_ENV_FILES: list[Path] = []


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _explicit_env_paths() -> list[Path]:
    repo_root = _repo_root()
    explicit: list[Path] = []
    for key in ("MASTER_FILE", "MASTER_ENV_FILE", "SHARED_ENV_FILE", "ENV_FILE", "DOTENV_PATH"):
        value = os.environ.get(key)
        if not value:
            continue
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = (repo_root / path).resolve()
        explicit.append(path)
    return explicit


def _candidate_files() -> list[Path]:
    repo_root = _repo_root()
    candidates: list[Path] = []
    local_files = [
        repo_root / ".env",
        repo_root / ".env.local",
        repo_root / ".env.production",
    ]
    for path in local_files:
        if path not in candidates:
            candidates.append(path)

    for path in _explicit_env_paths():
        if path not in candidates:
            candidates.append(path)

    shared_defaults = [
        Path.home() / ".config" / "trezzworld" / "master.env",
        Path.home() / ".env",
        Path("/etc/trezzworld/master.env"),
    ]
    for path in shared_defaults:
        if path not in candidates:
            candidates.append(path)

    return candidates


def bootstrap_environment() -> list[Path]:
    """Load repo-local and shared env files into the process environment.

    Repo-local .env files are loaded first with override=False so deployment-provided
    env vars still win. Explicit shared env files (MASTER_FILE / MASTER_ENV_FILE /
    SHARED_ENV_FILE) are loaded afterward with override=True so they can act as the
    master configuration source for this repo.
    """

    global LOADED_ENV_FILES
    LOADED_ENV_FILES = []
    repo_root = _repo_root()

    local_candidates = [repo_root / ".env", repo_root / ".env.local", repo_root / ".env.production"]
    for path in local_candidates:
        if path.exists():
            load_dotenv(path, override=False)
            LOADED_ENV_FILES.append(path)

    explicit_paths = _explicit_env_paths()
    for path in explicit_paths:
        if path.exists():
            load_dotenv(path, override=True)
            LOADED_ENV_FILES.append(path)

    for path in _candidate_files():
        if path in LOADED_ENV_FILES:
            continue
        if path.exists():
            load_dotenv(path, override=False)
            LOADED_ENV_FILES.append(path)

    return LOADED_ENV_FILES
