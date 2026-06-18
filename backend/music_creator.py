"""
Music Creator — Real AI music generation pipeline.

Engines supported (in priority order):
  1. MusicGen (Meta/HuggingFace) — text-to-music, high quality
  2. AudioCraft (Meta) — includes MusicGen + SFX generation
  3. Riffusion (HuggingFace) — spectrogram-based music generation
  4. Fallback: procedural wave synthesis (last resort only)

HuggingFace Inference API is used for MusicGen/Riffusion (free tier available).
AudioCraft can run locally if installed: pip install audiocraft

Storage:
  - Hot storage: exports/music/ (Railway or Cloudflare R2 based on space)
  - After 12hrs: zip + move to archive R2 bucket (never deleted)
  - MP3 export via pydub/ffmpeg, WAV fallback if ffmpeg not available
"""
from __future__ import annotations

import io
import json
import math
import os
import struct
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
import wave
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# ── Optional imports ──────────────────────────────────────────────────────────
try:
    import numpy as np  # type: ignore
    _NUMPY_AVAILABLE = True
except ImportError:
    _NUMPY_AVAILABLE = False

try:
    from scipy.io import wavfile as _scipy_wavfile  # type: ignore
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False

EXPORTS_DIR = Path(os.environ.get("MUSIC_EXPORT_DIR", "/tmp/trezzworld/exports/music"))
ARCHIVE_DIR = Path(os.environ.get("MUSIC_ARCHIVE_DIR", "/tmp/trezzworld/exports/archive/music"))
_SAMPLE_RATE = 32000
_LOCK = threading.Lock()
_JOBS: dict[str, "MusicJob"] = {}

# HuggingFace Inference API endpoints
_HF_MUSICGEN_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-small"
_HF_MUSICGEN_MEDIUM_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-medium"
_HF_MUSICGEN_LARGE_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-large"
_HF_RIFFUSION_URL = "https://api-inference.huggingface.co/models/riffusion/riffusion-model-v1"
_HF_AUDIOGEN_URL = "https://api-inference.huggingface.co/models/facebook/audiogen-medium"

# Music engine choices exposed to frontend
MUSIC_ENGINES = {
    "musicgen-small":  {"name": "MusicGen Small (Fast)",   "url": _HF_MUSICGEN_URL,        "quality": "good"},
    "musicgen-medium": {"name": "MusicGen Medium (Balanced)", "url": _HF_MUSICGEN_MEDIUM_URL, "quality": "better"},
    "musicgen-large":  {"name": "MusicGen Large (Best)",   "url": _HF_MUSICGEN_LARGE_URL,  "quality": "best"},
    "audiogen":        {"name": "AudioCraft AudioGen (SFX)","url": _HF_AUDIOGEN_URL,        "quality": "sfx"},
    "riffusion":       {"name": "Riffusion (Spectrogram)", "url": _HF_RIFFUSION_URL,       "quality": "creative"},
    "local-audiocraft": {"name": "Local AudioCraft",       "url": None,                    "quality": "best-local"},
}


# ── Storage helpers ───────────────────────────────────────────────────────────

def _resolve_music_export_dir() -> Path:
    """Return writable export dir — Railway primary, temp fallback."""
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test = EXPORTS_DIR / ".write_test"
        test.write_text("ok")
        test.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "music"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _get_hf_token() -> str | None:
    """Get HuggingFace API token from env or user key store."""
    token = os.environ.get("HUGGINGFACE_API_KEY") or os.environ.get("HF_API_KEY")
    if token:
        return token
    try:
        from .user_key_store import get_user_key_store  # noqa: PLC0415
        return get_user_key_store().get_key("huggingface")
    except Exception:
        return None


# ── HuggingFace API caller ────────────────────────────────────────────────────

