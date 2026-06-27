from __future__ import annotations

import os
from urllib.parse import urlparse


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def studio_public_url() -> str:
    return os.environ.get("STUDIO_PUBLIC_URL", "https://studio.trezzhaus.com").strip()


def app_trezzhaus_origin() -> str:
    return os.environ.get("APP_TREZZHAUS_ORIGIN", "https://app.trezzhaus.com").strip()


def cors_allowed_origins() -> list[str]:
    configured = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    if configured:
        return _split_csv(configured)

    defaults = [
        studio_public_url(),
        app_trezzhaus_origin(),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "electron://app",
    ]

    seen: set[str] = set()
    result: list[str] = []
    for origin in defaults:
        cleaned = origin.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def media_auth_required() -> bool:
    return _bool_env("REQUIRE_MEDIA_AUTH", default=False)


def media_owner_required() -> bool:
    return _bool_env("REQUIRE_MEDIA_OWNER", default=False)


def is_valid_origin(url: str) -> bool:
    parsed = urlparse(url.strip())
    return bool(parsed.scheme in {"http", "https"} and parsed.netloc)
