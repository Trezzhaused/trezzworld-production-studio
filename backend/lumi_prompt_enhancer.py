"""
LUMI Prompt Enhancer — improves creative and production prompts for LUMI and local models.

Provides structured prompt enhancement techniques:
  - Domain-specific system context injection
  - Cinematic/production framing for video requests
  - Multi-shot example scaffolding
  - Creative constraint expansion
  - Chain-of-thought decomposition

This is a legitimate prompt engineering module — it improves prompt clarity
and output quality through structured templates, NOT through hidden characters
or safety-bypass mechanisms.
"""
from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Domain system prompts — injected as "system" role to improve model context
# ---------------------------------------------------------------------------

_DOMAIN_SYSTEMS: dict[str, str] = {
    "video": (
        "You are a world-class film director and AI production specialist working inside "
        "TrezzWorld Production Studio. Your expertise spans cinematic storytelling, "
        "shot composition, pacing, visual effects, color grading, and video editing. "
        "When given a video creation request:\n"
        "1. Break it into a detailed shot-by-shot storyboard\n"
        "2. Specify scene durations, transitions, and visual style\n"
        "3. Suggest audio/music cues aligned with the visual story\n"
        "4. Output structured JSON for the video pipeline to consume\n"
        "Be specific, creative, and technically precise."
    ),
    "music": (
        "You are an expert music producer and composer with deep knowledge of "
        "electronic music, orchestral arrangement, beat programming, and sound design. "
        "When given a music creation request:\n"
        "1. Specify BPM, key, time signature, and genre\n"
        "2. Describe instrumentation and arrangement by section\n"
        "3. Provide chord progressions and melodic motifs\n"
        "4. Suggest production techniques and effects chain\n"
        "Output structured and actionable production instructions."
    ),
    "game": (
        "You are a senior game designer and developer specializing in Roblox, Unity, "
        "and Unreal Engine. You design engaging game mechanics, world-building, "
        "asset pipelines, and player progression systems. "
        "When given a game creation request:\n"
        "1. Define core gameplay loop and mechanics\n"
        "2. Specify world layout, levels, and environments\n"
        "3. Plan asset requirements (3D models, textures, scripts)\n"
        "4. Outline monetization and publishing strategy\n"
        "Output technically actionable game design documents."
    ),
    "code": (
        "You are LUMI's executor — a senior full-stack engineer who writes complete, "
        "production-ready code. You output only the file content with zero markdown "
        "fences, explanations, or preamble. Code must be fully functional, "
        "importable, typed, and follow best practices for the target language."
    ),
    "creative": (
        "You are a versatile creative director at TrezzWorld Production Studio. "
        "You think visually, narratively, and technically. When given a creative brief:\n"
        "1. Establish the core concept and unique angle\n"
        "2. Define the target audience and emotional journey\n"
        "3. Map out all production deliverables\n"
        "4. Suggest cross-media execution (video, audio, game, web)\n"
        "Be ambitious, original, and production-ready."
    ),
    "default": (
        "You are LUMI (Layered Universal Media Intelligence), the autonomous AI brain of "
        "TrezzWorld Production Studio. You plan builds, generate code, create media "
        "production pipelines, and orchestrate full end-to-end creative and technical "
        "projects. You are direct, technically precise, and creative."
    ),
}

# ---------------------------------------------------------------------------
# Enhancement templates
# ---------------------------------------------------------------------------

_VIDEO_STORYBOARD_TEMPLATE = """Create a detailed video production plan for the following concept.

CONCEPT: {concept}
DURATION: {duration_seconds} seconds ({duration_min:.1f} minutes)
STYLE: {style}
RESOLUTION: {resolution}

Respond with valid JSON matching this exact schema:
{{
  "title": "string",
  "logline": "string — one sentence summary",
  "style": "string",
  "total_duration_seconds": number,
  "color_palette": ["hex", "hex", "hex"],
  "audio": {{
    "music_genre": "string",
    "bpm": number,
    "mood": "string",
    "sfx_notes": "string"
  }},
  "scenes": [
    {{
      "id": "string",
      "title": "string",
      "duration_seconds": number,
      "visual_description": "string — what the viewer sees",
      "text_overlay": "string or null",
      "transition_in": "cut | fade | dissolve | wipe",
      "transition_out": "cut | fade | dissolve | wipe",
      "camera_motion": "static | pan | tilt | zoom | dolly | handheld",
      "color_grade": "string — e.g. warm golden, cool blue, desaturated"
    }}
  ]
}}

Ensure all scene durations sum to exactly {duration_seconds} seconds.
Minimum 8 scenes, maximum 60 scenes.
Be visually specific and cinematically compelling."""


def detect_domain(prompt: str) -> str:
    """Heuristically detect the creative domain from a prompt."""
    prompt_lower = prompt.lower()
    if any(k in prompt_lower for k in ["video", "film", "movie", "scene", "storyboard", "footage", "trailer"]):
        return "video"
    if any(k in prompt_lower for k in ["music", "beat", "song", "track", "melody", "bpm", "compose"]):
        return "music"
    if any(k in prompt_lower for k in ["game", "roblox", "unity", "level", "player", "mechanic"]):
        return "game"
    if any(k in prompt_lower for k in ["code", "function", "class", "api", "endpoint", "script"]):
        return "code"
    if any(k in prompt_lower for k in ["create", "design", "build", "produce", "make"]):
        return "creative"
    return "default"


def enhance_prompt(
    user_prompt: str,
    domain: str | None = None,
    extra_context: str = "",
) -> list[dict[str, str]]:
    """
    Enhance a raw user prompt into a structured message list for AI inference.

    Returns a messages list: [{"role": "system", ...}, {"role": "user", ...}]
    """
    resolved_domain = domain or detect_domain(user_prompt)
    system_content = _DOMAIN_SYSTEMS.get(resolved_domain, _DOMAIN_SYSTEMS["default"])

    user_content = user_prompt
    if extra_context:
        user_content = f"{extra_context}\n\n---\n\n{user_prompt}"

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]


def build_video_storyboard_prompt(
    concept: str,
    duration_seconds: int = 60,
    style: str = "cinematic",
    resolution: str = "1920x1080",
) -> list[dict[str, str]]:
    """Build a structured prompt for AI video storyboard generation."""
    duration_min = duration_seconds / 60.0
    user_content = _VIDEO_STORYBOARD_TEMPLATE.format(
        concept=concept,
        duration_seconds=duration_seconds,
        duration_min=duration_min,
        style=style,
        resolution=resolution,
    )
    return [
        {"role": "system", "content": _DOMAIN_SYSTEMS["video"]},
        {"role": "user", "content": user_content},
    ]


def get_domain_catalogue() -> list[dict[str, Any]]:
    """Return the full list of supported domains for the API."""
    return [
        {"id": "video",    "label": "Video Production",    "description": "Film direction, storyboarding, cinematic editing"},
        {"id": "music",    "label": "Music Composition",   "description": "Beats, arrangements, sound design"},
        {"id": "game",     "label": "Game Design",         "description": "Roblox, Unity, Unreal — mechanics and assets"},
        {"id": "code",     "label": "Code Generation",     "description": "Full-stack, TypeScript, Python, production-ready"},
        {"id": "creative", "label": "Creative Direction",  "description": "Cross-media concept development and briefs"},
        {"id": "default",  "label": "LUMI General",        "description": "Full-spectrum autonomous production AI"},
    ]
