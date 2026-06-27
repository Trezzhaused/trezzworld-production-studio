from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path
from typing import Any

from .mission_store import DATA_DIR, MissionStore, STORE_PATH
from .runtime_config import (
    app_trezzhaus_origin,
    cors_allowed_origins,
    is_valid_origin,
    media_auth_required,
    media_owner_required,
    studio_public_url,
)
from .trezzhaus_auth import AUTH_API_BASE
from .user_key_store import get_user_key_store

REPO_ROOT = Path(__file__).resolve().parents[1]
_TEMP_ROOT = Path(tempfile.gettempdir()).resolve()


def _has_value(name: str) -> bool:
    return bool(os.environ.get(name, "").strip())


def _status_value(ok: bool, warning: bool = False) -> str:
    if ok:
        return "warn" if warning else "pass"
    return "fail"


def _make_check(
    *,
    check_id: str,
    category: str,
    goal: str,
    ok: bool,
    detail: str,
    required: bool = True,
    warning: bool = False,
) -> dict[str, Any]:
    status = _status_value(ok, warning=warning)
    return {
        "id": check_id,
        "category": category,
        "goal": goal,
        "required": required,
        "status": status,
        "passed": ok and not warning,
        "detail": detail,
    }


def _score_checks(checks: list[dict[str, Any]]) -> int:
    if not checks:
        return 0
    weights = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
    score = sum(weights.get(check["status"], 0.0) for check in checks) / len(checks)
    return int(round(score * 100))


