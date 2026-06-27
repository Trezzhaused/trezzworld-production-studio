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
                "Roblox/Studio-friendly asset packaging",
            ],
        },
        "assetCategories": [
            {
                "id": "main-hero",
                "label": "Main hero / avatar roster",
                "recommendedAsset": {
                    "title": "100 Avatars R1 - CC0 Character Pack",
                    "source": "Sketchfab",
                    "license": "CC0",
                    "downloadUrl": "https://sketchfab.com/3d-models/100-avatars-r1-cc0-character-pack-c96f3acfd68140c6af6da81c8efaac7d",
                    "notes": "Excellent for a stylized hero/NPC roster and Roblox-ready avatar casting.",
                },
                "reviewCandidates": [
                    {
                        "title": "100 Avatars R1 - CC0 Character Pack",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/3d-models/100-avatars-r1-cc0-character-pack-c96f3acfd68140c6af6da81c8efaac7d",
                        "notes": "High-volume character roster for hero and NPC roles.",
                    },
                    {
                        "title": "Kenney's Character Pack",
                        "source": "Kenney",
                        "license": "CC0",
                        "downloadUrl": "https://www.kenney.nl/assets",
                        "notes": "Low-poly style fits lightweight gameplay scenes and Roblox performance budgets.",
                    },
                ],
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
                "reviewCandidates": [
                    {
                        "title": "Ultimate Platformer Pack",
                        "source": "Sketchfab / Quaternius",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed",
                        "notes": "Strong pick for combat enemies, mobs, and platformer loops.",
                    },
                    {
                        "title": "CC0 Monster / Creature Pack",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/search?features=downloadable&q=CC0%20monster",
                        "notes": "Useful when the project needs more stylized or fantasy-themed adversaries.",
                    },
                ],
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
                "reviewCandidates": [
                    {
                        "title": "MOMUS Park - CC0 Asset Pack",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/3d-models/momus-park-cc0-asset-pack-5b40d57fad8d48dd9452e258b3389578",
                        "notes": "Great for vibrant open-world and plaza-style scenes.",
                    },
                    {
                        "title": "Kenney's Nature Kit",
                        "source": "Kenney",
                        "license": "CC0",
                        "downloadUrl": "https://www.kenney.nl/assets",
                        "notes": "Solid fallback for trees, rocks, terrain, and natural biomes.",
                    },
                ],
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
                "reviewCandidates": [
                    {
                        "title": "CC0 Game Ready 3D Models",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/Absalom3D/collections/cc0-game-ready-1a328ac625a24c38a4548bec60dad058",
                        "notes": "Best for furniture, containers, and interactive scene clutter.",
                    },
                    {
                        "title": "Kenney's Furniture Pack",
                        "source": "Kenney",
                        "license": "CC0",
                        "downloadUrl": "https://www.kenney.nl/assets",
                        "notes": "Simple, modular props that import well into both Babylon.js and Roblox Studio.",
                    },
                ],
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
                "reviewCandidates": [
                    {
                        "title": "Ultimate Platformer Pack",
                        "source": "Sketchfab / Quaternius",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed",
                        "notes": "Useful for platformer-style movement states and combat loops.",
                    },
                    {
                        "title": "Mixamo animation library",
                        "source": "Adobe Mixamo",
                        "license": "Standard Mixamo license for commercial use; verify current terms",
                        "downloadUrl": "https://www.mixamo.com",
                        "notes": "Good fallback for full-body motion capture and mocap-style loops when the CC0 pack is insufficient.",
                    },
                ],
            },
            {
                "id": "vehicles",
                "label": "Vehicles / transport",
                "recommendedAsset": {
                    "title": "Low Poly Vehicles Pack",
                    "source": "Kenney",
                    "license": "CC0",
                    "downloadUrl": "https://www.kenney.nl/assets",
                    "notes": "A practical fit for city exploration, racing, and transport-focused gameplay loops.",
                },
                "reviewCandidates": [
                    {
                        "title": "Low Poly Vehicles Pack",
                        "source": "Kenney",
                        "license": "CC0",
                        "downloadUrl": "https://www.kenney.nl/assets",
                        "notes": "Good starting point for cars, bikes, and simple transport props.",
                    },
                    {
                        "title": "CC0 vehicle / transport models",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/search?features=downloadable&q=CC0%20vehicle",
                        "notes": "Useful when the build requires more stylized or themed vehicle sets.",
                    },
                ],
            },
            {
                "id": "skybox",
                "label": "Skybox / environment lighting",
                "recommendedAsset": {
                    "title": "Poly Haven HDRIs",
                    "source": "Poly Haven",
                    "license": "CC0",
                    "downloadUrl": "https://polyhaven.com/hdris",
                    "notes": "Ideal for atmosphere, skyboxes, and lighting setup in the 3D world preview.",
                },
                "reviewCandidates": [
                    {
                        "title": "Poly Haven HDRIs",
                        "source": "Poly Haven",
                        "license": "CC0",
                        "downloadUrl": "https://polyhaven.com/hdris",
                        "notes": "Strong choice for reflective interiors and outdoor sky setups.",
                    },
                    {
                        "title": "CC0 skybox / cube map packs",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/search?features=downloadable&q=CC0%20skybox",
                        "notes": "A useful fallback if the project needs a more specific or stylized skybox.",
                    },
                ],
            },
            {
                "id": "ui-hud",
                "label": "UI / HUD",
                "recommendedAsset": {
                    "title": "Kenney's UI Pack",
                    "source": "Kenney",
                    "license": "CC0",
                    "downloadUrl": "https://www.kenney.nl/assets/ui-pack",
                    "notes": "Useful for menus, health bars, minimaps, and other game UI overlays.",
                },
                "reviewCandidates": [
                    {
                        "title": "Kenney's UI Pack",
                        "source": "Kenney",
                        "license": "CC0",
                        "downloadUrl": "https://www.kenney.nl/assets/ui-pack",
                        "notes": "Best fit for Roblox-style HUDs and menu panels.",
                    },
                    {
                        "title": "CC0 UI / menu asset kits",
                        "source": "Sketchfab",
                        "license": "CC0",
                        "downloadUrl": "https://sketchfab.com/search?features=downloadable&q=CC0%20UI",
                        "notes": "Helpful when the build needs more polished or thematic interface elements.",
                    },
                ],
            },
        ],
        "notes": [
            "Use only assets whose current license page allows commercial use and redistribution in shipped games.",
            "Prefer CC0 or public-domain assets for the fastest legal path to prototype and launch.",
            "For Roblox, favor low-poly meshes and textures that fit Studio performance budgets and import limits.",
            "Keep downloaded files in a consistent assets/3d/<category> structure for later import into Babylon.js and Roblox Studio.",
        ],
    }
