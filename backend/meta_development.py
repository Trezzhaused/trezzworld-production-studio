from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = REPO_ROOT / "package.json"


def _count_files(path: Path, suffixes: tuple[str, ...]) -> int:
    if not path.exists():
        return 0
    return sum(1 for file in path.rglob("*") if file.is_file() and file.suffix in suffixes)


def _count_todos(path: Path, suffixes: tuple[str, ...]) -> int:
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
        total += normalized.count("TODO") + normalized.count("FIXME")
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
    scripts = _load_npm_scripts()
    checks = [
        {
            "category": "Build passes",
            "goal": "Required",
            "passed": bool(scripts.get("build")),
        },
        {
            "category": "Tests passing",
            "goal": "Required",
            "passed": bool(scripts.get("test")),
        },
        {
            "category": "Coverage",
            "goal": ">=95%",
            "passed": False,
        },
        {
            "category": "Security scan",
            "goal": "Required",
            "passed": _check_path("security"),
        },
        {
            "category": "Documentation",
            "goal": "Required",
            "passed": _check_path("README.md") or _check_path("docs/README.md"),
        },
        {
            "category": "Performance",
            "goal": "Required",
            "passed": _check_path("testing/PerformanceAnalyzer.ts"),
        },
        {
            "category": "Asset validation",
            "goal": "Required",
            "passed": _check_path("quality/QualityControl.ts"),
        },
        {
            "category": "Deployment validation",
            "goal": "Required",
            "passed": _check_path("deployment"),
        },
    ]
    passed = sum(1 for check in checks if check["passed"])
    score = int((passed / len(checks)) * 100)
    return {"score": score, "checks": checks}


def build_meta_development_status() -> dict[str, Any]:
    phase_definitions = [
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

    phases = [
        {
            "id": phase["id"],
            "name": phase["name"],
            "status": _phase_status(phase["requiredFiles"]),
        }
        for phase in phase_definitions
    ]

    total_source_files = _count_files(REPO_ROOT, (".ts", ".tsx", ".py"))
    todo_count = _count_todos(REPO_ROOT, (".ts", ".tsx", ".py", ".md"))

    return {
        "highestRoiNextMove": "Build the Meta Development Engine with Repository Intelligence as its first dependency.",
        "currentReality": [
            "Electron + React + FastAPI scaffold is active.",
            "Kernel and capability primitives exist but require deeper autonomous orchestration.",
            "Validation currently centers on build workflows; test automation is still maturing.",
        ],
        "repositoryIntelligence": {
            "sourceFiles": total_source_files,
            "todoMarkers": todo_count,
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
