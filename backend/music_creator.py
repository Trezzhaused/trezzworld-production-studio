"""
Music Creator — AI-guided soundtrack generation pipeline.

Workflow:
  1. Generate a professional composition brief using LUMI / local Ollama.
  2. Synthesize a playable WAV soundtrack from the prompt.
  3. Store the audio asset under exports/music and expose it for download.

No external audio dependencies required. Uses Python standard library wave output.
"""
from __future__ import annotations

import math
import os
import struct
import tempfile
import threading
import time
import uuid
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

EXPORTS_DIR = Path("exports/music")
_SAMPLE_RATE = 22050
_AMPLITUDE = 12000
_LOCK = threading.Lock()
_JOBS: dict[str, "MusicJob"] = {}


def _resolve_music_export_dir() -> Path:
    """Return a writable export directory, falling back to a temp dir when needed."""
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = EXPORTS_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "music"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _write_silent_wav(path: Path, duration_seconds: int = 2) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(_SAMPLE_RATE)
            silence = (0).to_bytes(2, byteorder="little", signed=True)
            wf.writeframes(silence * _SAMPLE_RATE * duration_seconds)
        return True
    except Exception:
        return False



@dataclass
class MusicJob:
    job_id: str
    concept: str
    genre: str
    bpm: int
    mood: str
    duration_seconds: int
    status: str = "queued"
    progress: int = 0
    message: str = ""
    composition: str = ""
    output_path: str | None = None
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
            "composition": self.composition,
            "outputPath": self.output_path,
            "downloadReady": self.output_path is not None and Path(self.output_path).exists(),
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


def _build_music_prompt(job: MusicJob) -> str:
    return (
        f"Compose a detailed music production brief for this soundtrack concept:\n"
        f"Concept: {job.concept}\n"
        f"Genre: {job.genre}\n"
        f"Mood: {job.mood}\n"
        f"BPM: {job.bpm}\n"
        f"Duration: {job.duration_seconds}s\n\n"
        "Include:\n"
        "1. Track title\n"
        "2. Form structure with timestamps\n"
        "3. Instrumentation, orchestration, and sound design\n"
        "4. Chord progression and melodic motif ideas\n"
        "5. Mixing/mastering targets\n"
        "Output as a polished production brief."
    )


def _fallback_composition(job: MusicJob) -> str:
    return (
        f"Track Title: {job.concept[:60]}\n"
        f"Genre: {job.genre}\n"
        f"Mood: {job.mood}\n"
        f"BPM: {job.bpm}\n"
        f"Duration: {job.duration_seconds}s\n\n"
        "Arrangement:\n"
        "Intro 0:00-0:15 — ambient pads and light percussion.\n"
        "Verse 0:15-0:45 — melody enters with warm synths and gentle bass.\n"
        "Chorus 0:45-1:15 — full instrumentation, driving rhythm, heroic lead.\n"
        "Bridge 1:15-1:35 — breakdown with cinematic textures and tension build.\n"
        "Outro 1:35-" + f"{job.duration_seconds}s — return to the main motif and cinematic decay.\n\n"
        "Instrumentation:\n"
        "- Warm pad / strings\n"
        "- Punchy synth bass\n"
        "- Focused lead voice for the main melody\n"
        "- Modern percussion with soft claps and risers\n\n"
        "Mix targets:\n"
        "- -14 LUFS integrated\n"
        "- Clear low end with 80 Hz high-pass on non-bass elements\n"
        "- Wide stereo on pads, centered lead and bass\n"
    )


def _music_seed(job: MusicJob) -> int:
    value = hash((job.concept, job.genre, job.mood, job.bpm))
    return abs(value) % 10000


def _derive_scale(job: MusicJob) -> list[float]:
    root_freqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88]
    root = root_freqs[_music_seed(job) % len(root_freqs)]
    return [root * (2 ** (i / 12)) for i in [0, 2, 4, 5, 7, 9, 11, 12]]


def _section_frequencies(job: MusicJob) -> list[list[float]]:
    scale = _derive_scale(job)
    return [
        [scale[0], scale[2], scale[4]],  # I
        [scale[3], scale[5], scale[0] * 2],  # IV
        [scale[5], scale[0] * 2, scale[2] * 2],  # V
        [scale[4], scale[6], scale[1] * 2],  # vi
    ]


