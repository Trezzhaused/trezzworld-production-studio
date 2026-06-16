"""
Pipeline Executor — executes real cross-system build pipelines for LUMI.

This replaces the staging-only mission bootstrap with actual execution:

  1. Use AIRouter.plan() to decompose the mission prompt into concrete tasks
  2. Create pipeline_jobs in MissionStore (SQLite)
  3. Spin up a background thread that executes each job sequentially:
       a. AIRouter.execute()  → generate file content (code/JSON/config)
       b. Write the file into the repository
       c. AIRouter.score()    → evaluate quality against a rubric
       d. Store winning fragments for future evolve/recombine cycles
  4. Update mission status to 'completed' or 'failed' when done

The three-role pattern (planner → executor → scorer) mirrors
model/jailbreak-autoresearch's researcher → target → scorer loop.
"""
from __future__ import annotations

import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .ai_router import AIRouter, get_router
from .mission_store import MissionStore

REPO_ROOT = Path(__file__).resolve().parents[1]

_WORKERS = ["planner-01", "builder-02", "validator-03", "publisher-04"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _worker(index: int) -> str:
    return _WORKERS[index % len(_WORKERS)]


# ---------------------------------------------------------------------------
# Task plan parser (handles raw JSON or JSON inside markdown fences)
# ---------------------------------------------------------------------------

def _parse_tasks(content: str) -> list[dict[str, Any]]:
    """Extract task list from planner output. Multiple fallback strategies."""
    # 1. Direct JSON parse
    try:
        data = json.loads(content)
        tasks = data.get("tasks", [])
        if isinstance(tasks, list) and tasks:
            return tasks
    except (json.JSONDecodeError, AttributeError):
        pass

    # 2. JSON block inside markdown code fence
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if fence_match:
        try:
            data = json.loads(fence_match.group(1))
            tasks = data.get("tasks", [])
            if isinstance(tasks, list):
                return tasks
        except json.JSONDecodeError:
            pass

    # 3. Bare JSON object anywhere in the string
    obj_match = re.search(r'\{[^{}]*"tasks"\s*:\s*\[.*?\]\s*\}', content, re.DOTALL)
    if obj_match:
        try:
            data = json.loads(obj_match.group())
            tasks = data.get("tasks", [])
            if isinstance(tasks, list):
                return tasks
        except json.JSONDecodeError:
            pass

    return []


# ---------------------------------------------------------------------------
# Default task set (used when AI planning is unavailable)
# ---------------------------------------------------------------------------

def _default_tasks(prompt: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "mission-context",
            "title": "Generate mission context and project manifest",
            "capability": "mission-analysis",
            "description": (
                f"Analyze the following mission prompt and produce a JSON project manifest "
                f"with title, goals, capabilities needed, and delivery targets:\n\n{prompt}"
            ),
            "files": ["lumi/sessions/mission-context.json"],
        },
        {
            "id": "ai-config",
            "title": "Write LUMI AI model cascade configuration",
            "capability": "ai-configuration",
            "description": (
                "Create a JSON configuration file that documents the OpenRouter "
                "free-first model cascade, role assignments (planner/executor/scorer/lumi), "
                "and fallback rules for TrezzWorld Production Studio."
            ),
            "files": ["lumi/config/model-cascade.json"],
        },
        {
            "id": "capability-map",
            "title": "Build capability routing map TypeScript module",
            "capability": "capability-routing",
            "description": (
                "Write a TypeScript module that maps every studio capability "
                "(BuildUI, GenerateImage, GenerateVideo, GenerateMusic, GenerateVoice, "
                "Generate3D, BuildStorefront, BuildCheckout) to its provider and fallback chain."
            ),
            "files": ["capability/CapabilityMap.ts"],
        },
        {
            "id": "ai-model-bridge",
            "title": "Create AIModelBridge TypeScript module",
            "capability": "ai-integration",
            "description": (
                "Write a TypeScript class AIModelBridge that wraps the backend AI API "
                "endpoints (/api/lumi/chat, /api/pipeline/status). Include methods: "
                "chat(message, history), getPipelineStatus(missionId), "
                "and bootMission(prompt). Use fetch with proper error handling."
            ),
            "files": ["lumi/AIModelBridge.ts"],
        },
        {
            "id": "pipeline-manifest",
            "title": "Generate production pipeline manifest",
            "capability": "pipeline-generation",
            "description": (
                "Create a JSON manifest that documents all active production pipeline stages, "
                "their AI model assignments, acceptance criteria, and output targets."
            ),
            "files": ["orchestration/pipeline-manifest.json"],
        },
        {
            "id": "lumi-bootstrap",
            "title": "Bootstrap LUMI autonomous build loop configuration",
            "capability": "meta-development",
            "description": (
                "Create a JSON bootstrap configuration for LUMI's autonomous build loop. "
                "Include: model strategy (free-first cascade), "
                "execution loop steps, approval gates, "
                "continuous improvement cycle settings, and initial dataset references."
            ),
            "files": ["lumi/bootstrap.json"],
        },
        {
            "id": "finetune-dataset",
            "title": "Assemble initial LUMI fine-tuning dataset",
            "capability": "ai-finetuning",
            "description": (
                "Create a JSONL fine-tuning dataset with instruction/output pairs "
                "that teach LUMI how to: plan production pipelines, write TypeScript modules, "
                "generate media production scripts, and score outputs against rubrics. "
                "Include at least 10 high-quality examples."
            ),
            "files": ["lumi/finetune/seed-dataset.jsonl"],
        },
        {
            "id": "continuous-improvement",
            "title": "Update ContinuousImprovement with AI integration hooks",
            "capability": "meta-development",
            "description": (
                "Enhance the ContinuousImprovement TypeScript class to include "
                "AI-driven optimization via the AIModelBridge, "
                "storing winning fragments via the backend API, "
                "and detecting when an improvement cycle has met its rubric threshold."
            ),
            "files": ["autonomous/ContinuousImprovement.ts"],
        },
    ]


