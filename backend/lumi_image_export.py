"""
LUMI Image Export — gives the LUMI chat tab a real file-producing capability.

Without this, LUMI's chat model would just describe an image in text and
sometimes hallucinate having "attached" or "generated" a file it never
produced (pure chat completion APIs can't attach files on their own). This
module detects when a chat message is asking for visual output and routes
it through the same image-generation pipeline the Video Studio uses
(Stable Diffusion via HuggingFace, Wan/Kling via fal.ai, or OpenAI), so the
user gets back a real downloadable PNG instead of a false claim.
"""
from __future__ import annotations

import os
import re
import tempfile
import uuid
from pathlib import Path

EXPORTS_DIR = Path(os.environ.get("LUMI_EXPORT_DIR", "/tmp/trezzworld/exports/lumi"))

_VISUAL_INTENT_RE = re.compile(
    r"\b(image|logo|flyer|banner|poster|graphic|picture|photo|illustration|"
    r"thumbnail|icon|business\s*card|ad|advertisement|design\s+(a|an|me)|"
    r"draw|render|mockup|cover\s+art|artwork)\b",
    re.IGNORECASE,
)


def wants_visual_output(message: str) -> bool:
    """Heuristic: does this chat message ask LUMI to produce a visual artifact?"""
    return bool(_VISUAL_INTENT_RE.search(message))


def _resolve_export_dir() -> Path:
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = EXPORTS_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "lumi"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def has_image_credentials() -> bool:
    from .video_generator_patch import _get_hf_token, _get_fal_key  # noqa: PLC0415
    from .user_key_store import get_user_key_store  # noqa: PLC0415

    if _get_hf_token() or _get_fal_key():
        return True
    return bool(os.environ.get("OPENAI_API_KEY") or get_user_key_store().get_key("openai"))


def generate_lumi_image(prompt: str) -> tuple[str | None, str]:
    """
    Generate a real image for a LUMI chat request. Returns (image id for the
    download endpoint, or None; diagnostic reason on failure) — mirrors the
    Video Studio's pattern so a failure here is just as debuggable as a
    video-frame failure.
    """
    from .video_generator_patch import generate_scene_image_ai  # noqa: PLC0415

    export_dir = _resolve_export_dir()
    job_id = str(uuid.uuid4())
    target_path = export_dir / f"{job_id}.png"

    scene = {"title": "LUMI Chat Image", "visual_description": prompt, "camera_motion": "static shot", "color_grade": "cinematic"}
    ok, reason = generate_scene_image_ai(scene, "LUMI", "standard", (1024, 1024), target_path)
    if ok:
        return job_id, ""
    return None, reason


def get_image_path(job_id: str) -> Path | None:
    p = _resolve_export_dir() / f"{job_id}.png"
    return p if p.exists() else None