def _is_ephemeral(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except OSError:
        resolved = path
    return str(resolved).startswith(str(_TEMP_ROOT))


def _probe_directory(path: Path) -> tuple[bool, str]:
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / ".readiness-write-test"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        return True, str(path)
    except OSError as exc:
        return False, f"{path} ({exc})"


def _document_dir() -> Path:
    return Path(os.environ.get("DOCUMENT_EXPORT_DIR", "/tmp/trezzworld/exports/documents"))


def _voice_dir() -> Path:
    return Path(os.environ.get("VOICE_EXPORT_DIR", "/tmp/trezzworld/exports/voice"))


def _voice_library_dir() -> Path:
    return Path(os.environ.get("VOICE_LIBRARY_DIR", "/tmp/trezzworld/library/voice"))


def _music_archive_dir() -> Path:
    return Path(os.environ.get("MUSIC_ARCHIVE_DIR", "/tmp/trezzworld/exports/archive/music"))


def _load_package_scripts(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        package = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    scripts = package.get("scripts")
    return scripts if isinstance(scripts, dict) else {}


def _user_key_configured(*providers: str) -> bool:
    try:
        store = get_user_key_store()
    except sqlite3.Error:
        return False
    return any(bool(store.get_key(provider)) for provider in providers)


def _image_provider_details() -> tuple[bool, str]:
    configured: list[str] = []
    if _has_value("HUGGINGFACE_API_KEY") or _has_value("HF_API_KEY") or _user_key_configured("huggingface"):
        configured.append("Hugging Face")
    if _has_value("FAL_KEY") or _has_value("FAL_API_KEY") or _user_key_configured("fal"):
        configured.append("fal.ai")
    if _has_value("OPENAI_API_KEY") or _user_key_configured("openai"):
        configured.append("OpenAI")
    if configured:
        return True, ", ".join(configured)
    return False, "Add HUGGINGFACE_API_KEY/HF_API_KEY, FAL_KEY/FAL_API_KEY, OPENAI_API_KEY, or save a provider key in Settings."


def _ai_router_details() -> tuple[bool, str]:
    configured: list[str] = []
    if _has_value("OPENROUTER_API_KEY"):
        configured.append("OPENROUTER_API_KEY")
    if _user_key_configured("openrouter", "google", "openai", "anthropic"):
        configured.append("saved provider key")
    if configured:
        return True, "Configured via " + " + ".join(configured)
    return False, "Set OPENROUTER_API_KEY or save an OpenRouter/Google/OpenAI/Anthropic key in Settings."


def build_backend_readiness() -> dict[str, Any]:
    from .job_store import _get_conn as _get_job_conn  # noqa: PLC0415
    from .lumi_creative_tools import _resolve_export_dir as _resolve_lumi_tools_dir  # noqa: PLC0415
    from .lumi_image_export import _resolve_export_dir as _resolve_lumi_export_dir  # noqa: PLC0415
    from .music_creator import _resolve_music_export_dir  # noqa: PLC0415
    from .roblox_creator import _resolve_roblox_export_dir  # noqa: PLC0415
    from .video_creator import _PIL_AVAILABLE, _resolve_video_export_dir  # noqa: PLC0415

    checks: list[dict[str, Any]] = []

    data_dir_ok, data_dir_detail = _probe_directory(DATA_DIR)
    checks.append(
        _make_check(
            check_id="data-dir",
            category="Persistent storage",
            goal="Writable",
            ok=data_dir_ok,
            detail=(
                f"DATA_DIR ready at {data_dir_detail}."
                if data_dir_ok and not _is_ephemeral(DATA_DIR)
                else f"DATA_DIR is writable but ephemeral at {data_dir_detail}; set DATA_DIR to a persistent volume for deploys."
                if data_dir_ok
                else f"DATA_DIR is not writable: {data_dir_detail}"
            ),
            warning=data_dir_ok and _is_ephemeral(DATA_DIR),
        )
    )

    try:
        MissionStore()
        store_ready = STORE_PATH.exists()
        store_detail = f"Mission store initialized at {STORE_PATH}."
    except Exception as exc:  # noqa: BLE001
        store_ready = False
        store_detail = f"Mission store failed to initialize: {exc}"
    checks.append(
        _make_check(
            check_id="mission-store",
            category="Mission persistence",
            goal="SQLite ready",
            ok=store_ready,
            detail=store_detail,
        )
    )

    try:
        _get_job_conn()
        jobs_ready = True
        jobs_detail = f"Job store initialized at {DATA_DIR / 'jobs.sqlite'}."
    except Exception as exc:  # noqa: BLE001
        jobs_ready = False
        jobs_detail = f"Job store failed to initialize: {exc}"
    checks.append(
        _make_check(
            check_id="job-store",
            category="Job persistence",
            goal="SQLite ready",
            ok=jobs_ready,
            detail=jobs_detail,
        )
    )

    try:
        get_user_key_store()
        keys_ready = True
        keys_detail = f"User key store ready at {STORE_PATH}."
    except Exception as exc:  # noqa: BLE001
        keys_ready = False
        keys_detail = f"User key store failed to initialize: {exc}"
    checks.append(
        _make_check(
            check_id="user-key-store",
            category="Provider key storage",
            goal="SQLite ready",
            ok=keys_ready,
            detail=keys_detail,
        )
    )

    export_targets = [
        ("video-exports", "Video exports", _resolve_video_export_dir()),
        ("music-exports", "Music exports", _resolve_music_export_dir()),
        ("music-archive", "Music archive", _music_archive_dir()),
        ("roblox-exports", "Roblox exports", _resolve_roblox_export_dir()),
        ("lumi-exports", "LUMI exports", _resolve_lumi_export_dir()),
        ("lumi-tool-exports", "LUMI tool exports", _resolve_lumi_tools_dir()),
        ("document-exports", "Document exports", _document_dir()),
        ("voice-exports", "Voice exports", _voice_dir()),
        ("voice-library", "Voice library storage", _voice_library_dir()),
    ]
    for check_id, category, path in export_targets:
        ok, detail = _probe_directory(path)
        ephemeral = ok and _is_ephemeral(path)
        checks.append(
            _make_check(
                check_id=check_id,
                category=category,
                goal="Writable",
                ok=ok,
                detail=(
                    f"{category} directory ready at {detail}."
                    if ok and not ephemeral
                    else f"{category} directory is writable but ephemeral at {detail}; configure a persistent export path for deploys."
                    if ok
                    else f"{category} directory is not writable: {detail}"
                ),
                warning=ephemeral,
            )
        )

    ffmpeg_path = shutil.which("ffmpeg")
    checks.append(
        _make_check(
            check_id="ffmpeg",
            category="Video runtime",
            goal="FFmpeg installed",
            ok=ffmpeg_path is not None,
            detail=f"FFmpeg detected at {ffmpeg_path}." if ffmpeg_path else "FFmpeg not found on PATH.",
        )
    )

    checks.append(
        _make_check(
            check_id="pillow",
            category="Image runtime",
            goal="Pillow installed",
            ok=_PIL_AVAILABLE,
            detail="Pillow is available for richer frame rendering." if _PIL_AVAILABLE else "Pillow is unavailable; image features fall back to degraded behavior.",
            warning=not _PIL_AVAILABLE,
        )
    )

    edge_tts_available = importlib.util.find_spec("edge_tts") is not None
    checks.append(
        _make_check(
            check_id="edge-tts",
            category="Voice runtime",
            goal="edge-tts installed",
            ok=edge_tts_available,
            detail="edge-tts is available for voice generation." if edge_tts_available else "edge-tts is not installed; voice generation will fail.",
        )
    )

    ai_ready, ai_detail = _ai_router_details()
    checks.append(
        _make_check(
            check_id="ai-routing",
            category="LUMI routing",
            goal="At least one provider configured",
            ok=ai_ready,
            detail=ai_detail,
            required=False,
            warning=not ai_ready,
        )
    )

    image_ready, image_detail = _image_provider_details()
    checks.append(
        _make_check(
            check_id="image-generation",
            category="Image generation",
            goal="At least one provider configured",
            ok=image_ready,
            detail=image_detail if image_ready else f"Image generation not fully configured. {image_detail}",
            required=False,
            warning=not image_ready,
        )
    )

    oauth_ready = all(_has_value(name) for name in ("ROBLOX_OAUTH_CLIENT_ID", "ROBLOX_OAUTH_CLIENT_SECRET", "ROBLOX_OAUTH_REDIRECT_URI"))
    checks.append(
        _make_check(
            check_id="roblox-oauth",
            category="Roblox OAuth",
            goal="Client configured",
            ok=oauth_ready,
            detail="Roblox OAuth client configuration is complete." if oauth_ready else "Set ROBLOX_OAUTH_CLIENT_ID, ROBLOX_OAUTH_CLIENT_SECRET, and ROBLOX_OAUTH_REDIRECT_URI.",
            required=False,
            warning=not oauth_ready,
        )
    )

    roblox_publish_ready = all(_has_value(name) for name in ("ROBLOX_API_KEY", "ROBLOX_UNIVERSE_ID", "ROBLOX_PLACE_ID"))
    checks.append(
        _make_check(
            check_id="roblox-publish",
            category="Roblox publishing",
            goal="Publishing credentials configured",
            ok=roblox_publish_ready,
            detail="Roblox publishing credentials are configured." if roblox_publish_ready else "Set ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and ROBLOX_PLACE_ID.",
            required=False,
            warning=not roblox_publish_ready,
        )
    )

    auth_base_ready = bool(AUTH_API_BASE.strip())
    checks.append(
        _make_check(
            check_id="trezzhaus-auth",
            category="TrezzHaus SSO",
            goal="Auth base configured",
            ok=auth_base_ready,
            detail=f"TrezzHaus auth base set to {AUTH_API_BASE}." if auth_base_ready else "TREZZHAUS_AUTH_API_BASE is missing.",
            required=False,
            warning=not auth_base_ready,
        )
    )

    studio_origin = studio_public_url()
    app_origin = app_trezzhaus_origin()
    origins_ready = is_valid_origin(studio_origin) and is_valid_origin(app_origin)
    checks.append(
        _make_check(
            check_id="public-origins",
            category="Routing origins",
            goal="Studio/app origins valid",
            ok=origins_ready,
            detail=(
                f"Studio origin {studio_origin} and app origin {app_origin} are configured."
                if origins_ready
                else f"Invalid STUDIO_PUBLIC_URL ({studio_origin}) or APP_TREZZHAUS_ORIGIN ({app_origin})."
            ),
        )
    )

    allowed_origins = cors_allowed_origins()
    cors_ready = studio_origin in allowed_origins and app_origin in allowed_origins
    checks.append(
        _make_check(
            check_id="cors-origins",
            category="Routing security",
            goal="CORS origins include required hosts",
            ok=cors_ready,
            detail=(
                f"CORS allows studio/app origins: {', '.join(allowed_origins)}."
                if cors_ready
                else f"CORS is missing {studio_origin} or {app_origin}; current origins: {', '.join(allowed_origins)}"
            ),
        )
    )

    media_auth_enabled = media_auth_required()
    checks.append(
        _make_check(
            check_id="media-auth",
            category="Media API protection",
            goal="Authenticated media writes enforced",
            ok=media_auth_enabled,
            detail=(
                "REQUIRE_MEDIA_AUTH is enabled for media-generation and upload endpoints."
                if media_auth_enabled
                else "REQUIRE_MEDIA_AUTH is disabled; media-generation and upload endpoints remain open."
            ),
            required=False,
            warning=not media_auth_enabled,
        )
    )

    checks.append(
        _make_check(
            check_id="media-owner-mode",
            category="Media API protection",
            goal="Optional owner-only enforcement configured",
            ok=True,
            detail=(
                "REQUIRE_MEDIA_OWNER is enabled; only the configured owner can invoke protected media writes."
                if media_owner_required()
                else "REQUIRE_MEDIA_OWNER is disabled; any authenticated session can invoke protected media writes."
            ),
            required=False,
        )
    )

    owner_ready = _has_value("OWNER_ACCOUNT_ID")
    checks.append(
        _make_check(
            check_id="owner-mode",
            category="Owner mode",
            goal="Owner account configured",
            ok=owner_ready,
            detail="OWNER_ACCOUNT_ID is configured." if owner_ready else "OWNER_ACCOUNT_ID is not set; owner-only LUMI behavior stays disabled.",
            required=False,
            warning=not owner_ready,
        )
    )

    smoke_test_path = REPO_ROOT / "backend" / "tests" / "test_backend_smoke.py"
    scripts = _load_package_scripts(REPO_ROOT / "package.json")
    script_text = " ".join(str(scripts.get(name, "")) for name in ("test", "test:backend"))
    smoke_test_ready = smoke_test_path.exists() and "unittest" in script_text and "backend/tests" in script_text
    checks.append(
        _make_check(
            check_id="backend-smoke-tests",
            category="Backend validation",
            goal="Smoke tests wired into npm test",
            ok=smoke_test_ready,
            detail="Smoke tests exist and npm test runs them." if smoke_test_ready else "Backend smoke tests are missing or npm test is not wired to them yet.",
        )
    )

    blockers = [check["detail"] for check in checks if check["required"] and check["status"] == "fail"]
    warnings = [check["detail"] for check in checks if check["status"] == "warn"]

    return {
        "ready": not blockers,
        "score": _score_checks(checks),
        "summary": "Backend runtime checks passed." if not blockers else f"Backend has {len(blockers)} blocking readiness issue(s).",
        "checks": checks,
        "blockers": blockers,
        "warnings": warnings,
    }


def build_integration_services() -> list[dict[str, Any]]:
    image_ready, image_detail = _image_provider_details()
    ai_ready, ai_detail = _ai_router_details()
    roblox_oauth_ready = all(_has_value(name) for name in ("ROBLOX_OAUTH_CLIENT_ID", "ROBLOX_OAUTH_CLIENT_SECRET", "ROBLOX_OAUTH_REDIRECT_URI"))
    roblox_publish_ready = all(_has_value(name) for name in ("ROBLOX_API_KEY", "ROBLOX_UNIVERSE_ID", "ROBLOX_PLACE_ID"))
    persistence_ready = _has_value("DATA_DIR")

    return [
        {
            "id": "trezzhaus-auth",
            "label": "TrezzHaus account SSO",
            "status": "ready" if AUTH_API_BASE else "needs-config",
            "detail": f"Using auth base {AUTH_API_BASE}." if AUTH_API_BASE else "Set TREZZHAUS_AUTH_API_BASE.",
        },
        {
            "id": "routing-origins",
            "label": "Studio routing origins",
            "status": "ready" if is_valid_origin(studio_public_url()) and is_valid_origin(app_trezzhaus_origin()) else "needs-config",
            "detail": f"Studio={studio_public_url()} | App={app_trezzhaus_origin()}",
        },
        {
            "id": "lumi-openrouter",
            "label": "LUMI / AI routing",
            "status": "ready" if ai_ready else "needs-config",
            "detail": ai_detail,
        },
        {
            "id": "image-generation",
            "label": "Image generation",
            "status": "ready" if image_ready else "needs-config",
            "detail": image_detail,
        },
        {
            "id": "roblox-oauth",
            "label": "Roblox OAuth",
            "status": "ready" if roblox_oauth_ready else "needs-config",
            "detail": "OAuth client is configured." if roblox_oauth_ready else "Set Roblox OAuth client ID, secret, and redirect URI.",
        },
        {
            "id": "roblox-publish",
            "label": "Roblox Open Cloud publish",
            "status": "ready" if roblox_publish_ready else "needs-config",
            "detail": "Publishing credentials are configured." if roblox_publish_ready else "Set ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and ROBLOX_PLACE_ID.",
        },
        {
            "id": "persistent-storage",
            "label": "Persistent DATA_DIR",
            "status": "ready" if persistence_ready else "partial",
            "detail": f"DATA_DIR points to {os.environ.get('DATA_DIR')}." if persistence_ready else "Set DATA_DIR to a mounted persistent volume for deploys.",
        },
        {
            "id": "media-auth",
            "label": "Protected media writes",
            "status": "ready" if media_auth_required() else "partial",
            "detail": (
                "Protected media routes require an authenticated TrezzHaus session."
                if media_auth_required()
                else "Set REQUIRE_MEDIA_AUTH=true to require TrezzHaus sign-in for media generation and uploads."
            ),
        },
        {
            "id": "owner-mode",
            "label": "Owner-mode account mapping",
            "status": "ready" if _has_value("OWNER_ACCOUNT_ID") else "partial",
            "detail": "OWNER_ACCOUNT_ID configured." if _has_value("OWNER_ACCOUNT_ID") else "Set OWNER_ACCOUNT_ID to enable verified owner-only LUMI behavior.",
        },
    ]


def build_production_readiness() -> dict[str, Any]:
    readiness = build_backend_readiness()
    checks = [
        {
            "category": check["category"],
            "goal": check["goal"],
            "passed": check["status"] == "pass",
            "status": check["status"],
            "detail": check["detail"],
        }
        for check in readiness["checks"]
    ]
    return {
        "score": readiness["score"],
        "ready": readiness["ready"],
        "summary": readiness["summary"],
        "checks": checks,
        "blockers": readiness["blockers"],
        "warnings": readiness["warnings"],
    }
