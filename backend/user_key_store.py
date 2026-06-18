"""
User Key Store — SQLite persistence for user-provided AI provider API keys.

Allows users to connect their own OpenRouter, OpenAI, Anthropic, or Google AI
accounts so that LUMI never goes completely dark when free-tier limits are hit.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from .mission_store import STORE_PATH as _DB_PATH  # shared DB file; see DATA_DIR there

_SCHEMA = """
CREATE TABLE IF NOT EXISTS user_api_keys (
    provider    TEXT PRIMARY KEY,
    api_key     TEXT NOT NULL,
    label       TEXT DEFAULT '',
    added_at    TEXT NOT NULL
);
"""

# Supported provider catalogue shown to users when cascade is exhausted
PROVIDER_CATALOGUE: dict[str, dict[str, Any]] = {
    "openrouter": {
        "name": "OpenRouter",
        "description": "Access 200+ AI models (GPT-4, Claude, Gemini, Llama) with one key.",
        "cost": "Free tier included. Paid from $0.0001 / 1K tokens.",
        "get_key_url": "https://openrouter.ai/keys",
        "recommended": True,
        "priority": 1,
    },
    "google": {
        "name": "Google AI Studio",
        "description": "Gemini 2.0 Flash, Gemini 1.5 Pro. Free tier available.",
        "cost": "Free tier. Paid from $0.075 / 1M tokens (Gemini Flash).",
        "get_key_url": "https://aistudio.google.com/app/apikey",
        "recommended": False,
        "priority": 2,
    },
    "openai": {
        "name": "OpenAI",
        "description": "GPT-4o-mini (cheapest), GPT-4o, GPT-4.1.",
        "cost": "From $0.15 / 1M tokens (GPT-4o-mini).",
        "get_key_url": "https://platform.openai.com/api-keys",
        "recommended": False,
        "priority": 3,
    },
    "anthropic": {
        "name": "Anthropic",
        "description": "Claude Haiku 3.5, Claude Sonnet 4, Claude Opus.",
        "cost": "From $0.25 / 1M tokens (Claude Haiku 3.5).",
        "get_key_url": "https://console.anthropic.com/account/keys",
        "recommended": False,
        "priority": 4,
    },
    "huggingface": {
        "name": "Hugging Face",
        "description": "Stable Diffusion XL/3 image generation for photorealistic video frames.",
        "cost": "Free tier included (Inference API).",
        "get_key_url": "https://huggingface.co/settings/tokens",
        "recommended": True,
        "priority": 5,
    },
    "fal": {
        "name": "fal.ai",
        "description": "Wan 2.2 / Kling video generation, used as a photorealistic frame fallback.",
        "cost": "Pay-as-you-go, free trial credits included.",
        "get_key_url": "https://fal.ai/dashboard/keys",
        "recommended": False,
        "priority": 6,
    },
}


class UserKeyStore:
    """SQLite-backed store for user-provided AI provider API keys."""

    def __init__(self, path: Path = _DB_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def save_key(self, provider: str, api_key: str, label: str = "") -> None:
        """Add or update a user-provided API key for the given provider."""
        from datetime import datetime, timezone  # noqa: PLC0415
        if provider not in PROVIDER_CATALOGUE:
            raise ValueError(f"Unsupported provider '{provider}'. Choose from: {list(PROVIDER_CATALOGUE)}")
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """INSERT INTO user_api_keys (provider, api_key, label, added_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(provider) DO UPDATE SET api_key=excluded.api_key,
               label=excluded.label, added_at=excluded.added_at""",
            (provider, api_key.strip(), label, now),
        )
        self._conn.commit()

    def get_key(self, provider: str) -> str | None:
        """Return the stored API key for a provider, or None if not set."""
        row = self._conn.execute(
            "SELECT api_key FROM user_api_keys WHERE provider=?", (provider,)
        ).fetchone()
        return row["api_key"] if row else None

    def list_providers(self) -> list[dict[str, Any]]:
        """Return all stored providers (keys are masked for security)."""
        rows = self._conn.execute(
            "SELECT provider, api_key, label, added_at FROM user_api_keys ORDER BY added_at"
        ).fetchall()
        result = []
        for row in rows:
            key = row["api_key"]
            masked = key[:8] + "…" + key[-4:] if len(key) > 12 else "****"
            catalogue_info = PROVIDER_CATALOGUE.get(row["provider"], {})
            result.append({
                "provider": row["provider"],
                "name": catalogue_info.get("name", row["provider"]),
                "label": row["label"],
                "key_preview": masked,
                "added_at": row["added_at"],
            })
        return result

    def delete_key(self, provider: str) -> bool:
        """Remove a stored key. Returns True if a row was deleted."""
        cur = self._conn.execute(
            "DELETE FROM user_api_keys WHERE provider=?", (provider,)
        )
        self._conn.commit()
        return cur.rowcount > 0

    def ordered_providers(self) -> list[tuple[str, str]]:
        """
        Return (provider, api_key) pairs sorted by priority order,
        only for providers that have a stored key.
        """
        result = []
        for provider in sorted(PROVIDER_CATALOGUE, key=lambda p: PROVIDER_CATALOGUE[p]["priority"]):
            key = self.get_key(provider)
            if key:
                result.append((provider, key))
        return result


_store_instance: UserKeyStore | None = None


def get_user_key_store() -> UserKeyStore:
    """Return the module-level UserKeyStore singleton."""
    global _store_instance  # noqa: PLW0603
    if _store_instance is None:
        _store_instance = UserKeyStore()
    return _store_instance
