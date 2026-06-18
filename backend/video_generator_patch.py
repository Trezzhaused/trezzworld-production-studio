"""
Video Generator Patch — AI Image/Video Generator Router
Replaces the blue-background Pillow fallback with real AI generation.

Routing priority per production type:
  cinematic    → Stable Diffusion XL (SDXL) → Wan 2.2 → Kling
  3d           → Stable Diffusion 3 → SDXL → Wan
  surreal      → Stable Diffusion (DreamShaper) → SDXL
  animated     → Stable Diffusion (Anything V5 / toonyou) → SDXL
  slideshow    → SDXL base → SD 1.5
  standard     → SDXL → SD 1.5

HuggingFace Inference API endpoints used (free tier):
  SDXL:   stabilityai/stable-diffusion-xl-base-1.0
  SD3:    stabilityai/stable-diffusion-3-medium-diffusers
  SDXL-R: stabilityai/stable-diffusion-xl-refiner-1.0

Wan/Kling/fal.ai: uses existing env keys (FAL_KEY)
"""
from __future__ import annotations

import base64
import io
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# ── HuggingFace endpoints per production type ──────────────────────────────────

_SD_MODELS: dict[str, dict[str, str]] = {
    "cinematic": {
        "primary":  "stabilityai/stable-diffusion-xl-base-1.0",
        "fallback": "runwayml/stable-diffusion-v1-5",
        "style_suffix": "cinematic photography, film still, anamorphic lens, golden hour, dramatic lighting, shallow depth of field, 8K UHD, photorealistic",
    },
    "3d": {
        "primary":  "stabilityai/stable-diffusion-3-medium-diffusers",
        "fallback": "stabilityai/stable-diffusion-xl-base-1.0",
        "style_suffix": "3D render, octane render, physically based rendering, studio lighting, ultra detailed, 8K resolution, hyperrealistic",
    },
    "surreal": {
        "primary":  "stabilityai/stable-diffusion-xl-base-1.0",
        "fallback": "runwayml/stable-diffusion-v1-5",
        "style_suffix": "surrealist art, dreamlike, Salvador Dali style, impossible architecture, vivid colors, fantastical atmosphere",
    },
    "animated": {
        "primary":  "stablediffusionapi/anything-v5",
        "fallback": "stabilityai/stable-diffusion-xl-base-1.0",
        "style_suffix": "anime style, cel shading, vibrant colors, clean linework, Studio Ghibli inspired, animated film quality",
    },
    "slideshow": {
        "primary":  "stabilityai/stable-diffusion-xl-base-1.0",
        "fallback": "runwayml/stable-diffusion-v1-5",
        "style_suffix": "professional photography, clean composition, high resolution, crisp detail",
    },
    "standard": {
        "primary":  "stabilityai/stable-diffusion-xl-base-1.0",
        "fallback": "runwayml/stable-diffusion-v1-5",
        "style_suffix": "professional quality, detailed, high resolution",
    },
    "documentary": {
        "primary":  "stabilityai/stable-diffusion-xl-base-1.0",
        "fallback": "runwayml/stable-diffusion-v1-5",
        "style_suffix": "documentary photography, photojournalism style, natural lighting, candid, realistic",
    },
}

# Hugging Face retired the legacy api-inference.huggingface.co domain (it no longer
# resolves at all — confirmed via direct DNS/connection test) in favor of routing
# through Inference Providers. "hf-inference" is HF's own first-party provider.
_HF_BASE = "https://router.huggingface.co/hf-inference/models"

_NEGATIVE_PROMPTS: dict[str, str] = {
    "cinematic":   "cartoon, anime, painting, illustration, blurry, low quality, text, watermark, oversaturated",
    "3d":          "2D, flat, cartoon, sketch, painting, blurry, low poly, watermark",
    "surreal":     "realistic photo, boring, mundane, low quality, watermark",
    "animated":    "realistic, photographic, 3D render, low quality, watermark, blurry",
    "slideshow":   "cartoon, anime, blurry, low quality, overexposed, watermark",
    "standard":    "blurry, low quality, watermark, text, distorted",
    "documentary": "cartoon, painting, illustration, oversaturated, watermark",
}


def _get_hf_token() -> str | None:
    """Get HuggingFace API token."""
    token = os.environ.get("HUGGINGFACE_API_KEY") or os.environ.get("HF_API_KEY")
    if token:
        return token
    try:
        from .user_key_store import get_user_key_store  # noqa: PLC0415
        return get_user_key_store().get_key("huggingface")
    except Exception:
        return None


