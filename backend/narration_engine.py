"""
Narration Engine — free text-to-speech voiceover via edge-tts (Microsoft Edge TTS).

No API key required, ever. Provides a curated catalogue of male/female voices
across several English accents plus a few common foreign languages, used by
the Video Studio to narrate generated storyboards.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

# Friendly voice id -> (edge-tts short name, display label, language, gender)
VOICE_CATALOGUE: dict[str, dict[str, str]] = {
    "en-US-female":  {"voice": "en-US-AriaNeural",     "label": "American English (Female)",  "language": "English (US)",     "gender": "female"},
    "en-US-male":    {"voice": "en-US-GuyNeural",      "label": "American English (Male)",     "language": "English (US)",     "gender": "male"},
    "en-GB-female":  {"voice": "en-GB-SoniaNeural",    "label": "British English (Female)",    "language": "English (UK)",     "gender": "female"},
    "en-GB-male":    {"voice": "en-GB-RyanNeural",     "label": "British English (Male)",      "language": "English (UK)",     "gender": "male"},
    "en-AU-female":  {"voice": "en-AU-NatashaNeural",  "label": "Australian English (Female)", "language": "English (AU)",     "gender": "female"},
    "en-AU-male":    {"voice": "en-AU-WilliamNeural",  "label": "Australian English (Male)",    "language": "English (AU)",     "gender": "male"},
    "en-IN-female":  {"voice": "en-IN-NeerjaNeural",   "label": "Indian English (Female)",      "language": "English (IN)",     "gender": "female"},
    "en-IN-male":    {"voice": "en-IN-PrabhatNeural",  "label": "Indian English (Male)",        "language": "English (IN)",     "gender": "male"},
    "es-ES-female":  {"voice": "es-ES-ElviraNeural",   "label": "Spanish (Female)",             "language": "Spanish (ES)",     "gender": "female"},
    "es-ES-male":    {"voice": "es-ES-AlvaroNeural",   "label": "Spanish (Male)",               "language": "Spanish (ES)",     "gender": "male"},
    "fr-FR-female":  {"voice": "fr-FR-DeniseNeural",   "label": "French (Female)",              "language": "French (FR)",      "gender": "female"},
    "fr-FR-male":    {"voice": "fr-FR-HenriNeural",    "label": "French (Male)",                "language": "French (FR)",      "gender": "male"},
    "ja-JP-female":  {"voice": "ja-JP-NanamiNeural",   "label": "Japanese (Female)",            "language": "Japanese (JP)",    "gender": "female"},
    "de-DE-male":    {"voice": "de-DE-ConradNeural",   "label": "German (Male)",                "language": "German (DE)",      "gender": "male"},
}

DEFAULT_VOICE_ID = "en-US-female"


def get_narrator_voices() -> list[dict[str, str]]:
    """Return the voice catalogue for a frontend voice picker."""
    return [{"id": vid, **info} for vid, info in VOICE_CATALOGUE.items()]


def _resolve_voice(voice_id: str) -> str:
    return VOICE_CATALOGUE.get(voice_id, VOICE_CATALOGUE[DEFAULT_VOICE_ID])["voice"]


async def _synthesize_async(text: str, voice: str, output_path: Path) -> bool:
    try:
        import edge_tts  # noqa: PLC0415
    except ImportError:
        return False

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_path))
        return output_path.exists() and output_path.stat().st_size > 0
    except Exception:
        return False


def synthesize_narration(text: str, voice_id: str, output_path: Path) -> bool:
    """Generate a narration audio file for the given text. Returns False on any failure."""
    text = text.strip()
    if not text:
        return False
    voice = _resolve_voice(voice_id)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        return asyncio.run(_synthesize_async(text, voice, output_path))
    except Exception:
        return False
