"""
Roblox Game Suite Creator — LUMI-driven end-to-end Roblox game production.

Workflow:
  1. User provides a game concept + configuration
  2. LUMI generates a full game design document (mechanics, levels, assets)
  3. LUMI generates Lua/Luau source files (server scripts, local scripts, modules)
  4. All output is packaged into a downloadable ZIP (Rojo-compatible project structure)

The ZIP can be opened in Roblox Studio via Rojo sync or imported manually.
"""
from __future__ import annotations

import io
import json
import os
import re
import tempfile
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

EXPORTS_DIR = Path(os.environ.get("ROBLOX_EXPORT_DIR", "/tmp/trezzworld/exports/roblox"))
_JOBS: dict[str, "RobloxJob"] = {}
_LOCK = threading.Lock()


def _resolve_roblox_export_dir() -> Path:
    """Return a writable export directory, falling back to a temp dir when needed."""
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = EXPORTS_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "roblox"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class RobloxJob:
    job_id: str
    concept: str
    genre: str
    max_players: int
    monetization: str
    status: str = "queued"       # queued | designing | scripting | packaging | done | error
    progress: int = 0
    message: str = ""
    design_doc: dict[str, Any] = field(default_factory=dict)
    scripts: list[dict[str, str]] = field(default_factory=list)  # [{path, content}]
    output_path: str | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "jobId": self.job_id,
            "concept": self.concept,
            "genre": self.genre,
            "maxPlayers": self.max_players,
            "monetization": self.monetization,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "designDoc": self.design_doc,
            "scriptCount": len(self.scripts),
            "outputPath": self.output_path,
            "downloadReady": self.output_path is not None and Path(self.output_path).exists(),
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


# ---------------------------------------------------------------------------
# LUMI prompts
# ---------------------------------------------------------------------------

_DESIGN_DOC_PROMPT = """You are a senior Roblox game designer working inside TrezzWorld Production Studio.

Design a complete, production-ready Roblox game for the following concept.

CONCEPT: {concept}
GENRE: {genre}
MAX PLAYERS: {max_players}
MONETIZATION: {monetization}

Respond with valid JSON matching this EXACT schema:
{{
  "title": "string — game title",
  "tagline": "string — one sentence pitch",
  "genre": "string",
  "maxPlayers": number,
  "description": "string — full Roblox marketplace description (300+ words)",
  "coreLoop": "string — describe the core gameplay loop in 3-5 sentences",
  "mechanics": [
    {{"name": "string", "description": "string", "priority": "core|secondary|stretch"}}
  ],
  "worlds": [
    {{
      "id": "string",
      "name": "string",
      "theme": "string",
      "description": "string",
      "keyLocations": ["string"]
    }}
  ],
  "playerProgression": {{
    "levels": number,
    "xpSources": ["string"],
    "rewards": ["string"],
    "prestigeSystem": boolean
  }},
  "assets": {{
    "models": ["string — asset description"],
    "textures": ["string"],
    "sounds": ["string"],
    "animations": ["string"]
  }},
  "monetization": {{
    "strategy": "string",
    "gamepasses": [{{"name": "string", "price": number, "description": "string"}}],
    "developerProducts": [{{"name": "string", "price": number, "description": "string"}}],
    "freeToPlay": boolean
  }},
  "publishingPlan": {{
    "targetAudience": "string",
    "launchPhases": ["string"],
    "socialStrategy": "string",
    "estimatedPlayers": "string"
  }},
  "technicalNotes": "string — Roblox API features and architecture notes"
}}

Be specific, original, and production-ready."""


