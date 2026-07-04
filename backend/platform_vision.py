from __future__ import annotations

from typing import Any

BRANDS = {
    "nike": {
        "id": "nike",
        "name": "Nike Park",
        "domain": "nike.yourplatform.com",
        "logo": "rbxassetid://123456",
        "primaryColor": "#FF4F00",
        "gameTemplates": ["obby", "tycoon"],
        "monetization": {
            "revenueShare": 0.3,
            "platformFee": 5000,
        },
    },
    "marvel": {
        "id": "marvel",
        "name": "Marvel Heroes Simulator",
        "domain": "marvel.yourplatform.com",
        "logo": "rbxassetid://654321",
        "primaryColor": "#ED1D24",
        "gameTemplates": ["rpg", "simulator"],
        "monetization": {
            "revenueShare": 0.25,
            "platformFee": 15000,
        },
    },
}

FRANCHISES = {
    "aether": {
        "id": "aether",
        "name": "Chronicles of Aether",
        "description": "A fantasy RPG universe.",
        "games": ["rpg", "tycoon", "obby", "simulator"],
        "sharedProgression": True,
        "crossGameCurrency": True,
    }
}

ACTIVE_EVENTS = [
    {
        "id": "nike_summer_dash",
        "name": "Nike Summer Dash",
        "brandId": "nike",
        "status": "active",
        "urgency": "Ends in 3 days!",
    }
]

TEMPLATES = ["obby", "tycoon", "rpg", "simulator"]


def get_brand_catalog() -> dict[str, Any]:
    return {"brands": BRANDS}


def get_public_api_surface() -> dict[str, Any]:
    return {
        "templates": TEMPLATES,
        "activeEvents": ACTIVE_EVENTS,
        "franchises": FRANCHISES,
        "brands": BRANDS,
    }


def schedule_liveops_event(brand_id: str, event: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "brandId": brand_id,
        "message": "LiveOps event scheduled",
        "event": event or {"name": "Untitled event"},
    }


def build_platform_vision_status() -> dict[str, Any]:
    return {
        "status": "ready",
        "modules": [
            "visual scripting",
            "mobile companion app",
            "white-label portal",
            "liveops events",
            "franchise system",
            "public API",
        ],
        "brands": list(BRANDS),
        "franchises": list(FRANCHISES),
        "templates": TEMPLATES,
    }
