from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Sequence

from .company_vision import (
    get_asset_generation_blueprint,
    get_capability_matrix,
    get_company_vision_summary,
    get_launch_strategy,
    get_legal_framework,
    get_partnership_playbook,
    get_pitch_deck,
)
from .platform_vision import build_platform_vision_status, get_brand_catalog, get_public_api_surface
from .studio_control_plane import build_studio_control_plane

REPO_ROOT = Path(__file__).resolve().parents[1]
SUPPORTED_DOCUMENT_SUFFIXES = {".json", ".md", ".txt", ".html", ".htm"}


def _repo_root() -> Path:
    return REPO_ROOT


def _expand_path(path_value: str, repo_root: Path | None = None) -> Path:
    base_root = repo_root or _repo_root()
    path = Path(path_value).expanduser()
    if not path.is_absolute():
        path = (base_root / path).resolve()
    return path


def _extra_repo_paths(repo_root: Path | None = None) -> list[Path]:
    repo_root = repo_root or _repo_root()
    paths: list[Path] = []
    raw = os.environ.get("MASTER_DOCUMENT_REPOS", "")
    for item in raw.split(","):
        value = item.strip()
        if not value:
            continue
        path = _expand_path(value, repo_root)
        if path not in paths:
            paths.append(path)
    return paths


def _candidate_doc_paths(repo_root: Path | None = None) -> list[Path]:
    repo_root = repo_root or _repo_root()
    candidates: list[Path] = []

    def add(path: Path | None) -> None:
        if not path:
            return
        if path not in candidates:
            candidates.append(path)

    for key in ("MASTER_DOCUMENT", "MASTER_DOCUMENT_PATH", "MASTER_DOC_PATH"):
        value = os.environ.get(key)
        if value:
            add(_expand_path(value, repo_root))

    for key in ("MASTER_FILE", "MASTER_ENV_FILE", "SHARED_ENV_FILE", "ENV_FILE", "DOTENV_PATH"):
        value = os.environ.get(key)
        if value:
            add(_expand_path(value, repo_root))

    for repo_path in _extra_repo_paths(repo_root):
        add(repo_path)
        for relative in (
            "docs/master-document.json",
            "docs/master-document.md",
            "docs/master-document.txt",
            "master-document.json",
            "master-document.md",
            "master-document.txt",
            "README.md",
        ):
            add(repo_path / relative)
        if repo_path.is_dir():
            for child in sorted(repo_path.rglob("master-document.*")):
                add(child)

    for path in (
        repo_root / "docs" / "master-document.json",
        repo_root / "docs" / "master-document.md",
        repo_root / "docs" / "master-document.txt",
        repo_root / "master-document.json",
        repo_root / "master-document.md",
        repo_root / "master-document.txt",
    ):
        add(path)

    return candidates