def _get_fal_key() -> str | None:
    """Get fal.ai API key for Wan/Kling."""
    key = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
    if key:
        return key
    try:
        from .user_key_store import get_user_key_store  # noqa: PLC0415
        return get_user_key_store().get_key("fal")
    except Exception:
        return None


# ── Stable Diffusion via HuggingFace ─────────────────────────────────────────

def _call_sd_hf(
    model_id: str,
    prompt: str,
    negative_prompt: str,
    width: int = 1024,
    height: int = 576,
    hf_token: str | None = None,
) -> tuple[bytes | None, str]:
    """
    Call HuggingFace Inference API for Stable Diffusion image generation.
    Returns (raw PNG bytes or None, diagnostic reason on failure).
    """
    api_url = f"{_HF_BASE}/{model_id}"
    payload = json.dumps({
        "inputs": prompt,
        "parameters": {
            "negative_prompt": negative_prompt,
            "width": min(width, 1024),
            "height": min(height, 1024),
            "num_inference_steps": 50,
            "guidance_scale": 8.5,
        },
    }).encode("utf-8")

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    req = urllib.request.Request(api_url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            # HF returns image bytes directly for image models
            if raw and len(raw) > 1000 and (
                raw[:4] == b"\x89PNG" or raw[:3] == b"\xff\xd8\xff"
            ):
                return raw, ""
            # Some models return JSON with base64
            if b"image" in raw[:500].lower():
                try:
                    data = json.loads(raw)
                    if isinstance(data, list) and data:
                        b64 = data[0].get("generated_image") or data[0].get("image")
                        if b64:
                            return base64.b64decode(b64), ""
                except Exception:
                    pass
            if raw and len(raw) > 1000:
                return raw, ""
            return None, f"HF {model_id}: response too small/unrecognized ({len(raw)} bytes): {raw[:200]!r}"
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        if exc.code == 503:
            # Model loading — wait and retry once
            time.sleep(25)
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    raw = resp.read()
                    if raw and len(raw) > 1000:
                        return raw, ""
                    return None, f"HF {model_id}: still loading after retry ({body})"
            except urllib.error.HTTPError as exc2:
                return None, f"HF {model_id}: HTTP {exc2.code} on retry: {exc2.read().decode('utf-8', errors='replace')[:300]}"
            except Exception as exc2:
                return None, f"HF {model_id}: retry failed: {exc2}"
        return None, f"HF {model_id}: HTTP {exc.code}: {body}"
    except urllib.error.URLError as exc:
        return None, f"HF {model_id}: network error: {exc}"
    except Exception as exc:
        return None, f"HF {model_id}: {exc}"


# ── Wan 2.2 via fal.ai ───────────────────────────────────────────────────────

def _call_wan_fal(
    prompt: str,
    image_size: str = "landscape_16_9",
    num_frames: int = 24,
    fal_key: str | None = None,
) -> tuple[bytes | None, str]:
    """
    Generate video frame via Wan 2.2 text-to-video on fal.ai.
    Returns (first frame as image bytes or None, diagnostic reason on failure).
    Uses fal-ai/wan/t2v-1.3b endpoint.
    """
    if not fal_key:
        return None, "fal.ai: no key configured"

    payload = json.dumps({
        "prompt": prompt,
        "image_size": image_size,
        "num_frames": num_frames,
        "guidance_scale": 7.0,
        "num_inference_steps": 40,
    }).encode("utf-8")

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(
        "https://queue.fal.run/fal-ai/wan/t2v-1.3b",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            request_id = data.get("request_id")
            if not request_id:
                return None, f"fal.ai Wan: submit response had no request_id: {data}"

        status_url = f"https://queue.fal.run/fal-ai/wan/t2v-1.3b/requests/{request_id}/status"
        result_url = f"https://queue.fal.run/fal-ai/wan/t2v-1.3b/requests/{request_id}"

        for _ in range(30):  # max 5 min polling
            time.sleep(10)
            status_req = urllib.request.Request(status_url, headers=headers)
            with urllib.request.urlopen(status_req, timeout=15) as resp:
                status_data = json.loads(resp.read())
                if status_data.get("status") == "COMPLETED":
                    result_req = urllib.request.Request(result_url, headers=headers)
                    with urllib.request.urlopen(result_req, timeout=30) as resp:
                        result_data = json.loads(resp.read())
                        video_url = result_data.get("video", {}).get("url")
                        if video_url:
                            with urllib.request.urlopen(video_url, timeout=60) as vresp:
                                return vresp.read(), ""
                        return None, f"fal.ai Wan: completed but no video URL: {result_data}"
                elif status_data.get("status") == "FAILED":
                    return None, f"fal.ai Wan: job failed: {status_data}"
        return None, "fal.ai Wan: polling timed out after 5 minutes"
    except urllib.error.HTTPError as exc:
        return None, f"fal.ai Wan: HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')[:300]}"
    except Exception as exc:
        return None, f"fal.ai Wan: {exc}"


# ── Kling via fal.ai ──────────────────────────────────────────────────────────

def _call_kling_fal(
    prompt: str,
    duration: str = "5",
    aspect_ratio: str = "16:9",
    fal_key: str | None = None,
) -> tuple[bytes | None, str]:
    """
    Generate video via Kling 2.1 on fal.ai.
    Returns (video bytes or None, diagnostic reason on failure).
    """
    if not fal_key:
        return None, "fal.ai: no key configured"

    payload = json.dumps({
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
        # Must match the endpoint path below ("standard") — a prior change set
        # this to "pro" while the URL still pointed at the standard endpoint,
        # a mismatch that fal.ai likely rejected outright.
        "mode": "standard",
    }).encode("utf-8")

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(
        "https://queue.fal.run/fal-ai/kling-video/v2.1/standard/text-to-video",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            request_id = data.get("request_id")
            if not request_id:
                return None, f"fal.ai Kling: submit response had no request_id: {data}"

        status_url = f"https://queue.fal.run/fal-ai/kling-video/v2.1/standard/text-to-video/requests/{request_id}/status"
        result_url = f"https://queue.fal.run/fal-ai/kling-video/v2.1/standard/text-to-video/requests/{request_id}"

        for _ in range(36):  # max 6 min
            time.sleep(10)
            status_req = urllib.request.Request(status_url, headers=headers)
            with urllib.request.urlopen(status_req, timeout=15) as resp:
                status_data = json.loads(resp.read())
                if status_data.get("status") == "COMPLETED":
                    result_req = urllib.request.Request(result_url, headers=headers)
                    with urllib.request.urlopen(result_req, timeout=30) as resp:
                        result_data = json.loads(resp.read())
                        videos = result_data.get("video", [])
                        if videos:
                            video_url = videos[0].get("url") if isinstance(videos, list) else videos.get("url")
                            if video_url:
                                with urllib.request.urlopen(video_url, timeout=60) as vresp:
                                    return vresp.read(), ""
                        return None, f"fal.ai Kling: completed but no video URL: {result_data}"
                elif status_data.get("status") == "FAILED":
                    return None, f"fal.ai Kling: job failed: {status_data}"
        return None, "fal.ai Kling: polling timed out after 6 minutes"
    except urllib.error.HTTPError as exc:
        return None, f"fal.ai Kling: HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')[:300]}"
    except Exception as exc:
        return None, f"fal.ai Kling: {exc}"


# ── Master generator function ─────────────────────────────────────────────────

def generate_scene_image_ai(
    scene: dict[str, Any],
    title: str,
    style: str,
    resolution: tuple[int, int],
    target_path: Path,
) -> tuple[bool, str]:
    """
    Generate a photorealistic scene image using the best available AI generator.

    Priority:
      1. Stable Diffusion (HuggingFace) — primary for stills
      2. Wan 2.2 (fal.ai) — if fal key available and SD fails
      3. Kling 2.1 (fal.ai) — if Wan fails
      4. Returns (False, diagnostic) — caller falls back to Pillow renderer

    Args:
        scene: Scene dict with visual_description, title, camera_motion, color_grade
        title: Project title
        style: Production type (cinematic, 3d, surreal, animated, slideshow, standard)
        resolution: (width, height) tuple
        target_path: Where to save the PNG

    Returns:
        (True, "") if image was saved successfully, (False, reason) otherwise.
    """
    hf_token = _get_hf_token()
    fal_key = _get_fal_key()

    if not hf_token and not fal_key:
        return False, "No image generation API key configured — add a Hugging Face or fal.ai key in Settings."

    style_lower = style.lower()
    model_config = _SD_MODELS.get(style_lower, _SD_MODELS["standard"])

    # Build the prompt
    visual = scene.get("visual_description", "").strip()
    camera = scene.get("camera_motion", "static shot")
    color = scene.get("color_grade", "cinematic")
    scene_title = scene.get("title", "")

    base_prompt = (
        f"{visual}, {title}, {scene_title}, "
        f"{camera}, {color} color grade, "
        f"{model_config['style_suffix']}"
    )
    negative = _NEGATIVE_PROMPTS.get(style_lower, _NEGATIVE_PROMPTS["standard"])

    w, h = resolution
    # SD works best at 1024x1024 or specific aspect ratios — use closest
    if w > h:
        sd_w, sd_h = 1024, 576
    elif h > w:
        sd_w, sd_h = 576, 1024
    else:
        sd_w, sd_h = 1024, 1024

    errors: list[str] = []

    # ── Attempt 1: Stable Diffusion primary model ──────────────────────────
    if hf_token:
        image_bytes, err = _call_sd_hf(model_config["primary"], base_prompt, negative, sd_w, sd_h, hf_token)
        if image_bytes and _save_image_to_path(image_bytes, target_path, resolution):
            return True, ""
        if err:
            errors.append(err)

        # ── Attempt 2: SD fallback model ──────────────────────────────────
        image_bytes, err = _call_sd_hf(model_config["fallback"], base_prompt, negative, sd_w, sd_h, hf_token)
        if image_bytes and _save_image_to_path(image_bytes, target_path, resolution):
            return True, ""
        if err:
            errors.append(err)

    # ── Attempt 3: Wan 2.2 via fal.ai ─────────────────────────────────────
    if fal_key:
        aspect = "landscape_16_9" if w >= h else "portrait_16_9"
        wan_bytes, wan_err = _call_wan_fal(base_prompt, image_size=aspect, fal_key=fal_key)
        if wan_bytes and _save_image_to_path(wan_bytes, target_path, resolution):
            return True, ""
        if wan_err:
            errors.append(wan_err)

        # ── Attempt 4: Kling 2.1 via fal.ai ──────────────────────────────
        kling_ratio = "16:9" if w >= h else "9:16"
        kling_bytes, kling_err = _call_kling_fal(base_prompt, aspect_ratio=kling_ratio, fal_key=fal_key)
        if kling_bytes and _save_image_to_path(kling_bytes, target_path, resolution):
            return True, ""
        if kling_err:
            errors.append(kling_err)

    return False, " | ".join(errors) if errors else "No image generator produced a usable result."


def _save_image_to_path(
    image_bytes: bytes,
    target_path: Path,
    resolution: tuple[int, int],
) -> bool:
    """Save image bytes to target path, resizing to resolution via Pillow."""
    try:
        from PIL import Image  # type: ignore
        import io as _io

        img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        w, h = resolution
        src_w, src_h = img.size
        target_ratio = w / h
        src_ratio = src_w / src_h

        # Crop to target aspect ratio
        if abs(src_ratio - target_ratio) > 0.01:
            if src_ratio > target_ratio:
                new_w = int(src_h * target_ratio)
                left = (src_w - new_w) // 2
                img = img.crop((left, 0, left + new_w, src_h))
            else:
                new_h = int(src_w / target_ratio)
                top = (src_h - new_h) // 2
                img = img.crop((0, top, src_w, top + new_h))

        img = img.resize((w, h), Image.LANCZOS)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(target_path, "PNG")
        return True
    except ImportError:
        # Pillow not available — save raw bytes
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_bytes(image_bytes)
            return True
        except Exception:
            return False
    except Exception:
        return False


def get_available_generators() -> dict[str, bool]:
    """Return which generators are currently available based on configured keys."""
    hf_token = _get_hf_token()
    fal_key = _get_fal_key()
    return {
        "stable_diffusion": hf_token is not None,
        "wan": fal_key is not None,
        "kling": fal_key is not None,
        "huggingface_token_configured": hf_token is not None,
        "fal_key_configured": fal_key is not None,
    }


def get_production_styles() -> list[dict[str, Any]]:
    """Return all supported production styles for frontend tabs."""
    return [
        {"id": "cinematic",  "label": "Cinematic",        "description": "Film-quality photorealistic cinematography", "icon": "🎬"},
        {"id": "3d",         "label": "3D",               "description": "Photorealistic 3D rendered visuals",          "icon": "🎲"},
        {"id": "surreal",    "label": "Surreal / Fantasy", "description": "Dreamlike and fantastical imagery",           "icon": "🌀"},
        {"id": "animated",   "label": "Animated",          "description": "Anime and cartoon style animation",           "icon": "✏️"},
        {"id": "slideshow",  "label": "Slideshow",         "description": "Clean photo slideshow presentation",          "icon": "🖼️"},
        {"id": "standard",   "label": "Standard",          "description": "General purpose video production",            "icon": "▶️"},
        {"id": "documentary","label": "Documentary",       "description": "Cinéma vérité documentary style",             "icon": "📷"},
    ]
