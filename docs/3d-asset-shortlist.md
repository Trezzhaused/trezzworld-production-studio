# Babylon.js / Roblox 3D asset shortlist

This is a first-pass shortlist for TrezzWorld’s browser-based 3D runtime and Roblox-style game prototyping. Every item below is a Sketchfab-linked or Sketchfab-adjacent asset pack that was surfaced as downloadable and commercially usable when reviewed; however, the license should still be re-checked on the live Sketchfab page before you download or ship anything.

## Recommended first-pass bundle

| Category | Recommended asset | Why it fits | License to verify | Link |
| --- | --- | --- | --- | --- |
| Main hero | 100 Avatars R1 - CC0 Character Pack | Good starter set for a stylized hero and a larger cast of characters | CC0 / public domain | https://sketchfab.com/3d-models/100-avatars-r1-cc0-character-pack-c96f3acfd68140c6af6da81c8efaac7d |
| Rival / NPCs | Ultimate Platformer Pack | Handy for animated enemies, side characters, and simple game-ready movers | CC0 / public domain | https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed |
| Environment kit | MOMUS Park - CC0 Asset Pack | Colorful modular environment pack for parks, plazas, exploration zones, and scenic gameplay areas | CC0 / public domain | https://sketchfab.com/3d-models/momus-park-cc0-asset-pack-5b40d57fad8d48dd9452e258b3389578 |
| Props | CC0 Game Ready 3D Models | Strong fit for barrels, furniture, containers, signage, and generic world props | CC0 / public domain | https://sketchfab.com/Absalom3D/collections/cc0-game-ready-1a328ac625a24c38a4548bec60dad058 |
| Animations | Ultimate Platformer Pack | Includes character loops such as idle, walk, run, and jump that work well for prototype play | CC0 / public domain | https://sketchfab.com/3d-models/ultimate-platformer-pack-100-models-8e016bcf877a4ea18a3eef6ae4a1a6ed |

## Suggested import strategy

1. Download the assets into a local `assets/3d/<category>/` structure.
2. Convert or re-export them to glTF/GLB where needed for Babylon.js and Roblox-ready workflows.
3. Keep a small, curated library first: hero, one rival, one environment set, one prop pack, and one animation pack.
4. Add attribution text in the project docs if the Sketchfab page requires it, even when the asset is CC0.

## Notes

- Prefer CC0 or public-domain assets first for the fastest legal path to prototype and launch.
- If you want a more “premium” look later, purchase a commercial asset pack and replace the free pack with a licensed variant.
- For Roblox, keep the final asset naming consistent with the manifest used by the backend 3D asset route.
