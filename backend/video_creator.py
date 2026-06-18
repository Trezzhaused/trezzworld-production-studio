"""
Video Creator Pipeline — AI-driven end-to-end video production with MP4 export.

Workflow:
  1. User provides a concept prompt + duration (up to 10 minutes)
  2. LUMI generates a detailed storyboard (AI, via ai_router or ollama)
  3. Each scene is rendered as a frame (Pillow image with text/graphics)
  4. Frames are encoded into an MP4 using FFmpeg subprocess
  5. MP4 stored in exports/ directory and served via download endpoint

Requires:
  - Pillow (pip install Pillow)
  - FFmpeg installed on the system (https://ffmpeg.org/download.html)
    On Windows: winget install FFmpeg  |  choco install ffmpeg
    On macOS:   brew install ffmpeg
    On Linux:   apt install ffmpeg
"""
from __future__ import annotations

import base64
import io
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Lazy import — Pillow is optional; graceful degradation if not installed
try:
    from PIL import Image, ImageDraw, ImageFont  # type: ignore[import-untyped]
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

EXPORTS_DIR = Path(os.environ.get("VIDEO_EXPORT_DIR", "/tmp/trezzworld/exports/video"))
MAX_DURATION_SECONDS = 600  # 10 minutes hard cap
DEFAULT_FPS = 24
DEFAULT_RESOLUTION = (1920, 1080)


def _resolve_video_export_dir() -> Path:
    """Return a writable export directory, falling back to a temp dir when needed."""
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = EXPORTS_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "video"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _find_image_api_credentials() -> tuple[str, str] | None:
    """Return the best available image API provider and key for photorealistic frames.

    Priority: Stable Diffusion (HuggingFace) and Wan/Kling (fal.ai) produce real
    photorealistic frames via video_generator_patch and are tried first inside
    _generate_photorealistic_scene_image; OpenAI's image API is the direct fallback.
    """
    from .user_key_store import get_user_key_store  # noqa: PLC0415
    from .video_generator_patch import _get_hf_token, _get_fal_key  # noqa: PLC0415

    if _get_hf_token():
        return "huggingface", _get_hf_token() or ""

    if _get_fal_key():
        return "fal", _get_fal_key() or ""

    openai_key = os.environ.get("OPENAI_API_KEY") or get_user_key_store().get_key("openai")
    if openai_key:
        return "openai", openai_key

    return None


def _wants_photorealistic_frames(job: "VideoJob") -> bool:
    """
    Decide whether this job should try AI image generation for frames.

    Every production style (cinematic, 3d, surreal, animated, slideshow,
    standard, documentary) has a matching model in video_generator_patch's
    _SD_MODELS, so AI generation is attempted whenever credentials are
    available — gating used to be a style-keyword match, which meant most
    styles always fell back to the plain Pillow text-card renderer even with
    API keys configured.
    """
    return True


def _api_image_size(resolution: tuple[int, int]) -> str:
    """Choose an image generation size compatible with common image APIs."""
    max_dim = max(resolution)
    if max_dim <= 512:
        return "512x512"
    return "1024x1024"


def _download_image_from_url(url: str) -> bytes | None:
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            return resp.read()
    except Exception:
        return None


