from __future__ import annotations

from typing import Any


def build_three_d_asset_manifest() -> dict[str, Any]:
    """Return a backend-friendly catalog for browser-based 3D runtime assets."""
    return {
        "engine": "babylonjs",
        "runtime": {
            "renderer": "WebGL",
            "supports": ["glb", "gltf", "fbx", "obj"],
            "features": [
                "real-time scene preview",
                "camera orbit controls",
                "mesh and animation hooks",
                "Roblox/Studio-friendly asset packaging"
            ],
        },
        "assetCategories": [
            {
                "id": "main-hero",
                "label": "Main hero",
                "recommendedAsset": {
                    "title": "100 Avatars R1 - CC0 Character Pack",
                    "source": "Sketchfab",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/3d-models/100-avatars-r1-cc0-character-pack-c96f3acfd68140c6af6da81c8efaac7d",
                    "notes": "Excellent for a stylized hero/NPC roster; verify the current model page before download.",
                },
            },
            {
                "id": "rival-npcs",
                "label": "Rival / NPCs",
                "recommendedAsset": {
                    "title": "Ultimate Platformer Pack",
                    "source": "Sketchfab / Quaternius",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed",
                    "notes": "Good for animated platformer-style enemies and side characters.",
                },
            },
            {
                "id": "environment-kit",
                "label": "Environment kit",
                "recommendedAsset": {
                    "title": "MOMUS Park - CC0 Asset Pack",
                    "source": "Sketchfab",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/3d-models/momus-park-cc0-asset-pack-5b40d57fad8d48dd9452e258b3389578",
                    "notes": "Modular, colorful environment kit for worlds, parks, and exploration zones.",
                },
            },
            {
                "id": "props",
                "label": "Props",
                "recommendedAsset": {
                    "title": "CC0 Game Ready 3D Models",
                    "source": "Sketchfab",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/Absalom3D/collections/cc0-game-ready-1a328ac625a24c38a4548bec60dad058",
                    "notes": "Useful for barrels, furniture, containers, and world props.",
                },
            },
            {
                "id": "animations",
                "label": "Animations",
                "recommendedAsset": {
                    "title": "Ultimate Platformer Pack",
                    "source": "Sketchfab / Quaternius",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed",
                    "notes": "Includes character loops such as idle, walk, run, and jump animations.",
                },
            },
        ],
        "notes": [
            "Use only assets whose Sketchfab license page currently allows commercial use.",
            "Prefer CC0 or public-domain assets for the fastest legal path to prototype and launch.",
            "Keep downloaded files in a consistent assets/3d/<category> structure for later import into Babylon.js and Roblox Studio.",
        ],
    }