def _is_supported_document(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in SUPPORTED_DOCUMENT_SUFFIXES


def discover_master_document(repo_root: Path | None = None) -> Path | None:
    for path in _candidate_doc_paths(repo_root):
        if _is_supported_document(path):
            if path.name.lower() in {".env", ".env.local", ".env.production", ".env.example"}:
                continue
            if path.suffix.lower() in {".html", ".htm"} and "master" not in path.name.lower():
                continue
            return path
    return None


def _normalize_text_document(path: Path, text: str) -> dict[str, Any]:
    title = path.stem.replace("-", " ").replace("_", " ").title()
    summary = ""
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate:
            continue
        if candidate.startswith("#"):
            title = re.sub(r"^#+\s*", "", candidate).strip() or title
            continue
        if candidate and not candidate.startswith("<!--"):
            summary = candidate
            break
    return {
        "title": title,
        "summary": summary or "Shared master document loaded from an external repo or docs folder.",
        "content": text,
    }


def _load_document(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()
    if suffix == ".json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            return {"format": "json", "error": str(exc), **_normalize_text_document(path, text)}
        if isinstance(payload, dict):
            return {"format": "json", "content": payload}
        return {"format": "json", "content": {"value": payload}}
    return {"format": "markdown", **_normalize_text_document(path, text)}


def _build_generated_master_document(repo_root: Path | None = None) -> dict[str, Any]:
    company = get_company_vision_summary()
    launch = get_launch_strategy()
    platform = build_platform_vision_status()
    studio = build_studio_control_plane()
    blueprint = get_asset_generation_blueprint()
    partnership = get_partnership_playbook()
    capability_matrix = get_capability_matrix()
    brand_catalog = get_brand_catalog()
    public_api = get_public_api_surface()
    pitch_deck = get_pitch_deck()
    legal = get_legal_framework()

    return {
        "title": "TrezzWorld Studio Master Blueprint",
        "summary": (
            f"{company['mission']} — a shared blueprint for studio.trezzhaus.com, trezzworld-studio-production, "
            "and the TrezzBLOX creator workflow."
        ),
        "product": "TrezzBLOX Studio Creator",
        "domains": ["studio.trezzhaus.com", "trezzworld-studio-production", "trezzworld-production-studio"],
        "repositories": [
            "trezzworld-production-studio",
            "studio.trezzhaus.com",
            "trezzworld-studio-production",
        ],
        "mission": company["mission"],
        "vision": company["vision"],
        "workstreams": [
            {"name": "Studio Creator", "focus": "Prompt-to-experience generation, Luau packaging, and live Studio sync."},
            {"name": "Launch & Deployment", "focus": "Shared env/master-file support, deployment smoke tests, and Railway rollout."},
            {"name": "Brand & Platform", "focus": "Brand catalogs, franchise concepts, public API surfaces, and partnership playbooks."},
            {"name": "Autonomous Operations", "focus": "MetaBuilder planning, execution queueing, and capability routing."},
        ],
        "capabilities": [
            "Prompt-driven Roblox experience creation",
            "Luau packing and Rojo-compatible export",
            "Studio live sync and publishing workflows",
            "Monetization setup and Roblox Open Cloud integration",
            "Shared master-document and deployment integration",
        ],
        "launchChecklist": [
            "Ensure the shared master document is reachable via MASTER_DOCUMENT or MASTER_DOCUMENT_REPOS.",
            "Confirm deployment smoke checks and Railway secrets are configured.",
            "Validate the Roblox OAuth, publishing, and monetization flow before public launch.",
        ],
        "sources": [
            "backend/company_vision.py",
            "backend/platform_vision.py",
            "backend/studio_control_plane.py",
            "app/react/App.tsx",
            "backend/main.py",
            "docs/master-document.json",
        ],
        "extras": {
            "companyVision": company,
            "launchStrategy": launch,
            "platformVision": platform,
            "studioControlPlane": studio,
            "assetBlueprint": blueprint,
            "partnerships": partnership,
            "capabilityMatrix": capability_matrix,
            "brandCatalog": brand_catalog,
            "publicApi": public_api,
            "pitchDeck": pitch_deck,
            "legalFramework": legal,
        },
    }


def _normalize_document_payload(payload: dict[str, Any], path: Path | None, repo_root: Path | None = None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {"content": payload}

    title = payload.get("title") or payload.get("name") or "TrezzWorld Studio Master Document"
    summary = (
        payload.get("summary")
        or payload.get("mission")
        or payload.get("description")
        or payload.get("overview")
        or "Shared master document loaded for the studio deployment stack."
    )
    domains = payload.get("domains") or payload.get("targets") or payload.get("integrations") or []
    workstreams = payload.get("workstreams") or payload.get("streams") or []
    repositories = payload.get("repositories") or payload.get("repoTargets") or []
    capabilities = payload.get("capabilities") or []
    launch_checklist = payload.get("launchChecklist") or payload.get("launch_checklist") or []

    if not isinstance(domains, list):
        domains = [str(domains)] if domains else []
    if not isinstance(workstreams, list):
        workstreams = [workstreams] if workstreams else []
    if not isinstance(repositories, list):
        repositories = [str(repositories)] if repositories else []
    if not isinstance(capabilities, list):
        capabilities = [str(capabilities)] if capabilities else []
    if not isinstance(launch_checklist, list):
        launch_checklist = [str(launch_checklist)] if launch_checklist else []

    return {
        "title": str(title),
        "summary": str(summary),
        "product": payload.get("product") or "TrezzBLOX Studio Creator",
        "domains": domains,
        "repositories": repositories,
        "mission": payload.get("mission") or summary,
        "workstreams": workstreams,
        "capabilities": capabilities,
        "launchChecklist": launch_checklist,
        "sources": payload.get("sources") or [],
        "extras": payload.get("extras") or {},
        "source": str(path) if path else None,
        "format": payload.get("format") or ("json" if path and path.suffix.lower() == ".json" else "markdown"),
        "ready": True,
    }


def load_master_document(repo_root: Path | None = None) -> dict[str, Any]:
    repo_root = repo_root or _repo_root()
    doc_path = discover_master_document(repo_root)
    if doc_path is None:
        return _normalize_document_payload(_build_generated_master_document(repo_root), None, repo_root)

    parsed = _load_document(doc_path)
    if parsed.get("error"):
        return {
            **_normalize_document_payload(_build_generated_master_document(repo_root), None, repo_root),
            "source": str(doc_path),
            "format": "markdown",
            "warnings": [parsed["error"]],
        }

    content = parsed.get("content") or {}
    if isinstance(content, dict):
        payload = _normalize_document_payload(content, doc_path, repo_root)
        payload["format"] = parsed.get("format", payload["format"])
        return payload

    if parsed.get("title") or parsed.get("summary"):
        payload = _normalize_document_payload(
            {
                "title": parsed.get("title"),
                "summary": parsed.get("summary"),
                "content": content,
            },
            doc_path,
            repo_root,
        )
    else:
        payload = _normalize_document_payload({"content": content}, doc_path, repo_root)
    payload["format"] = parsed.get("format", payload["format"])
    return payload


def build_master_document_status(repo_root: Path | None = None) -> dict[str, Any]:
    document = load_master_document(repo_root)
    return {
        "ready": document.get("ready", False),
        "source": document.get("source"),
        "format": document.get("format", "generated"),
        "title": document.get("title", "TrezzWorld Studio Master Document"),
        "summary": document.get("summary", ""),
        "product": document.get("product", "TrezzBLOX Studio Creator"),
        "domains": document.get("domains", []),
        "repositories": document.get("repositories", []),
        "mission": document.get("mission", ""),
        "workstreams": document.get("workstreams", []),
        "capabilities": document.get("capabilities", []),
        "launchChecklist": document.get("launchChecklist", []),
        "sources": document.get("sources", []),
        "warnings": document.get("warnings", []),
    }
