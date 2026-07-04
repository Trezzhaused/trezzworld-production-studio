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
    universe_id: str | None = None
    place_id: str | None = None
    status: str = "queued"       # queued | designing | scripting | packaging | done | error
    progress: int = 0
    message: str = ""
    design_doc: dict[str, Any] = field(default_factory=dict)
    scripts: list[dict[str, str]] = field(default_factory=list)  # [{path, content}]
    monetization_assets: list[dict[str, Any]] = field(default_factory=list)
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
            "universeId": self.universe_id,
            "placeId": self.place_id,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "designDoc": self.design_doc,
            "scriptCount": len(self.scripts),
            "monetizationAssets": self.monetization_assets,
            "outputPath": self.output_path,
            "downloadReady": self.output_path is not None and Path(self.output_path).exists(),
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "RobloxJob":
        # Note: `scripts` content isn't in to_dict()'s payload (only scriptCount is),
        # so a rehydrated job loses script content after a restart — the ZIP at
        # output_path still has them; only the live /scripts endpoint would be empty.
        return cls(
            job_id=d["jobId"],
            concept=d.get("concept", ""),
            genre=d.get("genre", "Adventure"),
            max_players=d.get("maxPlayers", 20),
            monetization=d.get("monetization", "freemium"),
            universe_id=d.get("universeId"),
            place_id=d.get("placeId"),
            status=d.get("status", "done"),
            progress=d.get("progress", 0),
            message=d.get("message", ""),
            design_doc=d.get("designDoc") or {},
            monetization_assets=d.get("monetizationAssets") or [],
            output_path=d.get("outputPath"),
            error=d.get("error"),
            created_at=d.get("createdAt", time.time()),
            updated_at=d.get("updatedAt", time.time()),
        )


def _persist_roblox_job(job: "RobloxJob") -> None:
    from .job_store import save_job  # noqa: PLC0415
    save_job("roblox", job.job_id, job.to_dict())


def _load_persisted_roblox_jobs() -> None:
    try:
        from .job_store import load_jobs  # noqa: PLC0415
        for data in load_jobs("roblox"):
            try:
                job = RobloxJob.from_dict(data)
                _JOBS[job.job_id] = job
            except Exception:
                continue
    except Exception:
        pass


_load_persisted_roblox_jobs()


def _publish_studio_snapshot(job: "RobloxJob") -> None:
    """Publish the latest generated script payload into the Roblox studio bridge."""
    try:
        from .roblox_studio_bridge import get_studio_bridge  # noqa: PLC0415
        bridge = get_studio_bridge()
        bridge.record_snapshot(job.job_id, prompt=job.concept, files=job.scripts)
    except Exception:
        pass


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
8. src/ReplicatedStorage/AccessibilityConfig.lua — accessibility defaults
9. src/StarterPlayerScripts/MobileHUD.client.lua — mobile-first HUD and action wheel
10. src/StarterPlayerScripts/Onboarding.client.lua — skippable two-step onboarding
11. src/ServerScriptService/monetization/store.lua — server-side purchase entrypoint and remote setup
12. src/ServerScriptService/monetization/products.lua — developer product and game pass definitions
13. src/ServerScriptService/monetization/validator.lua — receipt validation and anti-exploit checks
14. src/ServerScriptService/simulation/clicker.lua — core simulator progression loop
15. src/ServerScriptService/simulation/boosts.lua — boost timers and prestige triggers
16. src/ServerScriptService/simulation/leaderstats.lua — leaderstat tracking for coins and progress
17. src/ServerScriptService/analytics/tracker.lua — analytics hook and event queueing

CRITICAL RULES:
- NEVER use while true do unless it contains task.wait().
- Yield at least once per frame using RunService.Heartbeat:Wait() or task.wait() for long-running loops.
- Batch loops over 1,000 items and process at most 50 per frame.
- Use ipairs for arrays and pairs for dictionaries.
- NEVER modify a table while iterating with pairs.
- Wrap all unsafe calls in pcall.
- Use task.spawn, never spawn().
- RemoteEvents should live in ReplicatedStorage/RemoteEvents.lua or a shared module.
- UI must be mobile-first with a minimum 50x50 touch target, bottom-center layout, and no hover-only interactions.
- Always include accessibility defaults: colorblind-safe colors, reduced-motion guards, tooltips, and high-contrast options.
- All code must be complete, commented, and modern Luau."""

_HARDENED_LUAU_SYSTEM_PROMPT = """You are an expert Roblox Senior Engineer specializing in high-performance Luau.
You are generating code for a Roblox Studio plugin environment.