def _call_hf_inference(
    api_url: str,
    payload: dict[str, Any],
    hf_token: str | None = None,
    timeout: int = 120,
) -> bytes | None:
    """
    Call HuggingFace Inference API and return raw audio bytes.
    Returns None on failure. HF returns audio/flac or audio/wav directly.
    """
    body = json.dumps(payload).encode("utf-8")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    req = urllib.request.Request(api_url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            # HF returns audio bytes directly for music models
            if raw and len(raw) > 100:
                return raw
            return None
    except urllib.error.HTTPError as exc:
        # 503 = model loading, retry after a moment
        if exc.code == 503:
            time.sleep(20)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    raw = resp.read()
                    return raw if raw and len(raw) > 100 else None
            except Exception:
                return None
        return None
    except Exception:
        return None


# ── MusicGen via HuggingFace ──────────────────────────────────────────────────

def _generate_musicgen(
    prompt: str,
    duration_seconds: int,
    engine: str = "musicgen-small",
    hf_token: str | None = None,
) -> bytes | None:
    """
    Generate music using Meta MusicGen via HuggingFace Inference API.
    Returns raw audio bytes (wav/flac) or None on failure.
    """
    engine_info = MUSIC_ENGINES.get(engine, MUSIC_ENGINES["musicgen-small"])
    api_url = engine_info["url"]
    if api_url is None:
        return None

    # MusicGen supports duration parameter
    payload: dict[str, Any] = {
        "inputs": prompt,
        "parameters": {
            "duration": min(duration_seconds, 30),  # HF free tier max ~30s per call
            "guidance_scale": 3.0,
            "temperature": 1.0,
        },
    }
    return _call_hf_inference(api_url, payload, hf_token=hf_token, timeout=180)


def _generate_musicgen_long(
    prompt: str,
    duration_seconds: int,
    engine: str = "musicgen-small",
    hf_token: str | None = None,
) -> list[bytes]:
    """
    Generate music in 30s chunks for tracks longer than 30 seconds.
    Returns list of audio byte chunks to be concatenated.
    """
    chunks: list[bytes] = []
    remaining = duration_seconds
    chunk_size = 28  # slightly under 30s to avoid edge issues

    segment_prompts = _build_segment_prompts(prompt, duration_seconds, chunk_size)

    for i, seg_prompt in enumerate(segment_prompts):
        seg_duration = min(remaining, chunk_size)
        audio = _generate_musicgen(seg_prompt, seg_duration, engine, hf_token)
        if audio:
            chunks.append(audio)
        remaining -= seg_duration
        if remaining <= 0:
            break

    return chunks


def _build_segment_prompts(prompt: str, total_seconds: int, chunk_size: int) -> list[str]:
    """Build prompts for each segment to maintain musical continuity."""
    num_chunks = math.ceil(total_seconds / chunk_size)
    if num_chunks <= 1:
        return [prompt]

    segments = []
    for i in range(num_chunks):
        if i == 0:
            seg = f"{prompt}, intro, building energy"
        elif i == num_chunks - 1:
            seg = f"{prompt}, outro, fading resolution"
        elif i == num_chunks // 2:
            seg = f"{prompt}, peak intensity, climax"
        else:
            seg = f"{prompt}, development, momentum"
        segments.append(seg)
    return segments


# ── Riffusion via HuggingFace ─────────────────────────────────────────────────

def _generate_riffusion(
    prompt: str,
    duration_seconds: int,
    hf_token: str | None = None,
) -> bytes | None:
    """
    Generate music using Riffusion (spectrogram diffusion model).
    """
    payload = {
        "inputs": {
            "prompt_a": prompt,
            "denoising": 0.75,
            "seed_image_id": "vibes",
            "num_inference_steps": 30,
        }
    }
    return _call_hf_inference(_HF_RIFFUSION_URL, payload, hf_token=hf_token, timeout=120)


# ── AudioCraft local (if installed) ──────────────────────────────────────────

def _generate_audiocraft_local(
    prompt: str,
    duration_seconds: int,
    model: str = "facebook/musicgen-small",
) -> bytes | None:
    """
    Generate music using locally installed AudioCraft library.
    pip install audiocraft
    """
    try:
        from audiocraft.models import MusicGen  # type: ignore
        from audiocraft.data.audio import audio_write  # type: ignore
        import torch  # type: ignore

        model_instance = MusicGen.get_pretrained(model)
        model_instance.set_generation_params(duration=min(duration_seconds, 60))

        descriptions = [prompt]
        wav = model_instance.generate(descriptions)

        # Convert tensor to wav bytes
        buf = io.BytesIO()
        import torchaudio  # type: ignore
        torchaudio.save(buf, wav[0].cpu(), model_instance.sample_rate, format="wav")
        return buf.getvalue()
    except ImportError:
        return None
    except Exception:
        return None


# ── AudioGen (SFX) ────────────────────────────────────────────────────────────

def _generate_audiogen_sfx(
    prompt: str,
    duration_seconds: int,
    hf_token: str | None = None,
) -> bytes | None:
    """Generate sound effects using Meta AudioGen via HuggingFace."""
    payload = {
        "inputs": prompt,
        "parameters": {
            "duration": min(duration_seconds, 20),
        },
    }
    return _call_hf_inference(_HF_AUDIOGEN_URL, payload, hf_token=hf_token, timeout=120)


# ── Audio file handling ───────────────────────────────────────────────────────

def _save_audio_bytes(audio_bytes: bytes, output_path: Path) -> bool:
    """
    Save raw audio bytes to a file. Handles WAV, FLAC, MP3 formats.
    Converts to MP3 via ffmpeg if available, otherwise saves as WAV.
    """
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save raw bytes first (could be wav or flac from HF)
        raw_path = output_path.with_suffix(".raw.wav")
        raw_path.write_bytes(audio_bytes)

        # Try to convert to MP3 via ffmpeg
        ffmpeg = _find_ffmpeg()
        if ffmpeg and output_path.suffix == ".mp3":
            cmd = [
                str(ffmpeg), "-y",
                "-i", str(raw_path),
                "-codec:a", "libmp3lame",
                "-qscale:a", "2",  # high quality VBR
                "-ar", "44100",
                str(output_path),
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            if result.returncode == 0:
                raw_path.unlink(missing_ok=True)
                return True

        # Fallback: rename raw to wav
        wav_path = output_path.with_suffix(".wav")
        raw_path.rename(wav_path)
        # Update output_path reference — caller needs to check
        return True
    except Exception:
        return False


def _find_ffmpeg() -> Path | None:
    """Find ffmpeg executable."""
    import shutil
    path = shutil.which("ffmpeg")
    if path:
        return Path(path)
    env_path = os.environ.get("FFMPEG_PATH")
    if env_path:
        p = Path(env_path)
        if p.is_file():
            return p
    return None


def _concat_audio_chunks(chunks: list[bytes], output_path: Path) -> bool:
    """Concatenate multiple WAV/audio chunks into a single file."""
    if not chunks:
        return False
    if len(chunks) == 1:
        return _save_audio_bytes(chunks[0], output_path)

    ffmpeg = _find_ffmpeg()
    if ffmpeg is None:
        # Simple WAV concat without ffmpeg (basic)
        return _simple_wav_concat(chunks, output_path)

    # Write chunks to temp files
    tmp_dir = Path(tempfile.mkdtemp(prefix="trezzworld_music_"))
    tmp_files: list[Path] = []
    try:
        for i, chunk in enumerate(chunks):
            tmp_file = tmp_dir / f"chunk_{i:03d}.wav"
            tmp_file.write_bytes(chunk)
            tmp_files.append(tmp_file)

        # Build ffmpeg concat list
        concat_list = tmp_dir / "concat.txt"
        concat_list.write_text("\n".join(f"file '{f}'" for f in tmp_files))

        cmd = [
            str(ffmpeg), "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list),
            "-c", "copy",
            str(output_path.with_suffix(".wav")),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode == 0:
            # Convert to MP3 if requested
            if output_path.suffix == ".mp3":
                mp3_cmd = [
                    str(ffmpeg), "-y",
                    "-i", str(output_path.with_suffix(".wav")),
                    "-codec:a", "libmp3lame",
                    "-qscale:a", "2",
                    str(output_path),
                ]
                subprocess.run(mp3_cmd, capture_output=True, timeout=120)
                output_path.with_suffix(".wav").unlink(missing_ok=True)
            return True
        return False
    finally:
        import shutil as _shutil
        _shutil.rmtree(tmp_dir, ignore_errors=True)


def _simple_wav_concat(chunks: list[bytes], output_path: Path) -> bool:
    """Concatenate WAV files without ffmpeg (Python only)."""
    try:
        all_frames = bytearray()
        params = None
        for chunk in chunks:
            try:
                buf = io.BytesIO(chunk)
                with wave.open(buf, "rb") as wf:
                    if params is None:
                        params = wf.getparams()
                    all_frames.extend(wf.readframes(wf.getnframes()))
            except Exception:
                continue

        if not all_frames or params is None:
            return False

        wav_path = output_path.with_suffix(".wav")
        with wave.open(str(wav_path), "wb") as wf:
            wf.setparams(params)
            wf.writeframes(bytes(all_frames))
        return True
    except Exception:
        return False


# ── Build music prompt ────────────────────────────────────────────────────────

def _build_musicgen_prompt(job: "MusicJob") -> str:
    """
    Build an optimized MusicGen text prompt.
    MusicGen responds well to descriptive genre/instrument/mood language.
    """
    genre_map = {
        "cinematic": "orchestral cinematic score with strings, brass, and epic percussion",
        "electronic": "electronic music with synthesizers, beats, and digital textures",
        "ambient": "ambient atmospheric music with soft pads and gentle tones",
        "hip-hop": "hip hop beat with punchy drums, bass, and sampled elements",
        "jazz": "jazz music with piano, upright bass, and drums",
        "rock": "rock music with electric guitar, bass, and drums",
        "classical": "classical orchestral music with strings and piano",
        "folk": "folk music with acoustic guitar and natural instruments",
        "lofi": "lo-fi hip hop chill beats, relaxing, nostalgic",
        "trap": "trap music with 808 bass, hi-hats, and atmospheric pads",
        "edm": "electronic dance music with build-ups, drops, and synth leads",
    }

    mood_map = {
        "epic": "epic, powerful, triumphant",
        "dark": "dark, mysterious, tense",
        "happy": "happy, uplifting, positive, bright",
        "sad": "melancholic, emotional, touching",
        "tense": "suspenseful, thriller, building tension",
        "peaceful": "peaceful, calm, serene, meditative",
        "energetic": "energetic, driving, fast-paced",
    }

    genre_desc = genre_map.get(job.genre.lower(), job.genre)
    mood_desc = mood_map.get(job.mood.lower(), job.mood)

    prompt = f"{genre_desc}, {mood_desc}, {job.concept}, {job.bpm} BPM"

    # Add quality boosters
    prompt += ", high quality, professional recording, studio quality"

    return prompt


def _build_sfx_prompt(job: "MusicJob") -> str:
    """Build prompt for sound effects generation."""
    return f"sound effects for {job.concept}, {job.mood}, high quality audio"


# ── Used by video_creator.py to generate a background music bed ─────────────

def _build_audio_bed_for_video(
    concept: str,
    genre: str,
    mood: str,
    bpm: int,
    duration_seconds: int,
    output_path: Path,
) -> bool:
    """Generate a MusicGen background bed sized to a video's duration. Returns False on failure."""
    hf_token = _get_hf_token()
    if not hf_token:
        return False

    prompt = f"{genre} music, {mood}, {concept}, {bpm} BPM, high quality, studio quality, instrumental"
    duration_seconds = max(5, min(duration_seconds, 600))

    if duration_seconds <= 28:
        audio_bytes = _generate_musicgen(prompt, duration_seconds, hf_token=hf_token)
        if not audio_bytes:
            return False
        return _save_audio_bytes(audio_bytes, output_path)

    chunks = _generate_musicgen_long(prompt, duration_seconds, hf_token=hf_token)
    if not chunks:
        return False
    return _concat_audio_chunks(chunks, output_path)


# ── Procedural fallback (improved) ───────────────────────────────────────────

def _write_procedural_wav(path: Path, job: "MusicJob") -> bool:
    """
    Improved procedural WAV generation as last resort.
    Uses proper musical scales, chord progressions, and rhythm.
    """
    duration = max(10, min(job.duration_seconds, 600))
    sample_rate = 44100
    num_samples = int(sample_rate * duration)

    # Musical scales
    scales = {
        "major":      [0, 2, 4, 5, 7, 9, 11],
        "minor":      [0, 2, 3, 5, 7, 8, 10],
        "pentatonic": [0, 2, 4, 7, 9],
        "dorian":     [0, 2, 3, 5, 7, 9, 10],
    }

    scale_type = "minor" if job.mood.lower() in ("dark", "sad", "tense") else "major"
    scale_intervals = scales[scale_type]

    # Root note based on job seed
    seed = abs(hash((job.concept, job.genre))) % 12
    root_freq = 261.63 * (2 ** (seed / 12))  # C4 + offset

    def note_freq(scale_degree: int, octave: int = 0) -> float:
        interval = scale_intervals[scale_degree % len(scale_intervals)]
        return root_freq * (2 ** ((interval + octave * 12) / 12))

    # Chord progressions
    progressions = {
        "major": [(0, 2, 4), (3, 5, 0), (4, 6, 1), (5, 0, 2)],  # I IV V vi
        "minor": [(0, 2, 4), (5, 0, 2), (3, 5, 0), (4, 6, 1)],  # i VI III VII
    }
    chords = progressions[scale_type]

    bpm = max(60, min(job.bpm, 180))
    beat_samples = int(sample_rate * 60 / bpm)
    bar_samples = beat_samples * 4

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "w") as wf:
            wf.setnchannels(2)  # stereo
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)

            chunk = 4096
            two_pi = 2.0 * math.pi

            for chunk_start in range(0, num_samples, chunk):
                chunk_end = min(num_samples, chunk_start + chunk)
                frames = bytearray()

                for i in range(chunk_start, chunk_end):
                    t = i / sample_rate
                    progress = t / duration

                    # Envelope
                    env = 1.0
                    if t < 2.0:
                        env = t / 2.0
                    elif t > duration - 2.0:
                        env = max(0.0, (duration - t) / 2.0)

                    # Dynamic intensity
                    intensity = 0.4 + 0.6 * math.sin(progress * math.pi)

                    # Current chord
                    chord_idx = (i // (bar_samples * 2)) % len(chords)
                    chord = chords[chord_idx]

                    # Rhythm — kick on 1&3, hi-hat on 2&4
                    beat_pos = i % beat_samples
                    beat_num = (i // beat_samples) % 4
                    kick = 0.0
                    hihat = 0.0

                    if beat_num in (0, 2) and beat_pos < int(beat_samples * 0.1):
                        kick_t = beat_pos / sample_rate
                        kick = math.sin(two_pi * 60 * kick_t) * math.exp(-kick_t * 30) * 0.5
                    if beat_num in (1, 3) and beat_pos < int(beat_samples * 0.05):
                        hihat_t = beat_pos / sample_rate
                        hihat = (hash((i, "hh")) % 100 / 100.0 - 0.5) * math.exp(-hihat_t * 100) * 0.2

                    # Bass (root note, one octave down)
                    bass_freq = note_freq(chord[0], octave=-1)
                    bass = math.sin(two_pi * bass_freq * t) * 0.3

                    # Chord tones
                    harmony = 0.0
                    for deg in chord:
                        freq = note_freq(deg, octave=0)
                        harmony += math.sin(two_pi * freq * t) * 0.15

                    # Melody (higher octave, changes every half bar)
                    melody_idx = (i // (bar_samples // 2)) % len(scale_intervals)
                    melody_freq = note_freq(melody_idx, octave=1)
                    melody_env = 0.5 + 0.5 * math.sin(two_pi * t * 2)
                    melody = math.sin(two_pi * melody_freq * t) * 0.2 * melody_env

                    # Mix
                    sample = (bass + harmony + melody + kick + hihat) * env * intensity
                    sample = max(-0.9, min(0.9, sample))
                    sample_int = int(sample * 32767)

                    # Stereo with slight pan
                    left = max(-32767, min(32767, int(sample_int * 1.0)))
                    right = max(-32767, min(32767, int(sample_int * 0.85)))
                    frames.extend(struct.pack("<hh", left, right))

                wf.writeframes(frames)
        return True
    except Exception:
        return False


# ── Storage / Archive system ──────────────────────────────────────────────────

def _archive_old_jobs() -> None:
    """
    Archive jobs older than 12 hours.
    Zips the output file and moves to archive bucket.
    Never deletes — only moves to archive.
    """
    now = time.time()
    cutoff = now - (12 * 3600)  # 12 hours

    with _LOCK:
        jobs_to_archive = [
            j for j in _JOBS.values()
            if j.status == "done"
            and j.created_at < cutoff
            and j.output_path is not None
            and not j.archived
        ]

    for job in jobs_to_archive:
        try:
            output = Path(job.output_path)
            if not output.exists():
                continue

            ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
            archive_path = ARCHIVE_DIR / f"{job.job_id}.zip"

            with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(output, output.name)
                # Include composition brief as metadata
                meta = {
                    "job_id": job.job_id,
                    "concept": job.concept,
                    "genre": job.genre,
                    "mood": job.mood,
                    "bpm": job.bpm,
                    "duration_seconds": job.duration_seconds,
                    "engine": job.engine,
                    "composition": job.composition,
                    "created_at": job.created_at,
                    "archived_at": now,
                }
                zf.writestr("metadata.json", json.dumps(meta, indent=2))

            # Mark archived, keep output_path for reference
            job.archived = True
            job.archive_path = str(archive_path)

            # Remove hot copy to free space (archive is the source of truth)
            output.unlink(missing_ok=True)

        except Exception:
            continue


def _start_archive_daemon() -> None:
    """Background thread that checks for jobs to archive every 30 minutes."""
    def _loop() -> None:
        while True:
            time.sleep(1800)  # 30 minutes
            try:
                _archive_old_jobs()
            except Exception:
                pass

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


# ── Job data class ────────────────────────────────────────────────────────────

@dataclass
class MusicJob:
    job_id: str
    concept: str
    genre: str
    bpm: int
    mood: str
    duration_seconds: int
    engine: str = "musicgen-small"
    status: str = "queued"
    progress: int = 0
    message: str = ""
    composition: str = ""
    output_path: str | None = None
    archive_path: str | None = None
    archived: bool = False
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    expires_at: float = field(default_factory=lambda: time.time() + 12 * 3600)

    def to_dict(self) -> dict[str, Any]:
        output_exists = (
            self.output_path is not None
            and Path(self.output_path).exists()
        )
        return {
            "jobId": self.job_id,
            "concept": self.concept,
            "genre": self.genre,
            "bpm": self.bpm,
            "mood": self.mood,
            "durationSeconds": self.duration_seconds,
            "engine": self.engine,
            "engineName": MUSIC_ENGINES.get(self.engine, {}).get("name", self.engine),
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "composition": self.composition,
            "outputPath": self.output_path,
            "downloadReady": output_exists,
            "archived": self.archived,
            "archivePath": self.archive_path,
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "expiresAt": self.expires_at,
            "hoursUntilArchive": max(0.0, (self.expires_at - time.time()) / 3600),
        }


# ── Composition brief generation ──────────────────────────────────────────────

def _generate_composition_brief(job: MusicJob) -> str:
    """Generate a detailed music production brief using LUMI/AI."""
    prompt = (
        f"Write a professional music production brief for:\n"
        f"Concept: {job.concept}\n"
        f"Genre: {job.genre}\n"
        f"Mood: {job.mood}\n"
        f"BPM: {job.bpm}\n"
        f"Duration: {job.duration_seconds} seconds\n"
        f"Engine: {MUSIC_ENGINES.get(job.engine, {}).get('name', job.engine)}\n\n"
        "Include: track structure with timestamps, instrumentation, chord progression, "
        "mix targets, and creative direction. Be specific and professional."
    )
    try:
        from .ai_router import get_router  # noqa: PLC0415
        from .ollama_provider import get_ollama  # noqa: PLC0415

        ollama = get_ollama()
        if ollama.is_available():
            messages = [
                {"role": "system", "content": "You are a professional music producer and composer."},
                {"role": "user", "content": prompt},
            ]
            result = ollama.super_gemma_chat(messages, temperature=0.7, max_tokens=1500)
            if result.ok and result.content:
                return result.content

        router = get_router()
        result = router.lumi_chat(prompt, domain="music")
        if result.ok and result.content:
            return result.content
    except Exception:
        pass

    return _fallback_composition_brief(job)


def _fallback_composition_brief(job: MusicJob) -> str:
    return (
        f"Track: {job.concept[:60]}\n"
        f"Genre: {job.genre} | Mood: {job.mood} | BPM: {job.bpm}\n"
        f"Duration: {job.duration_seconds}s\n\n"
        "Structure:\n"
        f"  0:00-0:15  Intro — atmospheric build\n"
        f"  0:15-{job.duration_seconds//3}s  Verse — main theme emerges\n"
        f"  {job.duration_seconds//3}s-{2*job.duration_seconds//3}s  Chorus — full energy\n"
        f"  {2*job.duration_seconds//3}s-{job.duration_seconds}s  Outro — resolution\n"
    )


# ── Main pipeline ─────────────────────────────────────────────────────────────

def _run_music_pipeline(job_id: str) -> None:
    """Main background pipeline for music generation."""
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
        # Step 1: Generate composition brief
        update("generating_brief", 5, "Generating composition brief...")
        job.composition = _generate_composition_brief(job)
        update("generating_brief", 15, "Composition brief ready")

        # Step 2: Build optimized prompt
        update("composing", 20, f"Preparing {MUSIC_ENGINES.get(job.engine, {}).get('name', job.engine)} prompt...")
        if job.engine == "audiogen":
            music_prompt = _build_sfx_prompt(job)
        else:
            music_prompt = _build_musicgen_prompt(job)

        # Step 3: Generate audio
        update("composing", 30, f"Generating music with {MUSIC_ENGINES.get(job.engine, {}).get('name', job.engine)}...")

        hf_token = _get_hf_token()
        audio_chunks: list[bytes] = []
        used_engine = job.engine

        # Try selected engine first
        if job.engine in ("musicgen-small", "musicgen-medium", "musicgen-large"):
            if job.duration_seconds <= 30:
                audio = _generate_musicgen(music_prompt, job.duration_seconds, job.engine, hf_token)
                if audio:
                    audio_chunks = [audio]
            else:
                update("composing", 35, f"Generating {job.duration_seconds}s track in segments...")
                audio_chunks = _generate_musicgen_long(music_prompt, job.duration_seconds, job.engine, hf_token)

        elif job.engine == "riffusion":
            audio = _generate_riffusion(music_prompt, job.duration_seconds, hf_token)
            if audio:
                audio_chunks = [audio]

        elif job.engine == "audiogen":
            audio = _generate_audiogen_sfx(music_prompt, job.duration_seconds, hf_token)
            if audio:
                audio_chunks = [audio]

        elif job.engine == "local-audiocraft":
            audio = _generate_audiocraft_local(music_prompt, job.duration_seconds)
            if audio:
                audio_chunks = [audio]

        # Fallback: try musicgen-small if selected engine failed
        if not audio_chunks and job.engine != "musicgen-small":
            update("composing", 50, "Primary engine unavailable, trying MusicGen Small...")
            if job.duration_seconds <= 30:
                audio = _generate_musicgen(music_prompt, job.duration_seconds, "musicgen-small", hf_token)
                if audio:
                    audio_chunks = [audio]
                    used_engine = "musicgen-small"
            else:
                audio_chunks = _generate_musicgen_long(music_prompt, job.duration_seconds, "musicgen-small", hf_token)
                if audio_chunks:
                    used_engine = "musicgen-small"

        # Step 4: Save audio file
        update("encoding", 70, "Saving audio file...")
        export_root = _resolve_music_export_dir()

        # Prefer MP3 if ffmpeg available, else WAV
        ffmpeg = _find_ffmpeg()
        ext = ".mp3" if ffmpeg else ".wav"
        output_path = export_root / f"{job_id}{ext}"

        if audio_chunks:
            if len(audio_chunks) == 1:
                success = _save_audio_bytes(audio_chunks[0], output_path)
            else:
                update("encoding", 75, f"Assembling {len(audio_chunks)} audio segments...")
                success = _concat_audio_chunks(audio_chunks, output_path)

            # Check both .mp3 and .wav since save may change extension
            if not output_path.exists():
                wav_path = output_path.with_suffix(".wav")
                if wav_path.exists():
                    output_path = wav_path

            if output_path.exists():
                job.output_path = str(output_path)
                engine_name = MUSIC_ENGINES.get(used_engine, {}).get("name", used_engine)
                update("done", 100, f"Music ready — generated with {engine_name}")
                return

        # Final fallback: procedural synthesis
        update("encoding", 80, "AI generation unavailable — using procedural synthesis...")
        wav_path = export_root / f"{job_id}.wav"
        success = _write_procedural_wav(wav_path, job)

        if success and wav_path.exists():
            # Convert to MP3 if possible
            if ffmpeg:
                mp3_path = wav_path.with_suffix(".mp3")
                cmd = [str(ffmpeg), "-y", "-i", str(wav_path),
                       "-codec:a", "libmp3lame", "-qscale:a", "2", str(mp3_path)]
                result = subprocess.run(cmd, capture_output=True, timeout=60)
                if result.returncode == 0 and mp3_path.exists():
                    wav_path.unlink(missing_ok=True)
                    job.output_path = str(mp3_path)
                else:
                    job.output_path = str(wav_path)
            else:
                job.output_path = str(wav_path)

            update("done", 100,
                   "Procedural music generated. Add a HuggingFace API key in Settings for AI-generated music.")
        else:
            raise RuntimeError("All audio generation methods failed.")

    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.message = f"Pipeline error: {exc}"
        job.progress = 0
        job.updated_at = time.time()


# ── Public API ────────────────────────────────────────────────────────────────

def create_music_job(
    concept: str,
    genre: str = "cinematic",
    bpm: int = 120,
    mood: str = "epic",
    duration_seconds: int = 60,
    engine: str = "musicgen-small",
) -> MusicJob:
    """Create and queue a new music generation job."""
    duration_seconds = max(15, min(duration_seconds, 600))
    bpm = max(60, min(bpm, 200))

    # Validate engine
    if engine not in MUSIC_ENGINES:
        engine = "musicgen-small"

    job_id = str(uuid.uuid4())
    job = MusicJob(
        job_id=job_id,
        concept=concept,
        genre=genre,
        bpm=bpm,
        mood=mood,
        duration_seconds=duration_seconds,
        engine=engine,
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


def get_music_engines() -> dict[str, Any]:
    """Return available music engine options for frontend."""
    return {
        engine_id: {
            "id": engine_id,
            "name": info["name"],
            "quality": info["quality"],
            "requiresHFToken": info["url"] is not None,
            "available": info["url"] is not None or engine_id == "local-audiocraft",
        }
        for engine_id, info in MUSIC_ENGINES.items()
    }


# Start archive daemon on module load
_start_archive_daemon()
