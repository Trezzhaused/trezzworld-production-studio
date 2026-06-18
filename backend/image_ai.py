"""
Image AI — Real photographic image generation for TrezzWorld Production Studio.

Provider cascade (tried in order):
  1. AUTOMATIC1111 (local Stable Diffusion WebUI) — http://localhost:7860
  2. HuggingFace Inference API — FLUX.1-dev / SDXL / SD3 (free tier, HF_API_KEY)
  3. Replicate API — FLUX.1-dev / SDXL (REPLICATE_API_TOKEN)
  4. fal.ai API — FLUX / SDXL (FAL_KEY)

Returns raw image bytes (PNG/JPEG) so the video pipeline can save frames directly.

Usage:
    from .image_ai import generate_scene_image, is_image_ai_available
    result = generate_scene_image("epic cinematic shot of ...", width=1920, height=1080)
    if result.ok:
        Path("frame.png").write_bytes(result.image_bytes)
"""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


# ---------------------------------------------------------------------------
# Config — pulled from env vars
# ---------------------------------------------------------------------------

_HF_API_KEY          = os.getenv("HF_API_KEY", "")
_REPLICATE_TOKEN     = os.getenv("REPLICATE_API_TOKEN", "")
_FAL_KEY             = os.getenv("FAL_KEY", "")
_SD_HOST             = os.getenv("STABLE_DIFFUSION_HOST", "http://localhost:7860")

# HuggingFace model IDs (free inference API)
_HF_IMAGE_MODEL      = os.getenv("HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-dev")
_HF_FALLBACK_MODEL   = "stabilityai/stable-diffusion-xl-base-1.0"

# Replicate model IDs
_REPLICATE_IMAGE_MODEL = "black-forest-labs/flux-dev"

HF_API_BASE = "https://api-inference.huggingface.co/models"
REPLICATE_API = "https://api.replicate.com/v1/predictions"
FAL_API = "https://fal.run"


@dataclass
class ImageResult:
    ok: bool
    image_bytes: bytes
    format: str          # "png" | "jpeg"
    provider: str
    model: str
    error: str | None = None

    @property
    def is_placeholder(self) -> bool:
        return self.provider == "placeholder"


# ---------------------------------------------------------------------------
# Provider helpers
# ---------------------------------------------------------------------------

def _http_post(url: str, body: dict[str, Any], headers: dict[str, str], timeout: int = 120) -> bytes:
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_get(url: str, headers: dict[str, str], timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ---------------------------------------------------------------------------
# Provider 1: AUTOMATIC1111 local Stable Diffusion WebUI
# ---------------------------------------------------------------------------

def _try_automatic1111(prompt: str, negative_prompt: str, width: int, height: int) -> ImageResult | None:
    """Try to generate via AUTOMATIC1111 txt2img API."""
    url = f"{_SD_HOST}/sdapi/v1/txt2img"
    body: dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": min(width, 1024),
        "height": min(height, 1024),
        "steps": 20,
        "cfg_scale": 7.0,
        "sampler_name": "DPM++ 2M Karras",
    }
    try:
        raw = _http_post(url, body, {"Content-Type": "application/json"}, timeout=120)
        data = json.loads(raw)
        images = data.get("images", [])
        if not images:
            return None
        img_bytes = base64.b64decode(images[0])
        return ImageResult(ok=True, image_bytes=img_bytes, format="png", provider="automatic1111", model="local-sd")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Provider 2: HuggingFace Inference API
# ---------------------------------------------------------------------------

