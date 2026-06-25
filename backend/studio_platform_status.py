from __future__ import annotations

import os
from typing import Any

from .trezzhaus_auth import AUTH_API_BASE


def _has_value(name: str) -> bool:
    return bool(os.environ.get(name, "").strip())


def build_studio_platform_status() -> dict[str, Any]:
    roblox_oauth_configured = all(
        _has_value(name)
        for name in (
            "ROBLOX_OAUTH_CLIENT_ID",
            "ROBLOX_OAUTH_CLIENT_SECRET",
            "ROBLOX_OAUTH_REDIRECT_URI",
        )
    )
    roblox_publish_configured = _has_value("ROBLOX_API_KEY")

    return {
        "accessibility": {
            "summary": "Studio is being hardened for keyboard-first use, screen readers, and refreshable braille displays through semantic HTML and clear live status updates.",
            "brailleReady": True,
            "checks": [
                {"id": "keyboard", "label": "Keyboard navigation", "status": "active"},
                {"id": "screen-reader", "label": "Screen-reader semantics", "status": "active"},
                {"id": "live-regions", "label": "Live status announcements", "status": "active"},
                {"id": "contrast", "label": "High-contrast dark UI", "status": "active"},
                {"id": "captions", "label": "Media transcript/caption follow-up", "status": "planned"},
            ],
            "notes": [
                "Braille support on the web is delivered by compatibility with assistive technology such as screen readers and refreshable braille displays.",
                "Interactive surfaces should expose labels, focus order, and non-visual status changes without relying on hover alone.",
            ],
        },
        "integrations": {
            "origins": {
                "studio": os.environ.get("STUDIO_PUBLIC_URL", "https://studio.trezzhaus.com"),
                "app": os.environ.get("APP_TREZZHAUS_ORIGIN", "https://app.trezzhaus.com"),
                "authApi": AUTH_API_BASE,
            },
            "services": [
                {
                    "id": "trezzhaus-auth",
                    "label": "TrezzHaus account SSO",
                    "status": "ready" if AUTH_API_BASE else "needs-config",
                    "detail": AUTH_API_BASE or "Missing TREZZHAUS_AUTH_API_BASE",
                },
                {
                    "id": "lumi-openrouter",
                    "label": "LUMI / OpenRouter cascade",
                    "status": "ready" if _has_value("OPENROUTER_API_KEY") else "needs-config",
                    "detail": "OPENROUTER_API_KEY configured" if _has_value("OPENROUTER_API_KEY") else "Set OPENROUTER_API_KEY",
                },
                {
                    "id": "image-generation",
                    "label": "Image generation",
                    "status": "ready" if _has_value("OPENAI_API_KEY") else "partial",
                    "detail": "Configured for direct image output" if _has_value("OPENAI_API_KEY") else "User key or OPENAI_API_KEY required for real image generation",
                },
                {
                    "id": "roblox-oauth",
                    "label": "Roblox OAuth",
                    "status": "ready" if roblox_oauth_configured else "needs-config",
                    "detail": "OAuth client is configured" if roblox_oauth_configured else "Set Roblox OAuth client ID, secret, and redirect URI",
                },
                {
                    "id": "roblox-publish",
                    "label": "Roblox Open Cloud publish",
                    "status": "ready" if roblox_publish_configured else "needs-config",
                    "detail": "ROBLOX_API_KEY configured" if roblox_publish_configured else "Set ROBLOX_API_KEY for place publishing",
                },
            ],
            "repoBoundaries": [
                "This repository owns the studio UI and API surfaces for content production, Roblox tooling, and LUMI orchestration.",
                "Cross-repo app.trezzhaus.com tutor and student safety enforcement still need coordinated implementation in the app codebase that consumes these APIs.",
            ],
        },
        "safety": {
            "summary": "Current guardrails prioritize truthful capability reporting, educator/developer use, and explicit review before student-facing deployment.",
            "guidelines": [
                "Do not claim files, uploads, or external actions happened unless the system actually produced them.",
                "Keep creator workflows human-approved for publishing, monetization, and deployment.",
                "Treat K-12/student-facing rollout as a separate compliance phase requiring COPPA/privacy review and moderated assistant behavior.",
                "Do not expose secrets, tokens, or account credentials in prompts, logs, or generated content.",
            ],
            "studentDeploymentReady": False,
        },
    }
