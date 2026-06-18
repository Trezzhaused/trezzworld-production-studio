"""
Music AI — Real audio generation for TrezzWorld Production Studio.

Provider cascade (tried in order):
  1. HuggingFace Inference API — facebook/musicgen-small/medium/large (free, HF_API_KEY)
  2. Replicate API — meta/musicgen, suno-ai/bark (REPLICATE_API_TOKEN)
  3. Returns a detailed production brief (text) as graceful fallback

Generated audio is stored in exports/music/ and served via download endpoint.

HuggingFace MusicGen models:
  - facebook/musicgen-small   (300M params, fast, free)
  - facebook/musicgen-medium  (1.5B params, better quality)
  - facebook/musicgen-large   (3.3B params, best quality)
  - facebook/musicgen-stereo-small (stereo output)

Usage:
    from .music_ai import create_music_job, get_music_job
    job = create_music_job("epic cinematic orchestral theme", duration_seconds=30)
    # poll job.status until "done"
    # download via job.output_path
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_HF_API_KEY          = os.getenv("HF_API_KEY", "")
_REPLICATE_TOKEN     = os.getenv("REPLICATE_API_TOKEN", "")

# HuggingFace model selection (ordered by quality)
_HF_MUSIC_MODELS = [
    "facebook/musicgen-stereo-small",
    "facebook/musicgen-small",
    "facebook/musicgen-medium",
    "facebook/musicgen-stereo-medium",
]
_HF_MUSIC_MODEL = os.getenv("HF_MUSIC_MODEL", "facebook/musicgen-stereo-small")

HF_API_BASE    = "https://api-inference.huggingface.co/models"
REPLICATE_API  = "https://api.replicate.com/v1"

EXPORTS_DIR = Path("exports/music")
MAX_DURATION = 300   # 5 minutes hard cap for music generation
DEFAULT_DURATION = 30


# ---------------------------------------------------------------------------
# Job model
# ---------------------------------------------------------------------------

_JOBS: dict[str, "MusicJob"] = {}
_LOCK = threading.Lock()


@dataclass
class MusicJob:
    job_id: str
    concept: str
    genre: str
    bpm: int
    mood: str
    duration_seconds: int
    status: str = "queued"     # queued | generating | done | error
    progress: int = 0
    message: str = ""
    output_path: str | None = None
    output_format: str | None = None   # "wav" | "mp3"
    composition_brief: str = ""        # LLM brief always available
    provider: str = ""
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "jobId": self.job_id,
            "concept": self.concept,
            "genre": self.genre,
            "bpm": self.bpm,
            "mood": self.mood,
            "durationSeconds": self.duration_seconds,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "outputPath": self.output_path,
            "outputFormat": self.output_format,
            "compositionBrief": self.composition_brief,
            "provider": self.provider,
            "downloadReady": self.output_path is not None and Path(self.output_path).exists(),
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _http_post(url: str, body: Any, headers: dict[str, str], timeout: int = 180) -> bytes:
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_get(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ---------------------------------------------------------------------------
# MusicGen prompt builder
# ---------------------------------------------------------------------------

def _build_musicgen_prompt(concept: str, genre: str, bpm: int, mood: str, duration: int) -> str:
    """Build a MusicGen-optimized text prompt."""
    genre_tags = {
        "cinematic": "cinematic orchestral, epic strings, brass, timpani",
        "hip-hop": "hip hop beat, 808 bass, trap hi-hats, deep kick",
        "electronic": "electronic music, synthesizer, EDM, dance beat",
        "lo-fi": "lofi hip hop, mellow piano, vinyl crackle, relaxed",
        "rock": "electric guitar, rock drums, bass guitar, powerful",
        "jazz": "jazz, piano, upright bass, brushed drums, sax",
        "pop": "pop music, catchy melody, bright production",
        "ambient": "ambient music, atmospheric pads, ethereal, spacious",
        "game ost": "video game music, epic adventure, orchestral fantasy",
        "r&b": "r&b, soulful, smooth vocals, groove",
    }
    genre_str = genre_tags.get(genre.lower(), genre)
    return (
        f"{concept}. "
        f"{genre_str}, {mood} mood, {bpm} BPM. "
        f"Professional studio quality, high fidelity, {duration} seconds."
    )


# ---------------------------------------------------------------------------
# Provider 1: HuggingFace Inference API (MusicGen)
# ---------------------------------------------------------------------------

def _try_huggingface_music(prompt: str, duration: int) -> bytes | None:
    """Generate audio via HuggingFace MusicGen models. Returns WAV bytes."""
    if not _HF_API_KEY:
        return None

    auth_prefix = "Bearer"
    models_to_try = [_HF_MUSIC_MODEL] + [m for m in _HF_MUSIC_MODELS if m != _HF_MUSIC_MODEL]

    for model_id in models_to_try:
        url = f"{HF_API_BASE}/{model_id}"
        headers = {
            "Authorization": f"{auth_prefix} {_HF_API_KEY}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": min(duration * 50, 1500),  # ~50 tokens/sec for MusicGen
                "do_sample": True,
                "guidance_scale": 3.0,
            },
        }
        try:
            raw = _http_post(url, body, headers, timeout=180)
            # MusicGen returns raw WAV audio bytes
            if raw and len(raw) > 4096:
                # WAV magic: RIFF....WAVE
                if raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
                    return raw
                # Some models return FLAC or other formats — accept if large enough
                if len(raw) > 8192:
                    return raw
            # Check for JSON error
            try:
                err = json.loads(raw)
                if isinstance(err, dict) and "estimated_time" in err:
                    # Model loading, wait and retry once
                    wait = min(float(err.get("estimated_time", 20)), 40)
                    time.sleep(wait)
                    raw2 = _http_post(url, body, headers, timeout=180)
                    if raw2 and len(raw2) > 4096 and (raw2[:4] == b"RIFF" or len(raw2) > 8192):
                        return raw2
            except Exception:
                pass
        except urllib.error.HTTPError as exc:
            if exc.code == 503:
                continue   # model loading, try next
        except Exception:
            continue

    return None


# ---------------------------------------------------------------------------
# Provider 2: Replicate (meta/musicgen)
# ---------------------------------------------------------------------------

def _try_replicate_music(prompt: str, duration: int) -> bytes | None:
    """Generate audio via Replicate meta/musicgen."""
    if not _REPLICATE_TOKEN:
        return None

    auth_prefix = "Token"
    headers = {
        "Authorization": f"{auth_prefix} {_REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait=120",
    }
    body = {
        "input": {
            "prompt": prompt,
            "model_version": "stereo-large",
            "duration": min(duration, 60),  # Replicate musicgen max 60s
            "output_format": "mp3",
            "normalization_strategy": "peak",
        },
    }
    try:
        raw = _http_post(f"{REPLICATE_API}/models/meta/musicgen/predictions", body, headers, timeout=150)
        data = json.loads(raw)
        prediction_id = data.get("id")
        status = data.get("status", "")
        output = data.get("output")

        poll_count = 0
        while status in ("starting", "processing") and poll_count < 40:
            time.sleep(3)
            poll_raw = _http_get(
                f"{REPLICATE_API}/predictions/{prediction_id}",
                {"Authorization": f"{auth_prefix} {_REPLICATE_TOKEN}"},
                timeout=30,
            )
            data = json.loads(poll_raw)
            status = data.get("status", "")
            output = data.get("output")
            poll_count += 1

        if status == "succeeded" and output:
            audio_url = output if isinstance(output, str) else (output[0] if isinstance(output, list) else None)
            if audio_url:
                audio_bytes = _http_get(audio_url, {}, timeout=60)
                if audio_bytes and len(audio_bytes) > 4096:
                    return audio_bytes
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Composition brief (LLM)
# ---------------------------------------------------------------------------

def _generate_composition_brief(job: "MusicJob") -> str:
    """Ask LUMI to generate a detailed production brief for the DAW."""
    try:
        from .ai_router import get_router  # noqa: PLC0415
        router = get_router()
        prompt = (
            f"Compose a professional music production brief for: {job.concept}\n"
            f"Genre: {job.genre}, BPM: {job.bpm}, Mood: {job.mood}, "
            f"Duration: {job.duration_seconds}s\n\n"
            "Provide a complete studio session document including:\n"
            "1. Track title and overall concept\n"
            "2. Arrangement timeline with timestamps (intro/verse/chorus/bridge/outro)\n"
            "3. Specific instruments, patches, and articulations (no generic synth sounds)\n"
            "4. Chord progressions with Roman numerals and actual chord names\n"
            "5. Melody, counter-melody, and harmonic layers\n"
            "6. Sound design details — real-world instrument mic techniques\n"
            "7. Mixing targets: LUFS, compression settings, EQ curve\n"
            "8. Mastering chain and final loudness targets\n"
            "9. Reference tracks from professional productions\n"
            "10. Stem export list for video post-production sync\n\n"
            "Use professional music production terminology. Be specific and actionable."
        )
        result = router.lumi_chat(prompt, domain="music")
        return result.content if result.ok else ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def _run_music_pipeline(job_id: str) -> None:
    with _LOCK:
        job = _JOBS.get(job_id)
    if job is None:
        return

    def update(status: str, progress: int, message: str) -> None:
        job.status = status
        job.progress = progress
        job.message = message
        job.updated_at = time.time()

    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

        # Step 1: Generate composition brief (always)
        update("generating", 10, "LUMI is composing the music brief…")
        brief = _generate_composition_brief(job)
        job.composition_brief = brief

        # Build MusicGen prompt
        musicgen_prompt = _build_musicgen_prompt(
            job.concept, job.genre, job.bpm, job.mood, job.duration_seconds
        )

        # Step 2: Try real audio generation
        update("generating", 30, "Generating real audio via AI…")
        audio_bytes: bytes | None = None
        provider_used = "none"

        # Try HuggingFace first
        update("generating", 35, "Trying HuggingFace MusicGen…")
        audio_bytes = _try_huggingface_music(musicgen_prompt, job.duration_seconds)
        if audio_bytes:
            provider_used = "huggingface-musicgen"

        # Try Replicate if HF failed
        if not audio_bytes:
            update("generating", 55, "Trying Replicate MusicGen…")
            audio_bytes = _try_replicate_music(musicgen_prompt, job.duration_seconds)
            if audio_bytes:
                provider_used = "replicate-musicgen"

        # Step 3: Save output
        if audio_bytes:
            # Detect format
            if audio_bytes[:4] == b"RIFF":
                ext = "wav"
            elif audio_bytes[:3] == b"ID3" or audio_bytes[:2] == b"\xff\xfb":
                ext = "mp3"
            else:
                ext = "wav"   # default

            out_path = EXPORTS_DIR / f"{job_id}.{ext}"
            out_path.write_bytes(audio_bytes)
            job.output_path = str(out_path)
            job.output_format = ext
            job.provider = provider_used
            update("done", 100, f"Audio ready ({ext.upper()}) via {provider_used}")
        else:
            # Audio generation not available — save brief as text
            brief_path = EXPORTS_DIR / f"{job_id}_brief.txt"
            brief_content = (
                f"TrezzWorld Production Studio — Music Brief\n"
                f"{'='*60}\n"
                f"Concept: {job.concept}\n"
                f"Genre: {job.genre} | BPM: {job.bpm} | Mood: {job.mood}\n"
                f"Duration: {job.duration_seconds}s\n\n"
                f"{'='*60}\n\n"
                f"{brief or musicgen_prompt}\n\n"
                f"{'='*60}\n"
                f"To generate real audio, set HF_API_KEY or REPLICATE_API_TOKEN in backend/.env\n"
                f"Then use this prompt with:\n"
                f"  - HuggingFace: https://huggingface.co/facebook/musicgen-stereo-small\n"
                f"  - Replicate: https://replicate.com/meta/musicgen\n"
                f"  - Suno AI: https://suno.com\n"
                f"  - Udio: https://udio.com\n"
                f"MusicGen prompt: {musicgen_prompt}\n"
            )
            brief_path.write_text(brief_content)
            job.output_path = str(brief_path)
            job.output_format = "txt"
            job.provider = "brief-only"
            update("done", 100, "Composition brief ready (set HF_API_KEY for real audio)")

    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.progress = 0
        job.message = f"Music pipeline error: {exc}"
        job.updated_at = time.time()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_music_job(
    concept: str,
    genre: str = "cinematic",
    duration_seconds: int = DEFAULT_DURATION,
    bpm: int = 120,
    mood: str = "epic",
) -> MusicJob:
    """Create and queue a music generation job."""
    duration_seconds = max(5, min(duration_seconds, MAX_DURATION))

    job_id = str(uuid.uuid4())
    job = MusicJob(
        job_id=job_id,
        concept=concept,
        genre=genre,
        duration_seconds=duration_seconds,
        bpm=bpm,
        mood=mood,
    )

    with _LOCK:
        _JOBS[job_id] = job

    thread = threading.Thread(target=_run_music_pipeline, args=(job_id,), daemon=True)
    thread.start()

    return job


def get_music_job(job_id: str) -> MusicJob | None:
    with _LOCK:
        return _JOBS.get(job_id)


def list_music_jobs() -> list[dict[str, Any]]:
    with _LOCK:
        return [j.to_dict() for j in sorted(_JOBS.values(), key=lambda x: x.created_at, reverse=True)]


def get_music_output_path(job_id: str) -> Path | None:
    with _LOCK:
        job = _JOBS.get(job_id)
    if job is None or job.output_path is None:
        return None
    p = Path(job.output_path)
    return p if p.exists() else None


def get_provider_status() -> dict[str, Any]:
    return {
        "huggingface": {
            "configured": bool(_HF_API_KEY),
            "models": _HF_MUSIC_MODELS,
            "activeModel": _HF_MUSIC_MODEL,
            "note": "Set HF_API_KEY. Free tier. Best for stereo music up to ~30s.",
        },
        "replicate": {
            "configured": bool(_REPLICATE_TOKEN),
            "model": "meta/musicgen",
            "note": "Set REPLICATE_API_TOKEN. Supports up to 60s stereo output.",
        },
        "anyAvailable": bool(_HF_API_KEY or _REPLICATE_TOKEN),
    }