_SCRIPTS_PROMPT = """You are an expert Roblox Luau developer inside TrezzWorld Production Studio.

Generate the complete Luau source code for this Roblox game.

GAME TITLE: {title}
GENRE: {genre}
CORE LOOP: {core_loop}
MECHANICS: {mechanics_summary}
WORLDS: {worlds_summary}

Generate a complete set of Luau scripts. Respond with valid JSON:
{{
  "scripts": [
    {{
      "path": "string — Rojo-compatible path e.g. src/ServerScriptService/GameCore.server.lua",
      "type": "server|local|module",
      "description": "string — what this script does",
      "content": "string — complete, runnable Luau source code"
    }}
  ]
}}

Required scripts (minimum):
1. src/ServerScriptService/GameCore.server.lua — main game loop, round management
2. src/ServerScriptService/DataStore.server.lua — player data persistence (DataStoreService)
3. src/ServerScriptService/PlayerManager.server.lua — player join/leave, stats init
4. src/ReplicatedStorage/GameConfig.lua — shared constants and config (ModuleScript)
5. src/StarterPlayerScripts/PlayerController.client.lua — input handling, UI updates
6. src/StarterPlayerScripts/UIManager.client.lua — HUD, menus, notifications
7. src/ReplicatedStorage/RemoteEvents.lua — all RemoteEvents/RemoteFunctions setup

All code must be complete, commented, and use modern Luau syntax with type annotations where appropriate.
Use task.wait() instead of wait(). Use game:GetService() for all services."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _call_lumi(messages: list[dict[str, str]], max_tokens: int = 4000) -> str:
    """Call LUMI via AI router with Ollama fallback."""
    from .ai_router import get_router  # noqa: PLC0415
    from .ollama_provider import get_ollama  # noqa: PLC0415

    ollama = get_ollama()
    if ollama.is_available():
        result = ollama.super_gemma_chat(messages, temperature=0.55, max_tokens=max_tokens)
        if result.ok and result.content:
            return result.content

    router = get_router()
    result = router.chat(messages, role="planner", temperature=0.55, max_tokens=max_tokens)
    if result.ok and result.content:
        return result.content
    return ""


def _parse_json(text: str) -> dict[str, Any] | None:
    """Extract JSON from AI response (handles markdown fences)."""
    text = re.sub(r"```(?:json|lua|luau)?\s*", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _fallback_design_doc(job: RobloxJob) -> dict[str, Any]:
    """Minimal design doc when AI is unavailable."""
    return {
        "title": job.concept[:60],
        "tagline": f"An epic {job.genre} experience for up to {job.max_players} players.",
        "genre": job.genre,
        "maxPlayers": job.max_players,
        "description": f"{job.concept}\n\nA TrezzWorld Production Studio game.",
        "coreLoop": "Players explore the world, complete objectives, earn XP, and level up.",
        "mechanics": [
            {"name": "Exploration", "description": "Open world exploration", "priority": "core"},
            {"name": "Combat", "description": "Real-time combat system", "priority": "core"},
            {"name": "Progression", "description": "XP and leveling system", "priority": "core"},
        ],
        "worlds": [{"id": "world_01", "name": "Main World", "theme": job.genre,
                    "description": "The primary game environment.", "keyLocations": ["Spawn", "Hub", "Arena"]}],
        "playerProgression": {"levels": 50, "xpSources": ["quests", "combat", "exploration"],
                               "rewards": ["gear", "cosmetics", "abilities"], "prestigeSystem": False},
        "assets": {"models": ["Player Character", "NPC Enemy", "Environment Props"],
                   "textures": ["Ground Texture", "Sky Texture"],
                   "sounds": ["Background Music", "SFX Pack"],
                   "animations": ["Walk", "Run", "Jump", "Attack"]},
        "monetization": {"strategy": job.monetization, "gamepasses": [], "developerProducts": [], "freeToPlay": True},
        "publishingPlan": {"targetAudience": "All ages", "launchPhases": ["Beta", "Launch"],
                           "socialStrategy": "Roblox Groups + Discord", "estimatedPlayers": "1K-10K"},
        "technicalNotes": "Standard Roblox architecture with client-server separation.",
    }


def _safe_datastore_name(title: str) -> str:
    """Return a Roblox DataStore-safe name (alphanumeric + underscores only)."""
    return re.sub(r"[^a-zA-Z0-9_]", "_", title)


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert a CSS hex color string to an (R, G, B) tuple."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return r, g, b


def _fallback_scripts(job: RobloxJob, design: dict[str, Any]) -> list[dict[str, str]]:
    """Minimal script set when AI is unavailable."""
    title = design.get("title", job.concept)
    return [
        {
            "path": "src/ServerScriptService/GameCore.server.lua",
            "type": "server",
            "description": "Main game loop and round management",
            "content": f'''-- GameCore.server.lua
-- {title} — Main Game Loop
-- Generated by TrezzWorld Production Studio / LUMI

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- Config
local ROUND_DURATION = 120 -- seconds
local MIN_PLAYERS = 2

local function onPlayerAdded(player: Player)
    print("[GameCore] Player joined:", player.Name)
end

local function onPlayerRemoving(player: Player)
    print("[GameCore] Player left:", player.Name)
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Main game loop
while true do
    local playerCount = #Players:GetPlayers()
    if playerCount >= MIN_PLAYERS then
        print("[GameCore] Round starting with", playerCount, "players")
        task.wait(ROUND_DURATION)
        print("[GameCore] Round ended")
    else
        task.wait(5)
    end
end
''',
        },
        {
            "path": "src/ServerScriptService/DataStore.server.lua",
            "type": "server",
            "description": "Player data persistence",
            "content": f'''-- DataStore.server.lua
-- {title} — Player Data Persistence
-- Generated by TrezzWorld Production Studio / LUMI

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local playerDataStore = DataStoreService:GetDataStore("{_safe_datastore_name(title)}_PlayerData_v1")

local DEFAULT_DATA = {{
    level = 1,
    xp = 0,
    coins = 0,
    playtime = 0,
}}

local function loadData(player: Player)
    local userId = player.UserId
    local success, data = pcall(function()
        return playerDataStore:GetAsync(tostring(userId))
    end)
    if success and data then
        return data
    end
    return table.clone(DEFAULT_DATA)
end

local function saveData(player: Player, data: table)
    local userId = player.UserId
    local success, err = pcall(function()
        playerDataStore:SetAsync(tostring(userId), data)
    end)
    if not success then
        warn("[DataStore] Save failed for", player.Name, err)
    end
end

local playerData: {{[number]: table}} = {{}}

Players.PlayerAdded:Connect(function(player)
    playerData[player.UserId] = loadData(player)
    print("[DataStore] Loaded data for", player.Name)
end)

Players.PlayerRemoving:Connect(function(player)
    if playerData[player.UserId] then
        saveData(player, playerData[player.UserId])
        playerData[player.UserId] = nil
    end
end)

game:BindToClose(function()
    for _, player in Players:GetPlayers() do
        if playerData[player.UserId] then
            saveData(player, playerData[player.UserId])
        end
    end
end)
''',
        },
        {
            "path": "src/ReplicatedStorage/GameConfig.lua",
            "type": "module",
            "description": "Shared game constants and configuration",
            "content": f'''-- GameConfig.lua (ModuleScript)
-- {title} — Shared Configuration
-- Generated by TrezzWorld Production Studio / LUMI

local GameConfig = {{}}

GameConfig.GAME_NAME = "{title}"
GameConfig.GENRE = "{job.genre}"
GameConfig.MAX_PLAYERS = {job.max_players}
GameConfig.VERSION = "1.0.0"

-- Gameplay settings
GameConfig.ROUND_DURATION = 120
GameConfig.RESPAWN_TIME = 5
GameConfig.XP_PER_LEVEL = 1000

-- UI Colors
GameConfig.COLORS = {{
    Primary = Color3.fromRGB{_hex_to_rgb("38bdf8")},
    Secondary = Color3.fromRGB{_hex_to_rgb("0a1628")},
    Accent = Color3.fromRGB{_hex_to_rgb("f59e0b")},
    Success = Color3.fromRGB{_hex_to_rgb("22c55e")},
    Danger = Color3.fromRGB{_hex_to_rgb("ef4444")},
}}

return GameConfig
''',
        },
        {
            "path": "src/StarterPlayerScripts/UIManager.client.lua",
            "type": "local",
            "description": "HUD and UI management",
            "content": f'''-- UIManager.client.lua
-- {title} — UI Manager
-- Generated by TrezzWorld Production Studio / LUMI

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Main HUD ScreenGui
local hud = Instance.new("ScreenGui")
hud.Name = "MainHUD"
hud.ResetOnSpawn = false
hud.Parent = playerGui

-- Level label
local levelLabel = Instance.new("TextLabel")
levelLabel.Name = "LevelLabel"
levelLabel.Size = UDim2.new(0, 200, 0, 40)
levelLabel.Position = UDim2.new(0, 20, 0, 20)
levelLabel.BackgroundTransparency = 0.5
levelLabel.BackgroundColor3 = Color3.fromRGB{_hex_to_rgb("0a1628")}
levelLabel.TextColor3 = Color3.fromRGB{_hex_to_rgb("38bdf8")}
levelLabel.Text = "Level 1"
levelLabel.TextScaled = true
levelLabel.Font = Enum.Font.GothamBold
levelLabel.Parent = hud

print("[UIManager] HUD initialized for", player.Name)
''',
        },
        {
            "path": "default.project.json",
            "type": "module",
            "description": "Rojo project file for syncing with Roblox Studio",
            "content": json.dumps({
                "name": title,
                "tree": {
                    "$className": "DataModel",
                    "ServerScriptService": {
                        "$className": "ServerScriptService",
                        "$path": "src/ServerScriptService"
                    },
                    "ReplicatedStorage": {
                        "$className": "ReplicatedStorage",
                        "$path": "src/ReplicatedStorage"
                    },
                    "StarterPlayer": {
                        "$className": "StarterPlayer",
                        "StarterPlayerScripts": {
                            "$className": "StarterPlayerScripts",
                            "$path": "src/StarterPlayerScripts"
                        }
                    }
                }
            }, indent=2),
        },
    ]


# ---------------------------------------------------------------------------
# ZIP packaging
# ---------------------------------------------------------------------------

def _build_zip(job: RobloxJob, design: dict[str, Any]) -> Path:
    """Package the game project into a ZIP file."""
    export_dir = _resolve_roblox_export_dir()
    zip_path = export_dir / f"{job.job_id}.zip"
    title_slug = re.sub(r"[^a-z0-9]+", "-", design.get("title", "roblox-game").lower()).strip("-")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Design document
        zf.writestr(
            f"{title_slug}/design_document.json",
            json.dumps(design, indent=2),
        )
        # Readme
        readme = _build_readme(design)
        zf.writestr(f"{title_slug}/README.md", readme)

        # Lua scripts
        for script in job.scripts:
            zf.writestr(
                f"{title_slug}/{script['path']}",
                script["content"],
            )

    return zip_path


def _build_readme(design: dict[str, Any]) -> str:
    title = design.get("title", "Roblox Game")
    tagline = design.get("tagline", "")
    worlds = design.get("worlds", [])
    world_names = ", ".join(w.get("name", "") for w in worlds)
    gamepasses = design.get("monetization", {}).get("gamepasses", [])
    pass_names = ", ".join(gp.get("name", "") for gp in gamepasses) if gamepasses else "None"

    return f"""# {title}