def _call_image_generation_api(
    prompt: str,
    provider: str,
    api_key: str,
    size: str,
) -> bytes | None:
    """Call the OpenAI image generation endpoint."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + api_key,
        "User-Agent": "TrezzWorldVideoGenerator/1.0",
    }
    payload = json.dumps({"model": "gpt-image-1", "prompt": prompt, "size": size, "n": 1}).encode("utf-8")

    endpoints = ["https://api.openai.com/v1/images/generations"] if provider == "openai" else []

    for url in endpoints:
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, dict):
                    images = data.get("data") or data.get("output")
                    if isinstance(images, list) and images:
                        item = images[0]
                        b64_json = item.get("b64_json")
                        if b64_json:
                            return base64.b64decode(b64_json)
                        image_url = item.get("url")
                        if image_url:
                            downloaded = _download_image_from_url(image_url)
                            if downloaded:
                                return downloaded
        except urllib.error.HTTPError:
            continue
        except Exception:
            continue

    return None


def _build_scene_image_prompt(
    scene: dict[str, Any],
    title: str,
    style: str,
    resolution: tuple[int, int],
) -> str:
    """Build a photorealistic image prompt from the storyboard scene data."""
    size = f"{resolution[0]}x{resolution[1]}"
    visual = scene.get("visual_description", "").strip()
    overlay = scene.get("text_overlay") or ""
    camera_motion = scene.get("camera_motion", "static")
    color_grade = scene.get("color_grade", "cinematic teal-orange")

    prompt = (
        f"Photorealistic cinematic frame for a video titled '{title}'. "
        f"Scene: {scene.get('title', 'Untitled Scene')}. "
        f"Description: {visual}. "
        f"Lighting: cinematic {color_grade}. "
        f"Camera motion: {camera_motion}. "
        f"Style: {style or 'photorealistic'}, ultra-detailed, dramatic lighting, realistic texture, "
        "high resolution, film-quality, atmospheric depth, polished cinematography. "
        f"Aspect ratio: {size}."
    )
    if overlay:
        prompt += f" Add subtle overlay text: '{overlay}'."
    prompt += " Use natural human skin tones where appropriate and realistic environmental detail."
    return prompt


def _crop_and_resize_image(img: "Image.Image", resolution: tuple[int, int]) -> "Image.Image":
    """Resize and crop an image to the target video resolution while preserving composition."""
    w, h = resolution
    src_w, src_h = img.size
    target_ratio = w / h
    src_ratio = src_w / src_h

    if abs(src_ratio - target_ratio) > 0.01:
        if src_ratio > target_ratio:
            new_w = int(src_h * target_ratio)
            left = max(0, (src_w - new_w) // 2)
            img = img.crop((left, 0, left + new_w, src_h))
        else:
            new_h = int(src_w / target_ratio)
            top = max(0, (src_h - new_h) // 2)
            img = img.crop((0, top, src_w, top + new_h))

    return img.resize((w, h), Image.LANCZOS)


def _render_photorealistic_motion_frame(
    base_img: "Image.Image",
    frame_index: int,
    scene_frames: int,
    resolution: tuple[int, int],
) -> "Image.Image":
    """Create a subtle Ken Burns motion frame from a static photorealistic image."""
    w, h = resolution
    progress = frame_index / max(scene_frames - 1, 1)
    zoom = 1.0 + 0.04 * math.sin(progress * math.pi * 2)
    pan_x = int((base_img.width - w / zoom) * 0.5 * (1 + math.sin(progress * math.pi * 2)))
    pan_y = int((base_img.height - h / zoom) * 0.5 * (1 + math.cos(progress * math.pi * 2)))

    crop_w = int(min(base_img.width, round(w / zoom)))
    crop_h = int(min(base_img.height, round(h / zoom)))
    left = max(0, min(base_img.width - crop_w, pan_x))
    top = max(0, min(base_img.height - crop_h, pan_y))

    frame = base_img.crop((left, top, left + crop_w, top + crop_h)).resize((w, h), Image.LANCZOS)
    return frame


# Status store: {job_id: VideoJob}
_JOBS: dict[str, "VideoJob"] = {}
_LOCK = threading.Lock()


@dataclass
class VideoScene:
    id: str
    title: str
    duration_seconds: int
    visual_description: str
    text_overlay: str | None
    transition_in: str
    transition_out: str
    camera_motion: str
    color_grade: str


@dataclass
class VideoJob:
    job_id: str
    concept: str
    duration_seconds: int
    style: str
    resolution: tuple[int, int]
    fps: int
    narrate: bool = True
    narrator_voice: str = "en-US-female"
    include_music: bool = True
    status: str = "queued"       # queued | generating_storyboard | rendering | encoding | done | error
    progress: int = 0            # 0–100
    message: str = ""
    storyboard: dict[str, Any] = field(default_factory=dict)
    output_path: str | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "jobId": self.job_id,
            "concept": self.concept,
            "durationSeconds": self.duration_seconds,
            "style": self.style,
            "resolution": f"{self.resolution[0]}x{self.resolution[1]}",
            "fps": self.fps,
            "narrate": self.narrate,
            "narratorVoice": self.narrator_voice,
            "includeMusic": self.include_music,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "storyboard": self.storyboard,
            "outputPath": self.output_path,
            "downloadReady": self.output_path is not None and Path(self.output_path).exists(),
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


# ---------------------------------------------------------------------------
# Storyboard generation
# ---------------------------------------------------------------------------

def _generate_storyboard(job: VideoJob) -> dict[str, Any]:
    """Ask LUMI (or Ollama fallback) to generate a video storyboard."""
    from .lumi_prompt_enhancer import build_video_storyboard_prompt  # noqa: PLC0415
    from .ai_router import get_router  # noqa: PLC0415
    from .ollama_provider import get_ollama  # noqa: PLC0415

    messages = build_video_storyboard_prompt(
        concept=job.concept,
        duration_seconds=job.duration_seconds,
        style=job.style,
        resolution=f"{job.resolution[0]}x{job.resolution[1]}",
    )

    # Try Ollama SuperGemma first (local, free)
    ollama = get_ollama()
    if ollama.is_available():
        result = ollama.super_gemma_chat(messages, temperature=0.65, max_tokens=4000)
        if result.ok and result.content:
            parsed = _parse_storyboard_json(result.content)
            if parsed:
                return parsed

    # Fall back to OpenRouter cascade
    router = get_router()
    result = router.chat(messages, role="planner", temperature=0.65, max_tokens=3000)
    if result.ok and result.content:
        parsed = _parse_storyboard_json(result.content)
        if parsed:
            return parsed

    # If AI unavailable, generate a placeholder storyboard
    return _placeholder_storyboard(job)


def _parse_storyboard_json(text: str) -> dict[str, Any] | None:
    """Extract JSON from AI response (handles markdown code fences)."""
    # Strip markdown fences
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = text.rstrip("`").strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _placeholder_storyboard(job: VideoJob) -> dict[str, Any]:
    """Fallback storyboard when AI is unavailable."""
    num_scenes = max(4, min(20, job.duration_seconds // 10))
    per_scene = job.duration_seconds // num_scenes
    remainder = job.duration_seconds - per_scene * num_scenes

    scenes = []
    for i in range(num_scenes):
        dur = per_scene + (1 if i == num_scenes - 1 and remainder > 0 else 0)
        scenes.append({
            "id": f"scene_{i + 1:02d}",
            "title": f"Scene {i + 1}",
            "duration_seconds": dur,
            "visual_description": f"{job.concept} — segment {i + 1} of {num_scenes}",
            "narration": f"{job.concept} — part {i + 1} of {num_scenes}.",
            "text_overlay": job.concept if i == 0 else None,
            "transition_in": "cut" if i > 0 else "fade",
            "transition_out": "fade" if i == num_scenes - 1 else "cut",
            "camera_motion": "static",
            "color_grade": "cinematic teal-orange",
        })

    return {
        "title": job.concept[:80],
        "logline": f"A {job.duration_seconds}-second production: {job.concept[:120]}",
        "style": job.style,
        "total_duration_seconds": job.duration_seconds,
        "color_palette": ["#0a1628", "#1a3a5c", "#38bdf8"],
        "audio": {
            "music_genre": "cinematic", "bpm": 120, "mood": "epic", "sfx_notes": "ambient",
            "sfx_cues": [{"time_seconds": 0, "description": f"ambient {job.style} atmosphere"}],
        },
        "scenes": scenes,
    }


# ---------------------------------------------------------------------------
# Frame rendering (Pillow)
# ---------------------------------------------------------------------------

_BG_COLORS: dict[str, tuple[int, int, int]] = {
    "warm golden":          (30, 20, 5),
    "cool blue":            (5, 15, 35),
    "desaturated":          (18, 18, 20),
    "cinematic teal-orange":(5, 22, 28),
    "vibrant neon":         (5, 5, 30),
    "monochrome":           (10, 10, 10),
}

_ACCENT_COLORS: dict[str, tuple[int, int, int]] = {
    "warm golden":          (220, 160, 30),
    "cool blue":            (56, 189, 248),
    "desaturated":          (150, 150, 150),
    "cinematic teal-orange":(56, 189, 248),
    "vibrant neon":         (200, 50, 255),
    "monochrome":           (200, 200, 200),
}


def _render_scene_frame(
    scene: dict[str, Any],
    frame_index: int,
    total_frames: int,
    resolution: tuple[int, int],
    title: str,
    color_palette: list[str],
) -> "Image.Image":
    """Render a single video frame for a scene using Pillow."""
    from PIL import Image, ImageDraw  # noqa: PLC0415

    w, h = resolution
    grade = scene.get("color_grade", "cinematic teal-orange").lower()

    # Background
    bg = _BG_COLORS.get(grade, (5, 10, 20))
    accent = _ACCENT_COLORS.get(grade, (56, 189, 248))

    img = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(img)

    # Gradient-like horizontal bars (simulated depth)
    for y in range(0, h, 4):
        factor = y / h
        r = int(bg[0] + (accent[0] - bg[0]) * factor * 0.15)
        g = int(bg[1] + (accent[1] - bg[1]) * factor * 0.15)
        b = int(bg[2] + (accent[2] - bg[2]) * factor * 0.18)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Scene progress bar at bottom
    bar_h = max(3, h // 160)
    progress = (frame_index + 1) / max(total_frames, 1)
    draw.rectangle([(0, h - bar_h), (w, h)], fill=(20, 20, 20))
    draw.rectangle([(0, h - bar_h), (int(w * progress), h)], fill=accent)

    # Title text (project title — top)
    _draw_text_safe(draw, title[:60], (w // 2, h // 10), w - 80, accent, size="large", align="center")

    # Scene title (middle)
    scene_title = scene.get("title", "")
    if scene_title:
        _draw_text_safe(draw, scene_title, (w // 2, h // 2 - 40), w - 120, (255, 255, 255), size="xlarge", align="center")

    # Visual description (lower third)
    visual = scene.get("visual_description", "")
    if visual:
        _draw_text_safe(draw, _truncate(visual, 120), (w // 2, int(h * 0.72)), w - 160, (180, 200, 220), size="medium", align="center")

    # Text overlay (if any)
    overlay = scene.get("text_overlay")
    if overlay:
        _draw_text_safe(draw, _truncate(overlay, 80), (w // 2, int(h * 0.85)), w - 200, accent, size="large", align="center")

    # Camera motion indicator (top right)
    cam_motion = scene.get("camera_motion", "")
    if cam_motion:
        _draw_text_safe(draw, f"📷 {cam_motion}", (w - 20, 20), 300, (100, 120, 140), size="small", align="right")

    # Frame counter (bottom right corner)
    _draw_text_safe(draw, f"{frame_index + 1}/{total_frames}", (w - 20, h - bar_h - 24), 200, (60, 80, 100), size="small", align="right")

    return img


def _draw_text_safe(
    draw: "ImageDraw.ImageDraw",
    text: str,
    pos: tuple[int, int],
    max_width: int,
    color: tuple[int, int, int],
    size: str = "medium",
    align: str = "left",
) -> None:
    """Draw text without requiring external font files."""
    # Use Pillow's default bitmap font (always available)
    size_map = {"small": 1, "medium": 2, "large": 3, "xlarge": 4}
    scale = size_map.get(size, 2)

    x, y = pos
    if align == "center":
        # Rough centering: each char ~6px wide at scale 1
        estimated_w = len(text) * 6 * scale
        x = max(10, x - estimated_w // 2)
    elif align == "right":
        estimated_w = len(text) * 6 * scale
        x = max(10, x - estimated_w)

    draw.text((x, y), text, fill=color)


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "…"


# ---------------------------------------------------------------------------
# FFmpeg encoder
# ---------------------------------------------------------------------------

def _find_ffmpeg_executable() -> Path | None:
    """Return a usable ffmpeg executable path if available."""
    # Check environment variable override first
    env_path = os.environ.get("FFMPEG_PATH")
    if env_path:
        ffmpeg = Path(env_path)
        if ffmpeg.is_file():
            return ffmpeg

    # Check PATH via shutil.which
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return Path(ffmpeg_path)

    # Railway/Nix store paths
    nix_candidates = list(Path("/nix/store").glob("*/bin/ffmpeg")) if Path("/nix/store").exists() else []
    for p in sorted(nix_candidates, reverse=True):
        if p.is_file():
            return p

    # Common Linux paths
    linux_candidates = [
        Path("/usr/bin/ffmpeg"),
        Path("/usr/local/bin/ffmpeg"),
        Path("/bin/ffmpeg"),
        Path("/opt/ffmpeg/bin/ffmpeg"),
    ]
    for p in linux_candidates:
        if p.is_file():
            return p

    # Common Windows paths
    win_candidates = [
        Path("C:/Program Files/FFmpeg/bin/ffmpeg.exe"),
        Path("C:/Program Files (x86)/FFmpeg/bin/ffmpeg.exe"),
    ]
    for p in win_candidates:
        if p.is_file():
            return p

    return None


def _ffmpeg_available() -> bool:
    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return False
    try:
        result = subprocess.run(
            [str(ffmpeg), "-version"], capture_output=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _encode_frames_to_mp4(
    frames_dir: Path,
    output_path: Path,
    fps: int,
    resolution: tuple[int, int],
) -> tuple[bool, str]:
    """Use FFmpeg to encode a directory of PNG frames into an MP4. Returns (success, stderr_tail)."""
    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return False, "ffmpeg executable not found"

    w, h = resolution
    cmd = [
        str(ffmpeg),
        "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%06d.png"),
        "-vf", f"scale={w}:{h}:flags=lanczos",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-tune", "film",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=MAX_DURATION_SECONDS * 2)
        stderr_tail = result.stderr.decode("utf-8", errors="replace")[-1000:] if result.stderr else ""
        return result.returncode == 0, stderr_tail
    except FileNotFoundError as exc:
        return False, str(exc)
    except subprocess.TimeoutExpired:
        return False, "ffmpeg encode timed out"


def _write_fallback_color_video(
    output_path: Path,
    fps: int,
    resolution: tuple[int, int],
    duration_seconds: int,
) -> bool:
    """Encode a real (silent, solid-color) MP4 via ffmpeg's lavfi source — always playable,
    used when frame-based encoding fails so we never ship a text file disguised as a video."""
    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return False
    w, h = resolution
    cmd = [
        str(ffmpeg), "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x0a1628:s={w}x{h}:d={max(1, duration_seconds)}:r={fps}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _mux_audio_into_video(video_path: Path, audio_path: Path, output_path: Path) -> bool:
    """Combine a silent video with an audio track into a final MP4."""
    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return False
    cmd = [
        str(ffmpeg),
        "-y",
        "-i", str(video_path),
        "-i", str(audio_path),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _mix_weighted_audio_tracks(tracks: list[tuple[Path, float]], output_path: Path) -> Path | None:
    """Mix any number of (path, volume) audio tracks into one file via ffmpeg amix."""
    tracks = [t for t in tracks if t[0] is not None]
    if not tracks:
        return None
    if len(tracks) == 1:
        return tracks[0][0]

    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return tracks[0][0]

    cmd = [str(ffmpeg), "-y"]
    for path, _ in tracks:
        cmd += ["-i", str(path)]

    labels = []
    filter_parts = []
    for i, (_, volume) in enumerate(tracks):
        filter_parts.append(f"[{i}:a]volume={volume}[a{i}]")
        labels.append(f"[a{i}]")
    filter_parts.append(f"{''.join(labels)}amix=inputs={len(tracks)}:duration=longest:dropout_transition=2")
    cmd += ["-filter_complex", ";".join(filter_parts), str(output_path)]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=180)
        return output_path if result.returncode == 0 else tracks[0][0]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return tracks[0][0]


def _build_sfx_track(sfx_cues: list[dict[str, Any]], work_dir: Path, total_duration: int) -> Path | None:
    """Generate AudioGen sound effects for each storyboard cue and lay them out by timestamp."""
    if not sfx_cues:
        return None
    try:
        from .music_creator import _generate_audiogen_sfx, _save_audio_bytes  # noqa: PLC0415
        from .video_generator_patch import _get_hf_token  # noqa: PLC0415
    except Exception:
        return None

    hf_token = _get_hf_token()
    if not hf_token:
        return None

    cue_clips: list[tuple[Path, float]] = []  # (path, delay_seconds)
    for i, cue in enumerate(sfx_cues[:8]):  # cap to avoid excessive API calls
        description = (cue.get("description") or "").strip()
        if not description:
            continue
        try:
            time_seconds = max(0.0, float(cue.get("time_seconds", 0)))
        except (TypeError, ValueError):
            time_seconds = 0.0
        if time_seconds >= total_duration:
            continue
        audio_bytes = _generate_audiogen_sfx(description, duration_seconds=3, hf_token=hf_token)
        if not audio_bytes:
            continue
        clip_path = work_dir / f"sfx_{i:02d}.wav"
        if _save_audio_bytes(audio_bytes, clip_path):
            cue_clips.append((clip_path, time_seconds))

    if not cue_clips:
        return None

    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return cue_clips[0][0]

    cmd = [str(ffmpeg), "-y"]
    for path, _ in cue_clips:
        cmd += ["-i", str(path)]

    labels = []
    filter_parts = []
    for i, (_, delay_seconds) in enumerate(cue_clips):
        delay_ms = int(delay_seconds * 1000)
        filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[s{i}]")
        labels.append(f"[s{i}]")
    filter_parts.append(f"{''.join(labels)}amix=inputs={len(cue_clips)}:duration=longest:dropout_transition=2")

    output_path = work_dir / "sfx_mix.wav"
    cmd += ["-filter_complex", ";".join(filter_parts), str(output_path)]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=180)
        return output_path if result.returncode == 0 else cue_clips[0][0]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return cue_clips[0][0]


def _build_audio_track(
    job: "VideoJob",
    storyboard: dict[str, Any],
    scenes: list[dict[str, Any]],
    total_duration: int,
    work_dir: Path,
    narrate: bool,
    narrator_voice: str,
    include_music: bool,
) -> Path | None:
    """Generate narration, a music bed, and SFX cues, then mix them into a single audio file."""
    narration_path: Path | None = None
    music_path: Path | None = None
    sfx_path: Path | None = None
    audio_meta = storyboard.get("audio", {})

    if narrate:
        from .narration_engine import synthesize_narration  # noqa: PLC0415
        script = " ".join(
            (scene.get("narration") or scene.get("visual_description") or "").strip()
            for scene in scenes
            if (scene.get("narration") or scene.get("visual_description"))
        ).strip()
        if script:
            candidate = work_dir / "narration.mp3"
            if synthesize_narration(script, narrator_voice, candidate):
                narration_path = candidate

    if include_music:
        try:
            from .music_creator import _build_audio_bed_for_video  # noqa: PLC0415
            candidate = work_dir / "music.wav"
            if _build_audio_bed_for_video(
                concept=job.concept,
                genre=audio_meta.get("music_genre", "cinematic"),
                mood=audio_meta.get("mood", "epic"),
                bpm=int(audio_meta.get("bpm", 120) or 120),
                duration_seconds=total_duration,
                output_path=candidate,
            ):
                music_path = candidate
        except Exception:
            music_path = None

    try:
        sfx_path = _build_sfx_track(audio_meta.get("sfx_cues", []), work_dir, total_duration)
    except Exception:
        sfx_path = None

    if narration_path is None and music_path is None and sfx_path is None:
        return None

    mixed_path = work_dir / "audio_mix.wav"
    return _mix_weighted_audio_tracks(
        [
            (narration_path, 1.0),
            (music_path, 0.22),
            (sfx_path, 0.5),
        ],
        mixed_path,
    )


# ---------------------------------------------------------------------------
# Pipeline executor (runs in background thread)
# ---------------------------------------------------------------------------

def _run_video_pipeline(job_id: str) -> None:
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
        # Step 1: Generate storyboard (skipped if a REWORK-iT re-render supplied one already)
        if job.storyboard and job.storyboard.get("scenes"):
            storyboard = job.storyboard
            update("generating_storyboard", 20, f"Using edited storyboard: {len(storyboard.get('scenes', []))} scenes")
        else:
            update("generating_storyboard", 5, "LUMI is generating the storyboard…")
            storyboard = _generate_storyboard(job)
            job.storyboard = storyboard
            update("generating_storyboard", 20, f"Storyboard ready: {len(storyboard.get('scenes', []))} scenes")

        scenes = storyboard.get("scenes", [])
        if not scenes:
            raise ValueError("No scenes in storyboard")

        title = storyboard.get("title", job.concept[:60])
        color_palette = storyboard.get("color_palette", ["#0a1628", "#38bdf8"])
        total_duration = min(job.duration_seconds, MAX_DURATION_SECONDS)

        ffmpeg_ready = _ffmpeg_available()
        if not ffmpeg_ready:
            job.status = "error"
            job.error = "FFmpeg is not installed on this host — cannot encode video."
            job.progress = 0
            job.message = job.error
            job.updated_at = time.time()
            return

        # Step 2: Render frames
        update("rendering", 25, "Rendering frames…")

        use_photorealistic = _wants_photorealistic_frames(job)
        image_api_info = _find_image_api_credentials() if use_photorealistic else None
        if image_api_info is not None:
            update("rendering", 25, f"Generating photorealistic frames via {image_api_info[0]}…")
        elif use_photorealistic:
            update("rendering", 25, "Photorealistic style requested, but no image API key found. Falling back to built-in renderer.")
            use_photorealistic = False

        export_root = _resolve_video_export_dir()
        frames_dir = export_root / job_id / "frames"
        try:
            frames_dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            frames_dir = Path(tempfile.mkdtemp(prefix=f"trezzworld_video_{job_id}_"))

        # Count total frames
        total_frames = total_duration * job.fps
        frame_idx = 0

        try:
            for scene_i, scene in enumerate(scenes):
                remaining_frames = total_frames - frame_idx
                if remaining_frames <= 0:
                    break
                requested_duration = int(float(scene.get("duration_seconds", 5)) + 0.5)
                scene_frames = min(max(1, requested_duration) * job.fps, remaining_frames)

                scene_image_path: Path | None = None
                scene_base_image = None
                if use_photorealistic and scene_frames > 0:
                    scene_image_path = frames_dir / f"scene_{scene_i+1:03d}.png"
                    if _generate_photorealistic_scene_image(
                        scene=scene,
                        title=title,
                        style=job.style,
                        resolution=job.resolution,
                        target_path=scene_image_path,
                        image_provider=image_api_info[0],
                        api_key=image_api_info[1],
                    ):
                        if _PIL_AVAILABLE:
                            try:
                                from PIL import Image  # noqa: PLC0415
                                scene_base_image = Image.open(scene_image_path).convert("RGB")
                            except Exception:
                                scene_base_image = None
                    else:
                        scene_image_path = None
                        update("rendering", 25 + int(10 * (scene_i + 1) / max(len(scenes), 1)), f"Photorealistic generation failed for scene {scene_i + 1}, using fallback renderer.")

                for fi in range(scene_frames):
                    if frame_idx >= total_frames:
                        break

                    frame_path = frames_dir / f"frame_{frame_idx:06d}.png"
                    if scene_base_image is not None:
                        frame_image = _render_photorealistic_motion_frame(
                            scene_base_image,
                            fi,
                            scene_frames,
                            job.resolution,
                        )
                        frame_image.save(frame_path)
                    elif scene_image_path is not None and scene_base_image is None:
                        shutil.copy(scene_image_path, frame_path)
                    elif _PIL_AVAILABLE:
                        img = _render_scene_frame(
                            scene=scene,
                            frame_index=frame_idx,
                            total_frames=total_frames,
                            resolution=job.resolution,
                            title=title,
                            color_palette=color_palette,
                        )
                        img.save(frame_path)
                    else:
                        _write_minimal_png(frame_path, job.resolution)

                    frame_idx += 1

                scene_pct = 25 + int(55 * (scene_i + 1) / max(len(scenes), 1))
                update("rendering", scene_pct, f"Rendered scene {scene_i + 1}/{len(scenes)}")

                if frame_idx >= total_frames:
                    break
        except OSError as exc:
            job.status = "error"
            job.error = f"Filesystem error while rendering frames: {exc}"
            job.progress = 0
            job.message = job.error
            job.updated_at = time.time()
            return

        # Step 3: Encode to MP4
        update("encoding", 82, "Encoding MP4…")
        silent_path = export_root / f"{job_id}_silent.mp4"
        output_path = export_root / f"{job_id}.mp4"

        encode_stderr = ""
        if _ffmpeg_available():
            success, encode_stderr = _encode_frames_to_mp4(frames_dir, silent_path, job.fps, job.resolution)
        else:
            success = False
            encode_stderr = "ffmpeg not found on this host"

        if not success:
            # Frame-based encode failed — try a real (silent, solid-color) fallback clip via
            # ffmpeg's lavfi color source instead of ever shipping a text file disguised as
            # an .mp4 (that's literally unplayable and was reported as a corrupt-file error).
            if _ffmpeg_available() and _write_fallback_color_video(output_path, job.fps, job.resolution, total_duration):
                update("done", 100, f"Frame encoding failed ({encode_stderr[:300]}); shipped a solid-color fallback clip.")
                shutil.rmtree(frames_dir.parent, ignore_errors=True)
                job.output_path = str(output_path)
                return
            job.status = "error"
            job.error = f"FFmpeg encoding failed: {encode_stderr[:500]}"
            job.progress = 0
            job.message = job.error
            job.updated_at = time.time()
            shutil.rmtree(frames_dir.parent, ignore_errors=True)
            return
        else:
            # Step 4: Build narration + music and mux into the final video
            audio_path = None
            if job.narrate or job.include_music:
                update("encoding", 88, "Generating narration and music…")
                try:
                    audio_path = _build_audio_track(
                        job=job,
                        storyboard=storyboard,
                        scenes=scenes,
                        total_duration=total_duration,
                        work_dir=frames_dir.parent,
                        narrate=job.narrate,
                        narrator_voice=job.narrator_voice,
                        include_music=job.include_music,
                    )
                except Exception:
                    audio_path = None

            if audio_path is not None:
                update("encoding", 95, "Mixing audio into video…")
                if not _mux_audio_into_video(silent_path, audio_path, output_path):
                    shutil.copy(silent_path, output_path)
            else:
                shutil.copy(silent_path, output_path)
            silent_path.unlink(missing_ok=True)

        # Clean up frames
        shutil.rmtree(frames_dir.parent, ignore_errors=True)

        update("done", 100, f"MP4 ready: {output_path.name}")
        job.output_path = str(output_path)

    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.progress = 0
        job.message = f"Pipeline error: {exc}"
        job.updated_at = time.time()


def _write_minimal_png(path: Path, resolution: tuple[int, int]) -> None:
    """Write a solid-color PNG without Pillow (pure bytes)."""
    import struct, zlib  # noqa: PLC0415, E401
    w, h = resolution
    raw = b"\x00" + b"\x05\x0f\x1e" * w  # filter byte + RGB pixels per row
    raw_data = raw * h
    compressed = zlib.compress(raw_data)

    def chunk(name: bytes, data: bytes) -> bytes:
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr_data = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr_data)
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def _generate_photorealistic_scene_image(
    scene: dict[str, Any],
    title: str,
    style: str,
    resolution: tuple[int, int],
    target_path: Path,
    image_provider: str,
    api_key: str,
) -> bool:
    """Generate a single photorealistic scene image using the best available image API."""
    from .video_generator_patch import generate_scene_image_ai  # noqa: PLC0415

    # Stable Diffusion (HuggingFace) / Wan / Kling (fal.ai) give the strongest
    # photorealistic results and are tried first regardless of which credential
    # triggered this call, since generate_scene_image_ai checks both internally.
    if generate_scene_image_ai(scene, title, style, resolution, target_path):
        return True

    if image_provider != "openai":
        return False

    prompt = _build_scene_image_prompt(scene, title, style, resolution)
    size = _api_image_size(resolution)
    image_bytes = _call_image_generation_api(prompt, image_provider, api_key, size)
    if image_bytes is None:
        return False

    if _PIL_AVAILABLE:
        try:
            from PIL import Image  # noqa: PLC0415
            img = Image.open(io.BytesIO(image_bytes))
            img = img.convert("RGB")
            img = _crop_and_resize_image(img, resolution)
            img.save(target_path)
            return True
        except Exception:
            pass

    try:
        target_path.write_bytes(image_bytes)
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_video_job(
    concept: str,
    duration_seconds: int = 60,
    style: str = "cinematic",
    resolution_label: str = "1080p",
    fps: int = DEFAULT_FPS,
    narrate: bool = True,
    narrator_voice: str = "en-US-female",
    include_music: bool = True,
    storyboard_override: dict[str, Any] | None = None,
) -> VideoJob:
    """
    Create and queue a new video generation job.

    storyboard_override skips AI storyboard generation and renders the given
    storyboard directly — used by REWORK-iT's re-render flow to apply edits
    (reordered/edited scenes, regenerated images) without paying for a fresh
    AI storyboard call.
    """
    # Clamp duration
    duration_seconds = max(5, min(duration_seconds, MAX_DURATION_SECONDS))

    # Resolution presets
    res_map = {
        "4k": (3840, 2160),
        "1080p": (1920, 1080),
        "720p": (1280, 720),
        "vertical": (1080, 1920),
        "square": (1080, 1080),
    }
    resolution = res_map.get(resolution_label.lower(), (1920, 1080))

    job_id = str(uuid.uuid4())
    job = VideoJob(
        job_id=job_id,
        concept=concept,
        duration_seconds=duration_seconds,
        style=style,
        resolution=resolution,
        fps=fps,
        narrate=narrate,
        narrator_voice=narrator_voice,
        include_music=include_music,
    )
    if storyboard_override:
        job.storyboard = storyboard_override

    with _LOCK:
        _JOBS[job_id] = job

    # Run in background thread
    thread = threading.Thread(target=_run_video_pipeline, args=(job_id,), daemon=True)
    thread.start()

    return job


# ---------------------------------------------------------------------------
# REWORK-iT — lightweight, server-driven edits on an already-rendered video
# ---------------------------------------------------------------------------

def create_rerender_job(
    source_job_id: str,
    storyboard_override: dict[str, Any] | None = None,
    narrate: bool | None = None,
    narrator_voice: str | None = None,
    include_music: bool | None = None,
) -> VideoJob | None:
    """Re-render a video from an edited storyboard (reordered/edited scenes), reusing
    the source job's concept/style/resolution/fps. Returns a new job, or None if the
    source job doesn't exist."""
    source = get_video_job(source_job_id)
    if source is None:
        return None

    resolution_label = next(
        (label for label, res in {
            "4k": (3840, 2160), "1080p": (1920, 1080), "720p": (1280, 720),
            "vertical": (1080, 1920), "square": (1080, 1080),
        }.items() if res == source.resolution),
        "1080p",
    )

    return create_video_job(
        concept=source.concept,
        duration_seconds=source.duration_seconds,
        style=source.style,
        resolution_label=resolution_label,
        fps=source.fps,
        narrate=narrate if narrate is not None else source.narrate,
        narrator_voice=narrator_voice or source.narrator_voice,
        include_music=include_music if include_music is not None else source.include_music,
        storyboard_override=storyboard_override or source.storyboard,
    )