CRITICAL CONSTRAINTS:
1. Yielding is mandatory. Never use while true do without a yielding function. Always use task.wait() or RunService.Heartbeat:Wait().
2. Any loop processing more than 1,000 items must use batching and process at most 50 items per frame.
3. When iterating over tables that might change size, use ipairs for arrays and pairs for dictionaries. Never modify a table while iterating with pairs without copying the keys first.
4. Wrap external calls (RemoteEvents, DataStores, HTTP requests) in pcall or xpcall.
5. Prefer task.spawn over spawn() or delay(). Use caching for repeated lookups and avoid tight-loop FindFirstChild usage.
6. Disconnect all RBXScriptConnections when a script unloads.
7. Output ONLY valid JSON. Escape newlines as \\n. Keep paths Rojo-compatible and relative to the project root.
"""


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


def _build_hardened_messages(user_prompt: str, previous_error: str | None = None) -> list[dict[str, str]]:
    """Build a hardened prompt set for Roblox Luau generation and self-correction."""
    prompt = user_prompt
    if previous_error:
        prompt = f"{user_prompt}\n\nPREVIOUS ATTEMPT FAILED WITH ERROR:\n{previous_error}\nPlease fix the syntax or logic issue and return valid JSON only."
    return [
        {"role": "system", "content": _HARDENED_LUAU_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]


def _call_lumi_with_retry(user_prompt: str, *, max_tokens: int = 6000, attempts: int = 2) -> dict[str, Any] | None:
    """Retry JSON generation when the initial output is malformed or incomplete."""
    previous_error: str | None = None
    for _ in range(attempts):
        response = _call_lumi(_build_hardened_messages(user_prompt, previous_error), max_tokens=max_tokens)
        if not response:
            previous_error = "No response received from LUMI."
            continue
        parsed = _parse_json(response)
        if parsed is not None:
            return parsed
        previous_error = f"The response was not valid JSON. Raw preview: {response[:800]}"
    return None


def _normalize_script_payload(payload: Any) -> list[dict[str, str]]:
    """Normalize AI output into the internal script schema used by the pipeline."""
    if not isinstance(payload, dict):
        return []

    entries: list[Any] = []
    if isinstance(payload.get("scripts"), list):
        entries = payload["scripts"]
    elif isinstance(payload.get("files"), list):
        entries = payload["files"]

    scripts: list[dict[str, str]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        path = entry.get("path") or entry.get("filePath") or entry.get("name")
        if not isinstance(path, str) or not path.strip():
            continue
        content = entry.get("source") or entry.get("content") or entry.get("sourceCode") or ""
        if not isinstance(content, str):
            content = str(content)
        if not content.strip():
            continue

        file_type = (entry.get("type") or entry.get("className") or "").lower()
        if file_type in {"script", "server"}:
            script_type = "server"
        elif file_type in {"localscript", "local"}:
            script_type = "local"
        elif file_type in {"modulescript", "module"}:
            script_type = "module"
        else:
            script_type = "server"
            if ".client." in path.lower() or "/client/" in path.lower() or path.lower().endswith(".client.lua"):
                script_type = "local"
            elif ".server." in path.lower() or "/server/" in path.lower() or path.lower().endswith(".server.lua"):
                script_type = "server"
            elif ".lua" in path.lower() and "module" in path.lower():
                script_type = "module"

        scripts.append({
            "path": path,
            "type": script_type,
            "description": str(entry.get("description") or ""),
            "content": content,
        })

    return scripts


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
    analytics_url = os.environ.get("ROBLOX_ANALYTICS_URL", "https://your-backend.com/api/roblox/analytics")
    scripts = [
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
            "path": "src/ReplicatedStorage/AccessibilityConfig.lua",
            "type": "module",
            "description": "Accessibility defaults for contrast, motion, and touch targets",
            "content": f'''-- AccessibilityConfig.lua
-- {title} — Shared accessibility defaults
local AccessibilityConfig = {{}}

AccessibilityConfig.HighContrast = false
AccessibilityConfig.ReducedMotion = false
AccessibilityConfig.TooltipsEnabled = true
AccessibilityConfig.TouchTargetSize = 56

function AccessibilityConfig:GetPrimaryColor()
    if self.HighContrast then
        return Color3.fromRGB(255, 255, 255)
    end
    return Color3.fromRGB(56, 189, 248)
end

function AccessibilityConfig:GetAccentColor()
    if self.HighContrast then
        return Color3.fromRGB(255, 200, 80)
    end
    return Color3.fromRGB(245, 158, 11)
end

return AccessibilityConfig
''',
        },
        {
            "path": "src/StarterPlayerScripts/MobileHUD.client.lua",
            "type": "local",
            "description": "Mobile-first HUD shell with bottom-center action wheel",
            "content": f'''-- MobileHUD.client.lua
-- {title} — Mobile-first HUD
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local hud = Instance.new("ScreenGui")
hud.Name = "MobileHUD"
hud.ResetOnSpawn = false
hud.Parent = playerGui

local root = Instance.new("Frame")
root.Name = "Root"
root.Size = UDim2.fromOffset(320, 112)
root.Position = UDim2.new(0.5, -160, 1, -132)
root.AnchorPoint = Vector2.new(0.5, 1)
root.BackgroundTransparency = 1
root.Parent = hud

local wheel = Instance.new("Frame")
wheel.Name = "ActionWheel"
wheel.Size = UDim2.new(0, 220, 0, 56)
wheel.Position = UDim2.new(0.5, -110, 1, -56)
wheel.AnchorPoint = Vector2.new(0.5, 1)
wheel.BackgroundColor3 = Color3.fromRGB(10, 22, 40)
wheel.BorderSizePixel = 0
wheel.Parent = root

local uiCorner = Instance.new("UICorner")
uiCorner.CornerRadius = UDim.new(0, 20)
uiCorner.Parent = wheel

local primaryButton = Instance.new("TextButton")
primaryButton.Name = "Primary"
primaryButton.Size = UDim2.new(0, 56, 0, 56)
primaryButton.Position = UDim2.new(0.5, -28, 0.5, -28)
primaryButton.AnchorPoint = Vector2.new(0.5, 0.5)
primaryButton.BackgroundColor3 = Color3.fromRGB(56, 189, 248)
primaryButton.Text = "▶"
primaryButton.Font = Enum.Font.GothamBold
primaryButton.TextSize = 22
primaryButton.Parent = wheel

local uiCorner2 = Instance.new("UICorner")
uiCorner2.CornerRadius = UDim.new(0, 28)
uiCorner2.Parent = primaryButton

local hint = Instance.new("TextLabel")
hint.Name = "Hint"
hint.Size = UDim2.new(0, 220, 0, 24)
hint.Position = UDim2.new(0, 0, 0, -28)
hint.BackgroundTransparency = 1
hint.Text = "Tap to play"
hint.TextColor3 = Color3.fromRGB(255, 255, 255)
hint.TextXAlignment = Enum.TextXAlignment.Center
hint.TextScaled = true
hint.Parent = wheel

local accessibilityLabel = Instance.new("TextLabel")
accessibilityLabel.Size = UDim2.new(0, 160, 0, 20)
accessibilityLabel.Position = UDim2.new(0.5, -80, 1, 8)
accessibilityLabel.AnchorPoint = Vector2.new(0.5, 0)
accessibilityLabel.BackgroundTransparency = 1
accessibilityLabel.Text = "Accessible / mobile-first"
accessibilityLabel.TextColor3 = Color3.fromRGB(226, 232, 240)
accessibilityLabel.TextScaled = true
accessibilityLabel.Parent = root

RunService.Heartbeat:Connect(function()
    if primaryButton then
        primaryButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    end
end)
''',
        },
        {
            "path": "src/StarterPlayerScripts/Onboarding.client.lua",
            "type": "local",
            "description": "Skippable two-step onboarding for first-time players",
            "content": f'''-- Onboarding.client.lua
-- {title} — First-time onboarding
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "Onboarding"
gui.ResetOnSpawn = false
gui.Parent = playerGui

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 320, 0, 220)
frame.Position = UDim2.new(0.5, -160, 0.5, -110)
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.BackgroundColor3 = Color3.fromRGB(10, 22, 40)
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 20)
corner.Parent = frame

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -24, 0, 34)
title.Position = UDim2.new(0, 12, 0, 12)
title.BackgroundTransparency = 1
title.Text = "Welcome"
title.TextColor3 = Color3.fromRGB(56, 189, 248)
title.Font = Enum.Font.GothamBold
title.TextSize = 24
title.Parent = frame

local body = Instance.new("TextLabel")
body.Size = UDim2.new(1, -24, 0, 90)
body.Position = UDim2.new(0, 12, 0, 62)
body.BackgroundTransparency = 1
body.Text = "Swipe, tap, and play. Skip anytime."
body.TextColor3 = Color3.fromRGB(226, 232, 240)
body.TextWrapped = true
body.TextSize = 18
body.Parent = frame

local skip = Instance.new("TextButton")
skip.Size = UDim2.new(0.5, -16, 0, 40)
skip.Position = UDim2.new(0, 12, 1, -56)
skip.BackgroundColor3 = Color3.fromRGB(56, 189, 248)
skip.Text = "Skip"
skip.Parent = frame

local replay = Instance.new("TextButton")
replay.Size = UDim2.new(0.5, -16, 0, 40)
replay.Position = UDim2.new(0.5, 4, 1, -56)
replay.BackgroundColor3 = Color3.fromRGB(245, 158, 11)
replay.Text = "Replay"
replay.Parent = frame

skip.MouseButton1Click:Connect(function()
    gui:Destroy()
end)

replay.MouseButton1Click:Connect(function()
    gui:Destroy()
end)
''',
        },
        {
            "path": "src/ServerScriptService/init.server.lua",
            "type": "server",
            "description": "Bootstrap script for simulator gameplay and monetization",
            "content": f'''-- init.server.lua
-- {title} bootstrap
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local shared = ReplicatedStorage:FindFirstChild("Shared") or Instance.new("Folder")
shared.Name = "Shared"
shared.Parent = ReplicatedStorage

print("[GameBootstrap]", "{title}", "initialized")
Players.PlayerAdded:Connect(function(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = 0
    coins.Parent = leaderstats
end)
''',
        },
        {
            "path": "src/ServerScriptService/monetization/store.lua",
            "type": "server",
            "description": "Monetization store entrypoint for developer products and game passes",
            "content": '''-- monetization/store.lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local shared = ReplicatedStorage:FindFirstChild("Shared") or Instance.new("Folder")
shared.Name = "Shared"
shared.Parent = ReplicatedStorage

local remotes = shared:FindFirstChild("Remotes") or Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = shared

local purchaseRemote = remotes:FindFirstChild("PurchaseProduct") or Instance.new("RemoteFunction")
purchaseRemote.Name = "PurchaseProduct"
purchaseRemote.Parent = remotes

local equipRemote = remotes:FindFirstChild("EquipItem") or Instance.new("RemoteEvent")
equipRemote.Name = "EquipItem"
equipRemote.Parent = remotes

purchaseRemote.OnServerInvoke = function(player, productId)
    local ok, _ = pcall(function()
        MarketplaceService:PromptProductPurchase(player, productId)
    end)
    return ok
end

Players.PlayerAdded:Connect(function(player)
    player:SetAttribute("AutoClicker", false)
    player:SetAttribute("Multiplier", 1)
end)
''',
        },
        {
            "path": "src/ServerScriptService/monetization/products.lua",
            "type": "module",
            "description": "Default monetization product definitions for the generated simulator",
            "content": '''-- monetization/products.lua
return {
    CoinPack = { ProductId = 0, Price = 99, Type = "DeveloperProduct" },
    AutoClicker = { ProductId = 0, Price = 199, Type = "GamePass" },
    TripleBoost = { ProductId = 0, Price = 299, Type = "DeveloperProduct" },
    VIP = { ProductId = 0, Price = 499, Type = "GamePass" },
}
''',
        },
        {
            "path": "src/ServerScriptService/monetization/validator.lua",
            "type": "server",
            "description": "Receipt validation guardrails and anti-exploit enforcement",
            "content": '''-- monetization/validator.lua
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local VALID_PRODUCTS = {
    [123456789] = "CoinPack",
    [987654321] = "AutoClicker",
}

MarketplaceService.ProcessReceipt = function(receipt)
    local player = Players:GetPlayerByUserId(receipt.PlayerId)
    if not player then
        return Enum.ProductPurchaseDecision.NotProcessedYet
    end

    local productKey = VALID_PRODUCTS[receipt.ProductId]
    if not productKey then
        return Enum.ProductPurchaseDecision.NotProcessedYet
    end

    player:SetAttribute(productKey, true)
    return Enum.ProductPurchaseDecision.PurchaseGranted
end
''',
        },
        {
            "path": "src/ServerScriptService/simulation/clicker.lua",
            "type": "server",
            "description": "Core idle simulator progression loop",
            "content": '''-- simulation/clicker.lua
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    local leaderstats = player:WaitForChild("leaderstats")
    local coins = leaderstats:WaitForChild("Coins")

    task.spawn(function()
        while player.Parent do
            if player:GetAttribute("AutoClicker") then
                coins.Value += 1 * (player:GetAttribute("Multiplier") or 1)
            end
            task.wait(0.5)
        end
    end)
end)
''',
        },
        {
            "path": "src/ServerScriptService/simulation/boosts.lua",
            "type": "server",
            "description": "Boost timers and prestige triggers",
            "content": '''-- simulation/boosts.lua
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    player:SetAttribute("BoostActive", false)
    player:SetAttribute("PrestigeLevel", 0)
end)
''',
        },
        {
            "path": "src/ServerScriptService/simulation/leaderstats.lua",
            "type": "server",
            "description": "Leaderstats setup and progression tracking",
            "content": '''-- simulation/leaderstats.lua
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player

    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = 0
    coins.Parent = leaderstats

    local prestige = Instance.new("IntValue")
    prestige.Name = "Prestige"
    prestige.Value = 0
    prestige.Parent = leaderstats
end)
''',
        },
        {
            "path": "src/ServerScriptService/analytics/tracker.lua",
            "type": "server",
            "description": "Analytics hook for store and progression events",
            "content": '''-- analytics/tracker.lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local shared = ReplicatedStorage:FindFirstChild("Shared") or Instance.new("Folder")
shared.Name = "Shared"
shared.Parent = ReplicatedStorage

local remotes = shared:FindFirstChild("Remotes") or Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = shared

local remote = remotes:FindFirstChild("LogEvent") or Instance.new("RemoteEvent")
remote.Name = "LogEvent"
remote.Parent = remotes

remote.OnServerEvent:Connect(function(player, eventName, payload)
    local data = {
        userId = player.UserId,
        event = eventName,
        payload = payload,
        ts = DateTime.now().UnixTimestamp,
    }

    task.spawn(function()
        pcall(function()
            HttpService:RequestAsync({
                Url = "{analytics_url}",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode(data),
            })
        end)
    end)
end)
'''.replace("{analytics_url}", analytics_url),
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

    genre = (job.genre or "").lower()
    if "rpg" in genre:
        scripts.extend([
            {
                "path": "src/ServerScriptService/rpg/combat.lua",
                "type": "server",
                "description": "Server-authoritative combat loop for the RPG",
                "content": '''-- rpg/combat.lua
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Combat = {}
Combat.__index = Combat

function Combat.start(player)
    local stats = player:WaitForChild("leaderstats")
    local damage = stats:FindFirstChild("Damage") and stats.Damage.Value or 5
    local multiplier = player:GetAttribute("VIP") and 1.5 or 1

    task.spawn(function()
        while player.Parent do
            local enemy = workspace:FindFirstChild("EnemyDummy")
            if enemy then
                enemy:SetAttribute("Health", (enemy:GetAttribute("Health") or 100) - damage * multiplier)
            end
            task.wait(0.5)
        end
    end)
end

return Combat
''',
            },
            {
                "path": "src/ServerScriptService/rpg/inventory.lua",
                "type": "server",
                "description": "Inventory and equipment ownership validation",
                "content": '''-- rpg/inventory.lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local EQUIP_REMOTE = ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Remotes"):WaitForChild("EquipItem")
local Inventory = {}

function Inventory.equip(player, itemId)
    if player:GetAttribute("EquippedWeapon") == itemId then
        return
    end

    player:SetAttribute("EquippedWeapon", itemId)
    EQUIP_REMOTE:FireClient(player, itemId)
end

return Inventory
''',
            },
            {
                "path": "src/ServerScriptService/rpg/xp.lua",
                "type": "server",
                "description": "XP and progression for the RPG loop",
                "content": '''-- rpg/xp.lua
local Players = game:GetService("Players")

local XP = {}

function XP.award(player, amount)
    local leaderstats = player:WaitForChild("leaderstats")
    local xp = leaderstats:FindFirstChild("XP") or Instance.new("IntValue")
    xp.Name = "XP"
    xp.Parent = leaderstats
    xp.Value += amount
end

return XP
''',
            },
            {
                "path": "src/ServerScriptService/rpg/battlepass.lua",
                "type": "server",
                "description": "Battle pass progression and reward tracking",
                "content": '''-- rpg/battlepass.lua
local BattlePass = {}

function BattlePass.awardXP(player, amount)
    local bpLevel = player:GetAttribute("BattlePassLevel") or 1
    local bpXP = player:GetAttribute("BattlePassXP") or 0

    bpXP += amount
    if bpXP >= 1000 then
        bpLevel += 1
        bpXP = 0
    end

    player:SetAttribute("BattlePassLevel", bpLevel)
    player:SetAttribute("BattlePassXP", bpXP)
end

return BattlePass
''',
            },
        ])
    elif "tycoon" in genre:
        scripts.extend([
            {
                "path": "src/ServerScriptService/tycoon/plot.lua",
                "type": "server",
                "description": "Plot ownership for the tycoon",
                "content": '''-- tycoon/plot.lua
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local Plot = {}

function Plot.assign(player)
    local plots = Workspace:FindFirstChild("Plots")
    if not plots then return end

    for _, plot in plots:GetChildren() do
        if not plot:GetAttribute("Owner") then
            plot:SetAttribute("Owner", player.UserId)
            player:SetAttribute("PlotId", plot.Name)
            return plot
        end
    end
end

return Plot
''',
            },
            {
                "path": "src/ServerScriptService/tycoon/dropper.lua",
                "type": "server",
                "description": "Passive income dropper loop",
                "content": '''-- tycoon/dropper.lua
local RunService = game:GetService("RunService")

local Dropper = {}

function Dropper.start(plot, incomePerSecond)
    local cash = plot:FindFirstChild("Cash", true)
    task.spawn(function()
        while cash do
            cash.Value += incomePerSecond
            task.wait(1)
        end
    end)
end

return Dropper
''',
            },
            {
                "path": "src/ServerScriptService/tycoon/income.lua",
                "type": "server",
                "description": "Income calculations and passive growth",
                "content": '''-- tycoon/income.lua
local Income = {}

function Income.compute(player)
    local multiplier = 1
    if player:GetAttribute("AutoCollector") then multiplier += 0.5 end
    if player:GetAttribute("IncomeBoost") then multiplier += 1 end
    if player:GetAttribute("VIP") then multiplier += 1.5 end
    return multiplier
end

return Income
''',
            },
            {
                "path": "src/ServerScriptService/tycoon/upgrades.lua",
                "type": "server",
                "description": "Upgrade application and multiplier logic",
                "content": '''-- tycoon/upgrades.lua
local Upgrades = {}

function Upgrades.apply(player)
    player:SetAttribute("IncomeMultiplier", 1)
    if player:GetAttribute("AutoCollector") then
        player:SetAttribute("IncomeMultiplier", 1.5)
    end
    if player:GetAttribute("IncomeBoost") then
        player:SetAttribute("IncomeMultiplier", player:GetAttribute("IncomeMultiplier") + 1)
    end
    if player:GetAttribute("VIP") then
        player:SetAttribute("IncomeMultiplier", player:GetAttribute("IncomeMultiplier") + 1.5)
    end
end

return Upgrades
''',
            },
        ])
    elif "obby" in genre:
        scripts.extend([
            {
                "path": "src/ServerScriptService/obby/stages.lua",
                "type": "server",
                "description": "Server-authoritative stage progression",
                "content": '''-- obby/stages.lua
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local Stages = {}

function Stages.load(player)
    local stage = player:GetAttribute("Stage") or 1
    local checkpoint = Workspace:FindFirstChild("Checkpoints") and Workspace.Checkpoints:FindFirstChild(tostring(stage))
    if checkpoint and player.Character then
        player.Character:PivotTo(checkpoint.CFrame + Vector3.new(0, 3, 0))
    end
end

function Stages.advance(player)
    local stage = player:GetAttribute("Stage") or 1
    player:SetAttribute("Stage", stage + 1)
    Stages.load(player)
end

return Stages
''',
            },
            {
                "path": "src/ServerScriptService/obby/checkpoint.lua",
                "type": "server",
                "description": "Checkpoint validation and server-side progression",
                "content": '''-- obby/checkpoint.lua
local Checkpoint = {}

function Checkpoint.validate(player, checkpointId)
    return player:GetAttribute("Stage") == checkpointId
end

return Checkpoint
''',
            },
            {
                "path": "src/ServerScriptService/obby/cosmetics.lua",
                "type": "server",
                "description": "Cosmetic trail equipping for the obby",
                "content": '''-- obby/cosmetics.lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Cosmetics = {}

function Cosmetics.equip(player, trailId)
    local character = player.Character
    if not character then return end

    local trail = ReplicatedStorage:FindFirstChild("Assets") and ReplicatedStorage.Assets:FindFirstChild("Trails") and ReplicatedStorage.Assets.Trails:FindFirstChild(trailId)
    if trail then
        trail:Clone().Parent = character
    end
end

return Cosmetics
''',
            },
            {
                "path": "src/ServerScriptService/obby/upsell.lua",
                "type": "server",
                "description": "Low-friction purchase flow for stage skips",
                "content": '''-- obby/upsell.lua
local MarketplaceService = game:GetService("MarketplaceService")

local Upsell = {}

function Upsell.skipStage(player, productId)
    local success = pcall(function()
        MarketplaceService:PromptProductPurchase(player, productId)
    end)

    if success then
        player:SetAttribute("Stage", (player:GetAttribute("Stage") or 1) + 1)
    end
end

return Upsell
''',
            },
        ])

    return scripts


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
        _persist_roblox_job(job)

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
        scripts_data = _call_lumi_with_retry(scripts_prompt, max_tokens=6000)
        scripts_payload = _normalize_script_payload(scripts_data)
        if scripts_payload:
            job.scripts = scripts_payload
        else:
            job.scripts = _fallback_scripts(job, design)

        _publish_studio_snapshot(job)
        update("scripting", 75, f"{len(job.scripts)} scripts generated")

        # Step 3: Package into ZIP
        update("packaging", 80, "Packaging game project…")
        zip_path = _build_zip(job, design)

        job.output_path = str(zip_path)
        _publish_studio_snapshot(job)
        update("done", 100, f"Game ready: {zip_path.name}")

    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.progress = 0
        job.message = f"Pipeline error: {exc}"
        job.updated_at = time.time()
    finally:
        _persist_roblox_job(job)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_roblox_job(
    concept: str,
    genre: str = "Adventure",
    max_players: int = 20,
    monetization: str = "freemium",
    universe_id: str | None = None,
    place_id: str | None = None,
) -> RobloxJob:
    """Create and queue a new Roblox game creation job."""
    from .export_cleanup import sweep_old_exports  # noqa: PLC0415
    sweep_old_exports(_resolve_roblox_export_dir())

    job_id = str(uuid.uuid4())
    job = RobloxJob(
        job_id=job_id,
        concept=concept,
        genre=genre,
        max_players=max(2, min(max_players, 100)),
        monetization=monetization,
        universe_id=universe_id,
        place_id=place_id,
    )
    with _LOCK:
        _JOBS[job_id] = job
    _persist_roblox_job(job)

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