def _try_huggingface(prompt: str, width: int, height: int) -> ImageResult | None:
    """Try HuggingFace Inference API (FLUX.1-dev or SDXL)."""
    if not _HF_API_KEY:
        return None

    for model_id in (_HF_IMAGE_MODEL, _HF_FALLBACK_MODEL):
        url = f"{HF_API_BASE}/{model_id}"
        headers = {
            "Authorization": f"Bearer {_HF_API_KEY}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {
            "inputs": prompt,
            "parameters": {
                "width": min(width, 1024),
                "height": min(height, 1024),
                "num_inference_steps": 20,
                "guidance_scale": 7.5,
            },
        }
        try:
            raw = _http_post(url, body, headers, timeout=120)
            # HuggingFace returns raw image bytes
            if raw and len(raw) > 1000 and raw[:8] in (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff"):
                fmt = "png" if raw[:4] == b"\x89PNG" else "jpeg"
                return ImageResult(ok=True, image_bytes=raw, format=fmt, provider="huggingface", model=model_id)
            # Sometimes returns JSON error
            try:
                err = json.loads(raw)
                if "error" in err:
                    continue
            except Exception:
                pass
        except urllib.error.HTTPError as e:
            if e.code == 503:
                # Model loading — try fallback
                continue
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Provider 3: Replicate
# ---------------------------------------------------------------------------

def _try_replicate(prompt: str, width: int, height: int) -> ImageResult | None:
    """Try Replicate API (FLUX.1-dev or SDXL)."""
    if not _REPLICATE_TOKEN:
        return None

    headers = {
        "Authorization": f"Token {_REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    # Try FLUX.1-dev first, fall back to SDXL
    for model in (_REPLICATE_IMAGE_MODEL, "stability-ai/sdxl"):
        body: dict[str, Any] = {
            "version": "latest",
            "input": {
                "prompt": prompt,
                "width": min(width, 1024),
                "height": min(height, 1024),
                "num_outputs": 1,
                "num_inference_steps": 20,
            },
        }
        try:
            raw = _http_post(
                f"https://api.replicate.com/v1/models/{model}/predictions",
                body, headers, timeout=120,
            )
            data = json.loads(raw)
            # Poll if not done
            prediction_id = data.get("id")
            output = data.get("output")
            status = data.get("status", "")
            poll_count = 0
            while status in ("starting", "processing") and poll_count < 30:
                time.sleep(3)
                poll_raw = _http_get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers, timeout=30,
                )
                data = json.loads(poll_raw)
                status = data.get("status", "")
                output = data.get("output")
                poll_count += 1

            if status == "succeeded" and output:
                url_to_fetch = output[0] if isinstance(output, list) else output
                img_raw = _http_get(url_to_fetch, {}, timeout=30)
                if img_raw and len(img_raw) > 500:
                    fmt = "png" if img_raw[:4] == b"\x89PNG" else "jpeg"
                    return ImageResult(ok=True, image_bytes=img_raw, format=fmt, provider="replicate", model=model)
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Provider 4: fal.ai
# ---------------------------------------------------------------------------

def _try_fal(prompt: str, width: int, height: int) -> ImageResult | None:
    """Try fal.ai Inference API (FLUX.1-dev or SDXL)."""
    if not _FAL_KEY:
        return None

    # fal.ai uses Key prefix in Authorization header
    headers = {
        "Authorization": f"Key {_FAL_KEY}",
        "Content-Type": "application/json",
    }
    # Try fal-ai/flux/dev endpoint
    url = f"{FAL_API}/fal-ai/flux/dev"
    body: dict[str, Any] = {
        "prompt": prompt,
        "image_size": {
            "width": min(width, 1024),
            "height": min(height, 1024),
        },
        "num_inference_steps": 20,
        "num_images": 1,
    }
    try:
        raw = _http_post(url, body, headers, timeout=120)
        data = json.loads(raw)
        images = data.get("images", [])
        if images:
            img_url = images[0].get("url", "")
            if img_url:
                img_raw = _http_get(img_url, {}, timeout=30)
                if img_raw and len(img_raw) > 500:
                    fmt = "png" if img_raw[:4] == b"\x89PNG" else "jpeg"
                    return ImageResult(ok=True, image_bytes=img_raw, format=fmt, provider="fal", model="fal-ai/flux/dev")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_scene_image(
    prompt: str,
    negative_prompt: str = "blurry, low quality, text, watermark, logo, distorted, ugly",
    width: int = 1920,
    height: int = 1080,
) -> ImageResult:
    """
    Generate a photographic image for a video scene.

    Tries providers in order: AUTOMATIC1111 → HuggingFace → Replicate → fal.ai
    Returns a placeholder result if all providers fail.
    """
    # Enrich the prompt for photorealistic output
    full_prompt = (
        f"{prompt}, cinematic photography, photorealistic, 8K UHD, "
        "sharp focus, professional lighting, high detail, film still"
    )

    # Try each provider
    for provider_fn in (_try_automatic1111, _try_huggingface, _try_replicate, _try_fal):
        try:
            if provider_fn is _try_automatic1111:
                result = provider_fn(full_prompt, negative_prompt, width, height)
            else:
                result = provider_fn(full_prompt, width, height)
            if result is not None and result.ok:
                return result
        except Exception:
            continue

    # All providers failed — return a sentinel so caller can use Pillow fallback
    return ImageResult(
        ok=False,
        image_bytes=b"",
        format="png",
        provider="placeholder",
        model="none",
        error="All image AI providers unavailable. Check HF_API_KEY, REPLICATE_API_TOKEN, or FAL_KEY.",
    )


def is_image_ai_available() -> bool:
    """Return True if at least one image generation provider is configured."""
    return bool(_HF_API_KEY or _REPLICATE_TOKEN or _FAL_KEY)


def get_provider_status() -> dict[str, Any]:
    """Return availability status of all image AI providers."""
    return {
        "automatic1111": {
            "configured": True,
            "host": _SD_HOST,
            "note": "Requires local AUTOMATIC1111 / Stable Diffusion WebUI running at STABLE_DIFFUSION_HOST",
        },
        "huggingface": {
            "configured": bool(_HF_API_KEY),
            "model": _HF_IMAGE_MODEL,
            "note": "Set HF_API_KEY env var. Free tier available at huggingface.co/settings/tokens",
        },
        "replicate": {
            "configured": bool(_REPLICATE_TOKEN),
            "model": _REPLICATE_IMAGE_MODEL,
            "note": "Set REPLICATE_API_TOKEN env var. Get key at replicate.com/account/api-tokens",
        },
        "fal": {
            "configured": bool(_FAL_KEY),
            "model": "fal-ai/flux/dev",
            "note": "Set FAL_KEY env var. Get key at fal.ai/dashboard/keys",
        },
        "anyAvailable": is_image_ai_available(),
    }