def create_trim_job(source_job_id: str, start_seconds: float, end_seconds: float) -> VideoJob | None:
    """Trim a completed video's final MP4 to [start_seconds, end_seconds] via a fast
    stream-copy ffmpeg cut (no re-encode). Returns a new, already-done job, or None."""
    source = get_video_job(source_job_id)
    if source is None or source.output_path is None or not Path(source.output_path).exists():
        return None

    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return None

    export_root = _resolve_video_export_dir()
    job_id = str(uuid.uuid4())
    output_path = export_root / f"{job_id}.mp4"
    duration = max(0.5, end_seconds - start_seconds)

    cmd = [
        str(ffmpeg), "-y",
        "-ss", str(max(0.0, start_seconds)),
        "-i", str(source.output_path),
        "-t", str(duration),
        "-c", "copy",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or not output_path.exists():
        return None

    job = VideoJob(
        job_id=job_id,
        concept=f"{source.concept} (trimmed {start_seconds:.1f}s–{end_seconds:.1f}s)",
        duration_seconds=int(duration),
        style=source.style,
        resolution=source.resolution,
        fps=source.fps,
        status="done",
        progress=100,
        message="Trimmed from source video.",
        output_path=str(output_path),
    )
    with _LOCK:
        _JOBS[job_id] = job
    return job


def create_export_job(source_job_id: str, resolution_label: str) -> VideoJob | None:
    """Re-encode a completed video's final MP4 to a different resolution. Returns a new,
    already-done job, or None."""
    source = get_video_job(source_job_id)
    if source is None or source.output_path is None or not Path(source.output_path).exists():
        return None

    ffmpeg = _find_ffmpeg_executable()
    if ffmpeg is None:
        return None

    res_map = {
        "4k": (3840, 2160), "1080p": (1920, 1080), "720p": (1280, 720),
        "vertical": (1080, 1920), "square": (1080, 1080),
    }
    resolution = res_map.get(resolution_label.lower(), (1920, 1080))
    w, h = resolution

    export_root = _resolve_video_export_dir()
    job_id = str(uuid.uuid4())
    output_path = export_root / f"{job_id}.mp4"

    cmd = [
        str(ffmpeg), "-y",
        "-i", str(source.output_path),
        "-vf", f"scale={w}:{h}:flags=lanczos",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=MAX_DURATION_SECONDS * 2)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or not output_path.exists():
        return None

    job = VideoJob(
        job_id=job_id,
        concept=f"{source.concept} ({resolution_label} export)",
        duration_seconds=source.duration_seconds,
        style=source.style,
        resolution=resolution,
        fps=source.fps,
        status="done",
        progress=100,
        message=f"Exported at {resolution_label}.",
        output_path=str(output_path),
    )
    with _LOCK:
        _JOBS[job_id] = job
    return job


def get_video_job(job_id: str) -> VideoJob | None:
    with _LOCK:
        return _JOBS.get(job_id)


def list_video_jobs() -> list[dict[str, Any]]:
    with _LOCK:
        return [j.to_dict() for j in sorted(_JOBS.values(), key=lambda x: x.created_at, reverse=True)]


def get_video_output_path(job_id: str) -> Path | None:
    with _LOCK:
        job = _JOBS.get(job_id)
    if job is None or job.output_path is None:
        return None
    p = Path(job.output_path)
    return p if p.exists() else None





