from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from .mission_store import DATA_DIR

_DB_PATH = DATA_DIR / "voice_library.sqlite"
_LIBRARY_DIR = Path(os.environ.get("VOICE_LIBRARY_DIR", "/tmp/trezzworld/library/voice"))
_STAGING_ROOT = Path(tempfile.gettempdir()) / "trezzworld" / "voice-imports"
_LOCK = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS voice_assets (
    asset_id           TEXT PRIMARY KEY,
    checksum           TEXT NOT NULL UNIQUE,
    filename           TEXT NOT NULL,
    original_filename  TEXT NOT NULL,
    title              TEXT NOT NULL,
    collection_name    TEXT NOT NULL DEFAULT '',
    tags_json          TEXT NOT NULL DEFAULT '[]',
    content_type       TEXT NOT NULL,
    extension          TEXT NOT NULL,
    size_bytes         INTEGER NOT NULL,
    storage_path       TEXT NOT NULL,
    source             TEXT NOT NULL DEFAULT 'upload',
    imported_at        REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voice_assets_imported_at ON voice_assets(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_assets_collection ON voice_assets(collection_name);
CREATE INDEX IF NOT EXISTS idx_voice_assets_title ON voice_assets(title);

CREATE TABLE IF NOT EXISTS voice_import_jobs (
    job_id             TEXT PRIMARY KEY,
    status             TEXT NOT NULL,
    total_files        INTEGER NOT NULL,
    processed_files    INTEGER NOT NULL,
    imported_files     INTEGER NOT NULL,
    duplicate_files    INTEGER NOT NULL,
    failed_files       INTEGER NOT NULL,
    error              TEXT NOT NULL DEFAULT '',
    collection_name    TEXT NOT NULL DEFAULT '',
    tags_json          TEXT NOT NULL DEFAULT '[]',
    created_at         REAL NOT NULL,
    updated_at         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_import_job_items (
    job_id             TEXT NOT NULL,
    item_index         INTEGER NOT NULL,
    original_filename  TEXT NOT NULL,
    asset_id           TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL,
    detail             TEXT NOT NULL DEFAULT '',
    size_bytes         INTEGER NOT NULL DEFAULT 0,
    checksum           TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (job_id, item_index)
);
"""

_CONTENT_TYPE_TO_EXT = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
}
_ALLOWED_EXTENSIONS = set(_CONTENT_TYPE_TO_EXT.values()) | {"wav", "mp3", "flac", "ogg", "aac", "m4a", "webm"}


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.commit()
    return conn


_CONN = _get_conn()


def _resolve_voice_library_dir() -> Path:
    try:
        _LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
        test = _LIBRARY_DIR / ".write_test"
        test.write_text("ok", encoding="utf-8")
        test.unlink(missing_ok=True)
        return _LIBRARY_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "library" / "voice"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _sanitize_filename(name: str, fallback: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in {".", "-", "_", " "} else "_" for ch in (name or "").strip())
    safe = safe.strip(" .")
    return safe[:120] or fallback


def _normalize_tags(tags: list[str] | None) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        cleaned = str(tag).strip().lower()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result[:50]


def _job_summary(job_id: str) -> dict[str, Any] | None:
    row = _CONN.execute(
        "SELECT * FROM voice_import_jobs WHERE job_id = ?",
        (job_id,),
    ).fetchone()
    if row is None:
        return None
    items = _CONN.execute(
        "SELECT item_index, original_filename, asset_id, status, detail, size_bytes, checksum "
        "FROM voice_import_job_items WHERE job_id = ? ORDER BY item_index ASC",
        (job_id,),
    ).fetchall()
    return {
        "jobId": row["job_id"],
        "status": row["status"],
        "totalFiles": row["total_files"],
        "processedFiles": row["processed_files"],
        "importedFiles": row["imported_files"],
        "duplicateFiles": row["duplicate_files"],
        "failedFiles": row["failed_files"],
        "error": row["error"] or None,
        "collectionName": row["collection_name"],
        "tags": json.loads(row["tags_json"] or "[]"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "items": [
            {
                "index": item["item_index"],
                "originalFilename": item["original_filename"],
                "assetId": item["asset_id"] or None,
                "status": item["status"],
                "detail": item["detail"] or None,
                "sizeBytes": item["size_bytes"],
                "checksum": item["checksum"] or None,
            }
            for item in items
        ],
    }


def _asset_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "assetId": row["asset_id"],
        "title": row["title"],
        "filename": row["filename"],
        "originalFilename": row["original_filename"],
        "collectionName": row["collection_name"],
        "tags": json.loads(row["tags_json"] or "[]"),
        "contentType": row["content_type"],
        "extension": row["extension"],
        "sizeBytes": row["size_bytes"],
        "source": row["source"],
        "importedAt": row["imported_at"],
        "downloadUrl": f"/api/voice/library/assets/{row['asset_id']}/download",
    }


def _detect_extension(filename: str, content_type: str) -> str | None:
    if content_type in _CONTENT_TYPE_TO_EXT:
        return _CONTENT_TYPE_TO_EXT[content_type]
    suffix = Path(filename or "").suffix.lower().lstrip(".")
    return suffix if suffix in _ALLOWED_EXTENSIONS else None


def _update_job_counts(
    job_id: str,
    *,
    status: str | None = None,
    processed_inc: int = 0,
    imported_inc: int = 0,
    duplicate_inc: int = 0,
    failed_inc: int = 0,
    error: str | None = None,
) -> None:
    row = _CONN.execute(
        "SELECT processed_files, imported_files, duplicate_files, failed_files, error FROM voice_import_jobs WHERE job_id = ?",
        (job_id,),
    ).fetchone()
    if row is None:
        return
    _CONN.execute(
        "UPDATE voice_import_jobs SET status = ?, processed_files = ?, imported_files = ?, duplicate_files = ?, "
        "failed_files = ?, error = ?, updated_at = ? WHERE job_id = ?",
        (
            status or _job_summary(job_id)["status"],
            row["processed_files"] + processed_inc,
            row["imported_files"] + imported_inc,
            row["duplicate_files"] + duplicate_inc,
            row["failed_files"] + failed_inc,
            error or row["error"],
            time.time(),
            job_id,
        ),
    )
    _CONN.commit()


def _process_import_job(
    job_id: str,
    staged_files: list[dict[str, Any]],
    collection_name: str,
    tags: list[str],
    source: str,
) -> None:
    try:
        _update_job_counts(job_id, status="running")
        library_dir = _resolve_voice_library_dir()
        for item in staged_files:
            stage_path = Path(item["stage_path"])
            try:
                data = stage_path.read_bytes()
                checksum = hashlib.sha256(data).hexdigest()
                existing = _CONN.execute(
                    "SELECT asset_id FROM voice_assets WHERE checksum = ?",
                    (checksum,),
                ).fetchone()
                if existing is not None:
                    _CONN.execute(
                        "UPDATE voice_import_job_items SET status = ?, detail = ?, checksum = ? WHERE job_id = ? AND item_index = ?",
                        ("duplicate", f"Already imported as {existing['asset_id']}", checksum, job_id, item["index"]),
                    )
                    _CONN.commit()
                    _update_job_counts(job_id, processed_inc=1, duplicate_inc=1)
                    continue

                extension = item["extension"]
                asset_id = str(uuid.uuid4())
                final_path = library_dir / f"{asset_id}.{extension}"
                shutil.move(str(stage_path), str(final_path))
                imported_at = time.time()
                title = Path(item["original_filename"]).stem.replace("_", " ").replace("-", " ").strip() or "Voice Asset"
                _CONN.execute(
                    "INSERT INTO voice_assets (asset_id, checksum, filename, original_filename, title, collection_name, tags_json, "
                    "content_type, extension, size_bytes, storage_path, source, imported_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        asset_id,
                        checksum,
                        final_path.name,
                        item["original_filename"],
                        title[:120],
                        collection_name,
                        json.dumps(tags),
                        item["content_type"],
                        extension,
                        item["size_bytes"],
                        str(final_path),
                        source,
                        imported_at,
                    ),
                )
                _CONN.execute(
                    "UPDATE voice_import_job_items SET status = ?, detail = ?, asset_id = ?, checksum = ? WHERE job_id = ? AND item_index = ?",
                    ("imported", "Imported successfully.", asset_id, checksum, job_id, item["index"]),
                )
                _CONN.commit()
                _update_job_counts(job_id, processed_inc=1, imported_inc=1)
            except Exception as exc:  # noqa: BLE001
                _CONN.execute(
                    "UPDATE voice_import_job_items SET status = ?, detail = ? WHERE job_id = ? AND item_index = ?",
                    ("failed", str(exc)[:300], job_id, item["index"]),
                )
                _CONN.commit()
                _update_job_counts(job_id, processed_inc=1, failed_inc=1)
        final = _job_summary(job_id)
        if final is not None:
            final_status = "completed" if final["failedFiles"] == 0 else "completed_with_errors"
            _update_job_counts(job_id, status=final_status)
    except Exception as exc:  # noqa: BLE001
        _update_job_counts(job_id, status="failed", error=str(exc)[:300])
    finally:
        for item in staged_files:
            try:
                Path(item["stage_path"]).unlink(missing_ok=True)
            except OSError:
                pass
        try:
            job_stage_dir = _STAGING_ROOT / job_id
            if job_stage_dir.exists():
                shutil.rmtree(job_stage_dir, ignore_errors=True)
        except OSError:
            pass


def start_voice_import(
    files: list[dict[str, Any]],
    *,
    collection_name: str = "",
    tags: list[str] | None = None,
    source: str = "upload",
) -> dict[str, Any]:
    normalized_tags = _normalize_tags(tags)
    collection_name = collection_name.strip()[:120]
    job_id = str(uuid.uuid4())
    created_at = time.time()
    stage_dir = _STAGING_ROOT / job_id
    stage_dir.mkdir(parents=True, exist_ok=True)

    staged_files: list[dict[str, Any]] = []
    with _LOCK:
        _CONN.execute(
            "INSERT INTO voice_import_jobs (job_id, status, total_files, processed_files, imported_files, duplicate_files, "
            "failed_files, error, collection_name, tags_json, created_at, updated_at) "
            "VALUES (?, ?, ?, 0, 0, 0, 0, '', ?, ?, ?, ?)",
            (
                job_id,
                "queued",
                len(files),
                collection_name,
                json.dumps(normalized_tags),
                created_at,
                created_at,
            ),
        )
        for index, item in enumerate(files):
            safe_name = _sanitize_filename(item["filename"], f"voice-{index}.{item['extension']}")
            stage_path = stage_dir / f"{index:04d}-{safe_name}"
            stage_path.write_bytes(item["content"])
            staged = {
                "index": index,
                "original_filename": safe_name,
                "content_type": item["content_type"],
                "size_bytes": item["size_bytes"],
                "extension": item["extension"],
                "stage_path": str(stage_path),
            }
            staged_files.append(staged)
            _CONN.execute(
                "INSERT INTO voice_import_job_items (job_id, item_index, original_filename, status, size_bytes) VALUES (?, ?, ?, ?, ?)",
                (job_id, index, safe_name, "queued", item["size_bytes"]),
            )
        _CONN.commit()

    thread = threading.Thread(
        target=_process_import_job,
        args=(job_id, staged_files, collection_name, normalized_tags, source),
        daemon=True,
        name=f"voice-import-{job_id[:8]}",
    )
    thread.start()
    return get_voice_import_job(job_id) or {"jobId": job_id, "status": "queued"}


def validate_voice_upload(filename: str, content_type: str, size_bytes: int) -> tuple[bool, str | None, str | None]:
    extension = _detect_extension(filename, content_type)
    if extension is None:
        return False, None, "Unsupported audio file type."
    if size_bytes <= 0:
        return False, None, "Audio file is empty."
    if size_bytes > 100 * 1024 * 1024:
        return False, None, "Audio file too large — maximum 100 MB per file."
    return True, extension, None


def get_voice_import_job(job_id: str) -> dict[str, Any] | None:
    return _job_summary(job_id)


def list_voice_assets(
    *,
    page: int = 1,
    page_size: int = 25,
    query: str = "",
    collection_name: str = "",
    tag: str = "",
) -> dict[str, Any]:
    page = max(page, 1)
    page_size = max(1, min(page_size, 100))
    clauses: list[str] = []
    params: list[Any] = []
    if query.strip():
        clauses.append("(LOWER(title) LIKE ? OR LOWER(original_filename) LIKE ?)")
        like = f"%{query.strip().lower()}%"
        params.extend([like, like])
    if collection_name.strip():
        clauses.append("LOWER(collection_name) = ?")
        params.append(collection_name.strip().lower())
    if tag.strip():
        clauses.append("LOWER(tags_json) LIKE ?")
        params.append(f"%\"{tag.strip().lower()}\"%")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    count_row = _CONN.execute(
        f"SELECT COUNT(*) AS total FROM voice_assets {where}",
        params,
    ).fetchone()
    total = int(count_row["total"]) if count_row is not None else 0
    rows = _CONN.execute(
        f"SELECT * FROM voice_assets {where} ORDER BY imported_at DESC LIMIT ? OFFSET ?",
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()
    collections = _CONN.execute(
        "SELECT collection_name, COUNT(*) AS total FROM voice_assets WHERE collection_name != '' GROUP BY collection_name ORDER BY collection_name ASC"
    ).fetchall()
    return {
        "items": [_asset_summary(row) for row in rows],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "hasMore": page * page_size < total,
        "collections": [{"name": row["collection_name"], "total": row["total"]} for row in collections],
    }


def get_voice_asset(asset_id: str) -> dict[str, Any] | None:
    row = _CONN.execute("SELECT * FROM voice_assets WHERE asset_id = ?", (asset_id,)).fetchone()
    return _asset_summary(row) if row is not None else None


def get_voice_asset_path(asset_id: str) -> Path | None:
    row = _CONN.execute("SELECT storage_path FROM voice_assets WHERE asset_id = ?", (asset_id,)).fetchone()
    if row is None:
        return None
    path = Path(row["storage_path"])
    return path if path.exists() else None