# ---------------------------------------------------------------------------
# File writer
# ---------------------------------------------------------------------------

def _write_file(relative_path: str, content: str) -> bool:
    """Write AI-generated content to a repository file. Returns True on success."""
    try:
        target = REPO_ROOT / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Pipeline Executor
# ---------------------------------------------------------------------------

class PipelineExecutor:
    """
    Executes real cross-system build pipelines via the three-role AI loop.

    boot_and_execute() returns immediately with a mission manifest and
    starts a background daemon thread that processes jobs sequentially.
    """

    def __init__(
        self,
        router: AIRouter | None = None,
        store: MissionStore | None = None,
    ) -> None:
        self._router = router or get_router()
        self._store = store or MissionStore()

    # ------------------------------------------------------------------
    # Public: boot a mission and start async execution
    # ------------------------------------------------------------------

    def boot_and_execute(
        self,
        mission_id: str,
        prompt: str,
        run_async: bool = True,
    ) -> dict[str, Any]:
        """
        Boot a mission: plan → create DB jobs → start execution thread.
        Returns the mission manifest immediately.
        """
        now = _now()
        self._store.create_mission(mission_id, prompt, now)

        # Plan: ask AI to decompose the goal into tasks
        plan_result = self._router.plan(prompt)
        tasks = _parse_tasks(plan_result.content) if plan_result.ok else []
        if not tasks:
            tasks = _default_tasks(prompt)

        tasks = tasks[:8]  # cap at 8 jobs per mission

        # Create DB records for all jobs
        job_manifests: list[dict[str, Any]] = []
        for idx, task in enumerate(tasks):
            job_id = f"{mission_id}-job-{idx + 1}"
            target_files: list[str] = task.get("files", [])
            w = _worker(idx)
            self._store.create_job(
                job_id, mission_id, task["title"],
                task.get("capability", "general"),
                target_files, w, now,
            )
            job_manifests.append({
                "jobId": job_id,
                "name": task["title"],
                "capability": task.get("capability", "general"),
                "workerId": w,
                "targetFiles": target_files,
                "status": "running" if idx == 0 else "queued",
                "stage": "execution" if idx == 0 else "scheduled",
            })

        self._store.update_mission_status(mission_id, "running", _now())

        if run_async:
            t = threading.Thread(
                target=self._execute_all,
                args=(mission_id, tasks),
                daemon=True,
                name=f"lumi-pipeline-{mission_id}",
            )
            t.start()

        return {
            "missionId": mission_id,
            "status": "executing",
            "prompt": prompt,
            "plannerModel": plan_result.model if plan_result.ok else "fallback",
            "taskCount": len(tasks),
            "jobs": job_manifests,
        }

    # ------------------------------------------------------------------
    # Background execution loop
    # ------------------------------------------------------------------

    def _execute_all(self, mission_id: str, tasks: list[dict[str, Any]]) -> None:
        """Background thread: execute each job in order, update DB throughout."""
        for idx, task in enumerate(tasks):
            job_id = f"{mission_id}-job-{idx + 1}"
            self._store.start_job(job_id, _now())
            try:
                output, score = self._run_task(task)
                status = "done" if score >= 0.45 else "warn"
                self._store.update_job(
                    job_id, status, _now(),
                    output=output,
                    score=score,
                )
                # Store winning fragments for future evolve/recombine use
                if score >= 0.6:
                    self._store.add_fragment(
                        task.get("capability", "general"),
                        output[:2000],
                        score,
                        _now(),
                        mission_id,
                    )
            except Exception as exc:  # noqa: BLE001
                self._store.update_job(job_id, "error", _now(), error=str(exc))

        completed = sum(
            1 for j in self._store.get_jobs(mission_id)
            if j["status"] in {"done", "warn"}
        )
        total = len(tasks)
        pct = int(completed / total * 100) if total else 0
        summary = f"Pipeline complete: {completed}/{total} jobs succeeded ({pct}%)."
        final_status = "completed" if completed >= max(1, total // 2) else "failed"
        self._store.update_mission_status(mission_id, final_status, _now(), summary)

    def _run_task(self, task: dict[str, Any]) -> tuple[str, float]:
        """
        Execute one task: generate content via executor, write file, score output.
        Returns (output_content, quality_score).
        """
        target_files: list[str] = task.get("files", [])
        primary_file = target_files[0] if target_files else ""

        # Check if we have winning prior fragments to seed the executor
        fragments = self._store.top_fragments(task.get("capability", "general"), limit=3)
        fragment_context = "\n\n---\n".join(f["fragment"] for f in fragments) if fragments else ""

        # Executor: generate the file content
        description = task.get("description", task["title"])
        if fragment_context:
            description += f"\n\nReference these prior successful outputs:\n{fragment_context}"

        exec_result = self._router.execute(
            task_title=task["title"],
            task_description=description,
            file_path=primary_file,
        )

        output = exec_result.content if exec_result.ok else ""

        # Write to repository
        if output and primary_file:
            _write_file(primary_file, output)

        # Score the output
        rubric = (
            f"The output is for task: {task['title']}. "
            f"It should be: complete, syntactically correct, immediately executable or parseable, "
            f"and implement the stated goal with no placeholders or TODOs."
        )
        score = self._router.score(output, rubric) if output else 0.0

        return output, score

    # ------------------------------------------------------------------
    # Status query
    # ------------------------------------------------------------------

    def get_mission_status(self, mission_id: str) -> dict[str, Any] | None:
        """Return full mission + job status dict for the given mission ID."""
        mission = self._store.get_mission(mission_id)
        if not mission:
            return None
        jobs = self._store.get_jobs(mission_id)
        total = len(jobs)
        completed = sum(1 for j in jobs if j["status"] in {"done", "warn"})
        errored = sum(1 for j in jobs if j["status"] == "error")
        running = sum(1 for j in jobs if j["status"] == "running")
        return {
            **mission,
            "jobs": jobs,
            "progress": {
                "total": total,
                "completed": completed,
                "running": running,
                "errored": errored,
                "percent": int(completed / total * 100) if total else 0,
            },
        }

    def list_missions(self) -> list[dict[str, Any]]:
        """Return recent missions summary list."""
        return self._store.list_missions()


# Module-level singleton
_executor_instance: PipelineExecutor | None = None


def get_executor() -> PipelineExecutor:
    global _executor_instance  # noqa: PLW0603
    if _executor_instance is None:
        _executor_instance = PipelineExecutor()
    return _executor_instance