> {tagline}

**Generated by TrezzWorld Production Studio / LUMI**

## Getting Started (Rojo)

1. Install [Rojo](https://rojo.space/) and [Roblox Studio](https://www.roblox.com/create)
2. Extract this ZIP
3. In a terminal inside the project folder:
   ```
   rojo serve default.project.json
   ```
4. In Roblox Studio → Rojo plugin → Connect
5. All scripts will sync automatically.

## Project Structure

```
src/
  ServerScriptService/   ← Server-side Lua scripts
  ReplicatedStorage/     ← Shared ModuleScripts
  StarterPlayerScripts/  ← Client-side LocalScripts
default.project.json     ← Rojo project manifest
design_document.json     ← Full game design document
```

## Worlds / Environments
{world_names or "See design_document.json"}

## Monetization
Gamepasses: {pass_names}

## Description
{design.get("description", "")[:500]}

---
*Built with [TrezzWorld Production Studio](https://app.trezzhaus.com)*
"""


# ---------------------------------------------------------------------------
# Pipeline executor (background thread)
# ---------------------------------------------------------------------------

def _run_roblox_pipeline(job_id: str) -> None:
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
        # Step 1: Generate design document
        update("designing", 5, "LUMI is designing your Roblox game…")

        design_prompt = _DESIGN_DOC_PROMPT.format(
            concept=job.concept,
            genre=job.genre,
            max_players=job.max_players,
            monetization=job.monetization,
        )
        design_response = _call_lumi(
            [
                {"role": "system", "content": "You are a senior Roblox game designer. Respond only with valid JSON."},
                {"role": "user", "content": design_prompt},
            ],
            max_tokens=4000,
        )
        design = _parse_json(design_response) if design_response else None
        if not design:
            design = _fallback_design_doc(job)

        job.design_doc = design
        update("designing", 30, f"Game design ready: {design.get('title', job.concept)}")

        # Step 2: Generate Lua scripts
        update("scripting", 35, "LUMI is writing Luau scripts…")

        mechanics_summary = "; ".join(
            m.get("name", "") for m in design.get("mechanics", [])[:5]
        )
        worlds_summary = "; ".join(
            w.get("name", "") for w in design.get("worlds", [])[:3]
        )
        scripts_prompt = _SCRIPTS_PROMPT.format(
            title=design.get("title", job.concept),
            genre=job.genre,
            core_loop=design.get("coreLoop", ""),
            mechanics_summary=mechanics_summary,
            worlds_summary=worlds_summary,
        )
        scripts_response = _call_lumi(
            [
                {"role": "system", "content": "You are an expert Roblox Luau developer. Respond only with valid JSON."},
                {"role": "user", "content": scripts_prompt},
            ],
            max_tokens=6000,
        )
        scripts_data = _parse_json(scripts_response) if scripts_response else None
        if scripts_data and isinstance(scripts_data.get("scripts"), list):
            job.scripts = scripts_data["scripts"]
        else:
            job.scripts = _fallback_scripts(job, design)

        update("scripting", 75, f"{len(job.scripts)} scripts generated")

        # Step 3: Package into ZIP
        update("packaging", 80, "Packaging game project…")
        zip_path = _build_zip(job, design)

        update("done", 100, f"Game ready: {zip_path.name}")
        job.output_path = str(zip_path)

    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.progress = 0
        job.message = f"Pipeline error: {exc}"
        job.updated_at = time.time()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_roblox_job(
    concept: str,
    genre: str = "Adventure",
    max_players: int = 20,
    monetization: str = "freemium",
) -> RobloxJob:
    """Create and queue a new Roblox game creation job."""
    job_id = str(uuid.uuid4())
    job = RobloxJob(
        job_id=job_id,
        concept=concept,
        genre=genre,
        max_players=max(2, min(max_players, 100)),
        monetization=monetization,
    )
    with _LOCK:
        _JOBS[job_id] = job

    thread = threading.Thread(target=_run_roblox_pipeline, args=(job_id,), daemon=True)
    thread.start()
    return job


def get_roblox_job(job_id: str) -> RobloxJob | None:
    with _LOCK:
        return _JOBS.get(job_id)


def list_roblox_jobs() -> list[dict[str, Any]]:
    with _LOCK:
        return [j.to_dict() for j in sorted(_JOBS.values(), key=lambda x: x.created_at, reverse=True)]


def get_roblox_output_path(job_id: str) -> Path | None:
    with _LOCK:
        job = _JOBS.get(job_id)
    if job is None or job.output_path is None:
        return None
    p = Path(job.output_path)
    return p if p.exists() else None
