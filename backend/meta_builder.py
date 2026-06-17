from __future__ import annotations

from pathlib import Path
from typing import Any

from .meta_development import get_phase_definitions


REPO_ROOT = Path(__file__).resolve().parents[1]
GAP_PENALTY_PERCENTAGE = 9


def _top_improvement_hotspots(limit: int = 5) -> list[dict[str, Any]]:
    hotspots: list[dict[str, Any]] = []
    for file in REPO_ROOT.rglob("*"):
        if not file.is_file() or file.suffix not in {".ts", ".tsx", ".py", ".md"}:
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        count = content.upper().count("IMPROV") + content.upper().count("FIXD")
        if count > 0:
            hotspots.append({"path": str(file.relative_to(REPO_ROOT)), "markers": count})
    hotspots.sort(key=lambda item: item["markers"], reverse=True)
    return hotspots[:limit]


def _missing_phase_files() -> list[dict[str, Any]]:
    phase_gaps: list[dict[str, Any]] = []
    for index, phase in enumerate(get_phase_definitions(), start=1):
        missing = [file for file in phase["requiredFiles"] if not (REPO_ROOT / file).exists()]
        if missing:
            phase_gaps.append(
                {
                    "phaseId": phase["id"],
                    "phaseName": phase["name"],
                    "priority": index,
                    "missingFiles": missing,
                }
            )
    return phase_gaps


def _execution_loop() -> list[str]:
    return [
        "Observe repository and detect capability gaps",
        "Prioritize missing components by phase and impact",
        "Generate implementation tasks with acceptance criteria",
        "Execute tasks through autonomous code and asset agents",
        "Run validation, repair failures, and re-validate",
        "Document deltas and prepare commit candidate for human approval",
    ]


def build_meta_builder_status() -> dict[str, Any]:
    gaps = _missing_phase_files()
    hotspots = _top_improvement_hotspots()

    next_actions = [
        {
            "id": f"action-{index + 1}",
            "title": f"Complete {gap['phaseName']}",
            "objective": f"Create missing architecture for {gap['phaseId']}.",
            "targetFiles": gap["missingFiles"],
            "acceptanceCriteria": [
                "Required files exist with executable implementations.",
                "Runtime status reflects phase as in-progress or active.",
                "Build remains successful after changes.",
            ],
        }
        for index, gap in enumerate(gaps[:5])
    ]

    if hotspots:
        next_actions.append(
            {
                "id": f"action-{len(next_actions) + 1}",
                "title": "Convert improvement hotspots into tracked mission tasks",
                "objective": "Reduce ambiguity and improve autonomous execution confidence.",
                "targetFiles": [item["path"] for item in hotspots[:3]],
                "acceptanceCriteria": [
                    "Highest improvement/FIXME markers are converted into explicit tasks.",
                    "Roadmap reflects converted tasks and owners.",
                ],
            }
        )

    readiness_estimate = max(0, 100 - (len(gaps) * GAP_PENALTY_PERCENTAGE))
    summary = (
        "MetaBuilder is ready to operate as a continuous improvement loop."
        if not gaps
        else f"MetaBuilder detected {len(gaps)} phase gaps that should be completed before full autonomy."
    )

    return {
        "mode": "autonomous-planning",
        "summary": summary,
        "readinessEstimate": readiness_estimate,
        "phaseGaps": gaps,
        "nextActions": next_actions,
        "improvementHotspots": hotspots,
        "capabilityRequests": ["GenerateImage", "GenerateVideo", "GenerateMusic", "GenerateVoice", "Generate3D"],
        "executionLoop": _execution_loop(),
        "approvalGate": {
            "required": True,
            "policy": "Human approval required before merge, deploy, and external publishing.",
        },
    }


def continue_meta_builder(objective: str, max_actions: int = 3) -> dict[str, Any]:
    status = build_meta_builder_status()
    selected_actions = status["nextActions"][: max(1, min(max_actions, 10))]
    return {
        "objective": objective,
        "selectedActions": selected_actions,
        "executionPlan": _execution_loop(),
        "message": "MetaBuilder generated the next autonomous batch and is awaiting execution approval.",
    }
