"""
Video AI — Real AI video clip generation for TrezzWorld Production Studio.

Provider cascade:
  1. Replicate — wan-video/wan2.1-t2v-480p, stability-ai/stable-video-diffusion
  2. fal.ai    — fal-ai/wan-t2v, fal-ai/cogvideox-5b
  3. RunwayML  — gen-3-alpha (RUNWAY_API_KEY)

Integrates with video_creator.py to produce photographic scene clips
instead of Pillow-rendered text frames.

Usage:
    from .video_ai import generate_video_clip, is_video_ai_available
    result = await_generate_video_clip("epic battle scene, cinematic", duration=5)
    if result.ok:
        Path("scene.mp4").write_bytes(result.video_bytes)
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
_FAL_KEY         = os.getenv("FAL_KEY", "")
_RUNWAY_KEY      = os.getenv("RUNWAY_API_KEY", "")

REPLICATE_API = "https://api.replicate.com/v1"
FAL_API       = "https://fal.run"

# Replicate model IDs for video generation
_REPLICATE_VIDEO_MODELS = [
    "wan-video/wan2.1-t2v-480p",          # Wan2.1 — best open text-to-video
    "wan-video/wan2.1-t2v-720p",          # Wan2.1 HD
    "stability-ai/stable-video-diffusion", # SVD — image-to-video
    "lucataco/cogvideox-5b",               # CogVideoX
    "anotherjesse/zeroscope-v2-xl",        # ZeroScope v2
]

# fal.ai model IDs
_FAL_VIDEO_MODELS = [
    "fal-ai/wan-t2v",                      # Wan2.1 on fal.ai
    "fal-ai/cogvideox-5b",                 # CogVideoX on fal.ai
    "fal-ai/animatediff-v2v",              # AnimateDiff
]


@dataclass
class VideoClipResult:
    ok: bool
    video_bytes: bytes
    provider: str
    model: str
    format: str = "mp4"
    error: str | None = None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _http_post(url: str, body: dict, headers: dict, timeout: int = 180) -> bytes:
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_get(url: str, headers: dict | None = None, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _poll_replicate(prediction_id: str, token: str, max_wait: int = 300) -> dict:
    """Poll a Replicate prediction until done or timeout."""
    auth_prefix = "Token"
    headers = {"Authorization": f"{auth_prefix} {token}"}
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(4)
        raw = _http_get(f"{REPLICATE_API}/predictions/{prediction_id}", headers)
        data = json.loads(raw)
        status = data.get("status", "")
        if status in ("succeeded", "failed", "canceled"):
            return data
    return {"status": "timeout"}


# ---------------------------------------------------------------------------
# Provider 1: Replicate
# ---------------------------------------------------------------------------

def _try_replicate_video(
    prompt: str,
    duration_seconds: int,
    width: int,
    height: int,
) -> VideoClipResult | None:
    """Generate a video clip via Replicate."""
    if not _REPLICATE_TOKEN:
        return None

    auth_prefix = "Token"
    headers = {
        "Authorization": f"{auth_prefix} {_REPLICATE_TOKEN}",
        "Content-Type": "application/json",
    }

    for model in _REPLICATE_VIDEO_MODELS:
        # Build model-specific input
        if "wan" in model:
            body_input: dict[str, Any] = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 81),  # Wan2.1 max 81 frames
                "fps": 8,
                "width": min(width, 832),
                "height": min(height, 480),
                "guidance_scale": 6.0,
                "num_inference_steps": 40,
            }
        elif "cogvideo" in model:
            body_input = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 49),
                "fps": 8,
                "num_inference_steps": 50,
                "guidance_scale": 6.0,
            }
        elif "zeroscope" in model:
            body_input = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 36),
                "fps": 8,
                "width": min(width, 1024),
                "height": min(height, 576),
                "num_inference_steps": 40,
            }
        else:
            continue

        try:
            raw = _http_post(
                f"{REPLICATE_API}/models/{model}/predictions",
                {"input": body_input},
                headers,
                timeout=30,
            )
            data = json.loads(raw)
            prediction_id = data.get("id")
            if not prediction_id:
                continue

            # Poll for result
            result = _poll_replicate(prediction_id, _REPLICATE_TOKEN, max_wait=300)
            if result.get("status") == "succeeded":
                output = result.get("output")
                video_url = output if isinstance(output, str) else (output[0] if isinstance(output, list) else None)
                if video_url:
                    video_bytes = _http_get(video_url, {}, timeout=60)
                    if video_bytes and len(video_bytes) > 1024:
                        return VideoClipResult(ok=True, video_bytes=video_bytes, provider="replicate", model=model)
        except Exception:
            continue

    return None


# ---------------------------------------------------------------------------
# Provider 2: fal.ai
# ---------------------------------------------------------------------------

def _try_fal_video(
    prompt: str,
    duration_seconds: int,
    width: int,
    height: int,
) -> VideoClipResult | None:
    """Generate a video clip via fal.ai."""
    if not _FAL_KEY:
        return None

    headers = {
        "Authorization": f"Key {_FAL_KEY}",
        "Content-Type": "application/json",
    }

    for model_path in _FAL_VIDEO_MODELS:
        if "wan" in model_path:
            body: dict[str, Any] = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 81),
                "fps": 8,
                "resolution": f"{min(width, 832)}x{min(height, 480)}",
                "num_inference_steps": 40,
            }
        elif "cogvideo" in model_path:
            body = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 49),
                "num_inference_steps": 50,
            }
        else:
            body = {
                "prompt": prompt,
                "num_frames": min(duration_seconds * 8, 16),
            }

        url = f"{FAL_API}/{model_path}"
        try:
            raw = _http_post(url, body, headers, timeout=300)
            data = json.loads(raw)
            video = data.get("video", {})
            video_url = video.get("url") or data.get("video_url", "")
            if video_url:
                video_bytes = _http_get(video_url, {}, timeout=60)
                if video_bytes and len(video_bytes) > 1024:
                    return VideoClipResult(ok=True, video_bytes=video_bytes, provider="fal", model=model_path)
        except Exception:
            continue

    return None


# ---------------------------------------------------------------------------
# Provider 3: RunwayML Gen-3
# ---------------------------------------------------------------------------

def _try_runway_video(
    prompt: str,
    duration_seconds: int,
    width: int,
    height: int,
) -> VideoClipResult | None:
    """Generate a video clip via RunwayML Gen-3."""
    if not _RUNWAY_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {_RUNWAY_KEY}",
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
    }
    body: dict[str, Any] = {
        "promptText": prompt,
        "model": "gen3a_turbo",
        "duration": min(duration_seconds, 10),   # Runway max 10s
        "ratio": "1280:720" if width > height else "720:1280",
        "watermark": False,
    }
    try:
        raw = _http_post("https://api.dev.runwayml.com/v1/image_to_video", body, headers, timeout=30)
        data = json.loads(raw)
        task_id = data.get("id")
        if not task_id:
            return None

        # Poll until done
        poll_headers = {**headers}
        deadline = time.time() + 300
        while time.time() < deadline:
            time.sleep(5)
            poll_raw = _http_get(f"https://api.dev.runwayml.com/v1/tasks/{task_id}", poll_headers)
            poll_data = json.loads(poll_raw)
            progress_status = poll_data.get("status", "")
            if progress_status == "SUCCEEDED":
                output = poll_data.get("output", [])
                video_url = output[0] if output else ""
                if video_url:
                    video_bytes = _http_get(video_url, {}, timeout=60)
                    if video_bytes and len(video_bytes) > 1024:
                        return VideoClipResult(ok=True, video_bytes=video_bytes, provider="runway", model="gen3a_turbo")
                break
            if progress_status in ("FAILED", "CANCELLED"):
                break
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_video_clip(
    prompt: str,
    duration_seconds: int = 5,
    width: int = 1280,
    height: int = 720,
) -> VideoClipResult:
    """
    Generate a short AI video clip for a scene.

    Tries providers in order: Replicate → fal.ai → RunwayML
    Returns a failed result if all providers are unavailable.

    Note: AI video generation takes 1–5 minutes per clip.
    For longer videos, call this per-scene and concatenate with FFmpeg.
    """
    full_prompt = (
        f"{prompt}, cinematic, photorealistic, high quality, "
        "professional cinematography, smooth camera motion, "
        "8K resolution, film grain, shallow depth of field"
    )

    for provider_fn in (_try_replicate_video, _try_fal_video, _try_runway_video):
        try:
            result = provider_fn(full_prompt, duration_seconds, width, height)
            if result is not None and result.ok:
                return result
        except Exception:
            continue

    return VideoClipResult(
        ok=False,
        video_bytes=b"",
        provider="none",
        model="none",
        error=(
            "No AI video provider available. "
            "Set REPLICATE_API_TOKEN, FAL_KEY, or RUNWAY_API_KEY in backend/.env. "
            "Falling back to Pillow frame rendering."
        ),
    )


def is_video_ai_available() -> bool:
    """Return True if at least one video AI provider is configured."""
    return bool(_REPLICATE_TOKEN or _FAL_KEY or _RUNWAY_KEY)


def get_provider_status() -> dict[str, Any]:
    return {
        "replicate": {
            "configured": bool(_REPLICATE_TOKEN),
            "models": _REPLICATE_VIDEO_MODELS,
            "bestModel": "wan-video/wan2.1-t2v-480p",
            "note": "Set REPLICATE_API_TOKEN. Wan2.1 is the best open-source text-to-video model.",
        },
        "fal": {
            "configured": bool(_FAL_KEY),
            "models": _FAL_VIDEO_MODELS,
            "bestModel": "fal-ai/wan-t2v",
            "note": "Set FAL_KEY. Fast inference, pay-per-use.",
        },
        "runway": {
            "configured": bool(_RUNWAY_KEY),
            "model": "gen3a_turbo",
            "note": "Set RUNWAY_API_KEY. Best for cinematic video, 5-10s clips.",
        },
        "anyAvailable": is_video_ai_available(),
    }
