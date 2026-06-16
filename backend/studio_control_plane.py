from __future__ import annotations

from typing import Any

from .meta_builder import build_meta_builder_status, continue_meta_builder
from .meta_development import build_meta_development_status


CAPABILITY_PROVIDERS = [
    {
        "capability": "BuildUI",
        "providerId": "lumi-ui-factory",
        "providerKind": "local",
        "status": "ready",
        "route": "direct",
    },
    {
        "capability": "GenerateImage",
        "providerId": "asset-image-pipeline",
        "providerKind": "local",
        "status": "ready",
        "route": "direct",
    },
    {
        "capability": "GenerateVideo",
        "providerId": "cinematic-render-factory",
        "providerKind": "cloud",
        "status": "standby",
        "route": "direct",
    },
    {
        "capability": "GenerateMusic",
        "providerId": "music-composer-stack",
        "providerKind": "local",
        "status": "ready",
        "route": "direct",
    },
    {
        "capability": "GenerateVoice",
        "providerId": "voice-director-stack",
        "providerKind": "cloud",
        "status": "standby",
        "route": "direct",
    },
    {
        "capability": "Generate3D",
        "providerId": "world-asset-forge",
        "providerKind": "future",
        "status": "needs-provider",
        "route": "fallback",
    },
    {
        "capability": "BuildStorefront",
        "providerId": "commerce-web-shell",
        "providerKind": "local",
        "status": "ready",
        "route": "direct",
    },
    {
        "capability": "BuildCheckout",
        "providerId": "payments-connector",
        "providerKind": "future",
        "status": "needs-provider",
        "route": "fallback",
    },
]

WORKSPACE_MODULES = [
    {
        "id": "mission-control",
        "name": "Mission Control",
        "status": "active",
        "description": "Prompt intake, objective decomposition, and approval gates.",
    },
    {
        "id": "lumi-core",
        "name": "LUMI Core",
        "status": "active",
        "description": "Planning, review, validation, and autonomous coordination.",
    },
    {
        "id": "asset-factory",
        "name": "Asset Factory",
        "status": "active",
        "description": "Images, icons, UI assets, trailers, music, and voice pipelines.",
    },
    {
        "id": "storefront-suite",
        "name": "Storefront Suite",
        "status": "in-progress",
        "description": "Website, product pages, and campaign launch surfaces.",
    },
    {
        "id": "checkout-gateway",
        "name": "Checkout Gateway",
        "status": "planned",
        "description": "Checkout, publishing, and external commerce connectors.",
    },
]


def _worker_batch(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    workers = ["planner-01", "builder-02", "validator-03", "publisher-04"]
    batch: list[dict[str, Any]] = []
    for index, action in enumerate(actions):
        batch.append(
            {
                "jobId": f"job-{index + 1}",
                "actionId": action["id"],
                "name": action["title"],
                "workerId": workers[index % len(workers)],
                "status": "queued" if index > 0 else "running",
                "stage": "execution" if index == 0 else "scheduled",
                "targetFiles": action["targetFiles"],
            }
        )
    return batch


def build_studio_control_plane() -> dict[str, Any]:
    meta = build_meta_development_status()
    meta_builder = build_meta_builder_status()
    queued_actions = meta_builder["nextActions"][:4]

    return {
        "workspaceTitle": "TrezzWorld Production Studio Control Plane",
        "finishLine": "A single prompt can produce an end-to-end deliverable with minimal human intervention.",
        "missionPromptPlaceholder": "Build TrezzWorld Adventures with game systems, assets, trailer, website, documentation, and launch campaign.",
        "workspaceModules": WORKSPACE_MODULES,
        "capabilityProviders": CAPABILITY_PROVIDERS,
        "executionQueue": _worker_batch(queued_actions),
        "deliverySurfaces": [
            {"name": "Studio GUI", "status": "active"},
            {"name": "Storefront", "status": "in-progress"},
            {"name": "Checkout", "status": "planned"},
            {"name": "Publishing", "status": "planned"},
        ],
        "productionReadiness": meta["productionReadiness"],
        "metaBuilder": {
            "summary": meta_builder["summary"],
            "readinessEstimate": meta_builder["readinessEstimate"],
            "nextActions": queued_actions,
        },
    }


def boot_studio_mission(prompt: str) -> dict[str, Any]:
    mission = continue_meta_builder(prompt, max_actions=5)
    provider_map = {entry["capability"]: entry for entry in CAPABILITY_PROVIDERS}
    requested_capabilities = [
        "BuildUI",
        "GenerateImage",
        "GenerateVideo",
        "GenerateMusic",
        "GenerateVoice",
        "Generate3D",
        "BuildStorefront",
        "BuildCheckout",
    ]
    routed = [provider_map[capability] for capability in requested_capabilities]
    queue = _worker_batch(mission["selectedActions"])

    return {
        "objective": prompt,
        "status": "ready-to-start",
        "approvalRequired": True,
        "summary": "Mission bootstrapped. LUMI can begin UI, asset, media, and commerce preparation from this control plane.",
        "requestedCapabilities": routed,
        "executionQueue": queue,
        "executionPlan": mission["executionPlan"],
        "selectedActions": mission["selectedActions"],
    }
