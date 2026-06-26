from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .readiness import build_production_readiness


REPO_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = REPO_ROOT / "package.json"


def get_phase_definitions() -> list[dict[str, Any]]:
    return [
        {
            "id": "phase-1",
            "name": "Orchestration Runtime",
            "requiredFiles": ["kernel/Kernel.ts", "lumi/AgentRuntime.ts", "orchestration/LUMIDirector.ts"],
        },
        {
            "id": "phase-2",
            "name": "Repository Intelligence",
            "requiredFiles": ["lumi/RepositoryIntelligence.ts"],
        },
        {
            "id": "phase-3",
            "name": "Mission + Production Graph",
            "requiredFiles": ["orchestration/MissionPlanner.ts", "lumi/TaskGraph.ts"],
        },
        {
            "id": "phase-4",
            "name": "Self-Building Loop",
            "requiredFiles": ["lumi/MetaDevelopmentEngine.ts"],
        },
        {
            "id": "phase-5",
            "name": "Digital Twin + Architecture Validation",
            "requiredFiles": ["digitalTwin/DependencyGraph.ts", "lumi/ArchitectureValidator.ts"],
        },
        {
            "id": "phase-6",
            "name": "Universal Capability Routing",
            "requiredFiles": ["capability/ToolRouter.ts", "capability/ProviderRegistry.ts"],
        },
        {
            "id": "phase-7",
            "name": "Autonomous QA + Self-Healing",
            "requiredFiles": ["testing/TestRunner.ts", "testing/AutoFixEngine.ts"],
        },
        {
            "id": "phase-8",
            "name": "Level 10 Production Integration",
            "requiredFiles": ["orchestration/LumiOrchestrator.ts"],
        },
        {
            "id": "phase-9",
            "name": "Level 11 Autonomous Ecosystem",
            "requiredFiles": ["autonomous/ContinuousImprovement.ts"],
        },
    ]


def _count_files(path: Path, suffixes: tuple[str, ...]) -> int:
    if not path.exists():
        return 0
    return sum(1 for file in path.rglob("*") if file.is_file() and file.suffix in suffixes)


def _count_improvements(path: Path, suffixes: tuple[str, ...]) -> int:
    if not path.exists():
        return 0
    total = 0
    for file in path.rglob("*"):
        if not file.is_file() or file.suffix not in suffixes:
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        normalized = content.upper()
        total += normalized.count("IMPROV") + normalized.count("FIXD")
    return total


def _load_npm_scripts() -> dict[str, str]:
    if not PACKAGE_JSON.exists():
        return {}
    try:
        package = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    scripts = package.get("scripts")
    return scripts if isinstance(scripts, dict) else {}


def _check_path(relative_file: str) -> bool:
    return (REPO_ROOT / relative_file).exists()


def _phase_status(required_files: list[str]) -> str:
    existing = [_check_path(file) for file in required_files]
    if all(existing):
        return "active"
    if any(existing):
        return "in-progress"
    return "planned"


def _build_readiness() -> dict[str, Any]:
    return build_production_readiness()


def build_meta_development_status() -> dict[str, Any]:
    phase_definitions = get_phase_definitions()

    phases = [
        {
            "id": phase["id"],
            "name": phase["name"],
            "status": _phase_status(phase["requiredFiles"]),
        }
        for phase in phase_definitions
    ]

    total_source_files = _count_files(REPO_ROOT, (".ts", ".tsx", ".py"))
    improvement_count = _count_improvements(REPO_ROOT, (".ts", ".tsx", ".py", ".md"))

    return {
        "highestRoiNextMove": "Build the Meta Development Engine with Repository Intelligence as its first dependency.",
        "currentReality": [
            "Electron + React + FastAPI scaffold is active.",
            "Kernel and capability primitives exist but require deeper autonomous orchestration.",
            "Validation currently centers on build workflows; test automation is still maturing.",
        ],
        "repositoryIntelligence": {
            "sourceFiles": total_source_files,
            "improvementMarkers": improvement_count,
            "architectureDetected": _check_path("kernel") and _check_path("orchestration"),
            "missingTestScript": not bool(_load_npm_scripts().get("test")),
        },
        "levels": [
            {
                "level": 10,
                "title": "Production Complete",
                "objective": "Deliver complete, publish-ready project outputs from one mission request.",
            },
            {
                "level": 11,
                "title": "Autonomous Ecosystem",
                "objective": "Continuously learn, improve, and execute as a multi-agent production company.",
            },
        ],
        "phases": phases,
        "productionReadiness": _build_readiness(),
    }
