from __future__ import annotations

from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - runtime dependency is declared in requirements
    load_dotenv = None

_ROOT_DIR = Path(__file__).resolve().parents[1]
_ENV_FILES = (
    _ROOT_DIR / ".env",
    _ROOT_DIR / "backend" / ".env",
)

if load_dotenv is not None:
    for env_file in _ENV_FILES:
        if env_file.is_file():
            load_dotenv(env_file, override=False)

APP_NAME = "TrezzWorld Production Studio"
VERSION = "0.1.0-alpha"
API_HOST = "127.0.0.1"
API_PORT = 8000