def _write_wave_file(path: Path, job: MusicJob) -> bool:
    duration = max(10, min(job.duration_seconds, 600))
    samples = int(_SAMPLE_RATE * duration)
    chord_sets = _section_frequencies(job)
    beat_duration = 60.0 / max(1, job.bpm)
    bar_duration = beat_duration * 4.0

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(_SAMPLE_RATE)

            chunk_size = 2048
            two_pi = 2.0 * math.pi

            for chunk_start in range(0, samples, chunk_size):
                chunk_end = min(samples, chunk_start + chunk_size)
                frames = bytearray()
                for idx in range(chunk_start, chunk_end):
                    t = idx / _SAMPLE_RATE
                    section_idx = int((t / duration) * len(chord_sets)) % len(chord_sets)
                    chord = chord_sets[section_idx]
                    note = chord[idx % len(chord)]
                    melody_freq = chord[(idx // int(bar_duration * _SAMPLE_RATE)) % len(chord)] * 1.5
                    env = _amplitude_envelope(t, duration)
                    sample = 0.0
                    for freq in chord:
                        sample += math.sin(two_pi * freq * t) * 0.4
                    sample += math.sin(two_pi * melody_freq * t) * 0.25
                    sample *= env * (_AMPLITUDE / 1.8)
                    sample_int = max(-32767, min(32767, int(sample)))
                    frames.extend(struct.pack("<h", sample_int))
                wf.writeframes(frames)
        return True
    except Exception:
        return False


def _amplitude_envelope(t: float, duration: float) -> float:
    if t < 0.05:
        return t / 0.05
    if t > duration - 0.1:
        return max(0.0, (duration - t) / 0.1)
    return 1.0


def _generate_music_asset(job: MusicJob) -> None:
    export_root = _resolve_music_export_dir()
    output = export_root / f"{job.job_id}.wav"
    success = _write_wave_file(output, job)
    if success:
        job.output_path = str(output)
        job.message = "Soundtrack synthesized successfully."
        return

    # Fallback to a minimal silent WAV if synthesis or disk export fails.
    fallback_output = Path(tempfile.gettempdir()) / f"trezzworld-music-{job.job_id}.wav"
    if _write_silent_wav(fallback_output, duration_seconds=min(5, job.duration_seconds)):
        job.output_path = str(fallback_output)
        job.message = (
            "Soundtrack synthesis failed, but a fallback silent WAV is available. "
            "Install more disk space or fix export permissions to generate full audio."
        )
        return

    job.error = "Audio synthesis failed and fallback export could not be written."
    job.message = "Failed to generate soundtrack."


def _generate_composition_brief(job: MusicJob) -> str:
    from .ai_router import get_router  # noqa: PLC0415
    from .ollama_provider import get_ollama  # noqa: PLC0415

    prompt = _build_music_prompt(job)
    ollama = get_ollama()
    if ollama.is_available():
        messages = [
            {"role": "system", "content": (
                "You are an expert music producer and composer. Output a polished, actionable music production brief."
            )},
            {"role": "user", "content": prompt},
        ]
        result = ollama.super_gemma_chat(messages, temperature=0.65, max_tokens=1800)
        if result.ok and result.content:
            return result.content

    router = get_router()
    result = router.lumi_chat(prompt, domain="music")
    if result.ok and result.content:
        return result.content

    return _fallback_composition(job)


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
        update("generating_brief", 10, "Generating composition brief…")
        job.composition = _generate_composition_brief(job)
        update("composing_audio", 35, "Composing soundtrack audio…")

        _generate_music_asset(job)
        if job.error:
            raise RuntimeError(job.error)

        update("encoding", 90, "Finalizing audio file…")
        job.progress = 100
        job.status = "done"
        job.message = "Music job complete."
    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.message = f"Pipeline error: {exc}"
        job.progress = 0
        job.updated_at = time.time()


def create_music_job(
    concept: str,
    genre: str = "cinematic",
    bpm: int = 120,
    mood: str = "epic",
    duration_seconds: int = 60,
) -> MusicJob:
    duration_seconds = max(15, min(duration_seconds, 600))
    job_id = str(uuid.uuid4())
    job = MusicJob(
        job_id=job_id,
        concept=concept,
        genre=genre,
        bpm=bpm,
        mood=mood,
        duration_seconds=duration_seconds,
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
