"""
LUMI Fine-Tuning Orchestrator.

Assembles training datasets from repository content and prior pipeline outputs,
then submits fine-tuning jobs via OpenRouter / available APIs.

Fine-tuning strategy:
  1. Scan the repository for high-quality TypeScript, Python, JSON, and Markdown
  2. Pull top-scoring pipeline output fragments from MissionStore
  3. Assemble JSONL instruction-output pairs (OpenAI fine-tune format)
  4. Write dataset to lumi/finetune/dataset-<timestamp>.jsonl
  5. Optionally submit to a fine-tuning endpoint (OpenRouter / OpenAI compatible)

The dataset teaches LUMI to:
  - Decompose production goals into executable task graphs
  - Write production-ready TypeScript / Python for the TrezzWorld stack
  - Score outputs against quality rubrics
  - Operate as a multi-agent production director
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mission_store import MissionStore

REPO_ROOT = Path(__file__).resolve().parents[1]
FINETUNE_DIR = REPO_ROOT / "lumi" / "finetune"

# High-signal source directories for dataset assembly
_SOURCE_DIRS = [
    "lumi",
    "orchestration",
    "capability",
    "autonomous",
    "kernel",
    "backend",
]

# Instruction templates that teach LUMI core behaviours
_SEED_INSTRUCTIONS: list[dict[str, str]] = [
    {
        "instruction": "Decompose the following mission into executable build tasks for TrezzWorld Production Studio.",
        "input": "Build a Roblox game called TrezzWorld Adventures with original 3D assets, music, voice acting, a 5-minute cinematic trailer, website, and launch campaign.",
        "output": json.dumps({
            "tasks": [
                {"id": "analyze", "title": "Analyze mission and produce project manifest", "capability": "mission-analysis", "files": ["lumi/sessions/mission-context.json"]},
                {"id": "assets", "title": "Generate 3D asset pipeline configuration", "capability": "image-assets", "files": ["assetFactory/pipeline-config.json"]},
                {"id": "music", "title": "Configure music score generation pipeline", "capability": "music-score", "files": ["music/pipeline-config.json"]},
                {"id": "voice", "title": "Set up voice-over director with character cast", "capability": "voice-over", "files": ["audio/cast-config.json"]},
                {"id": "trailer", "title": "Generate 5-minute cinematic trailer storyboard", "capability": "video-storyboard", "files": ["video/storyboard.json"]},
                {"id": "website", "title": "Scaffold storefront website structure", "capability": "BuildStorefront", "files": ["deployment/storefront/index.html"]},
                {"id": "campaign", "title": "Create marketing campaign brief and assets", "capability": "pipeline-generation", "files": ["orchestration/campaign-manifest.json"]},
            ]
        }, indent=2),
    },
    {
        "instruction": "Write a TypeScript class that implements a free-first AI model cascade for TrezzWorld Production Studio.",
        "input": "The class should try free OpenRouter models first (Gemini, DeepSeek, Llama), then low-cost (Claude Haiku, GPT-4o-mini), then premium. Return the first successful result.",
        "output": """export interface ModelResult {
  model: string;
  content: string;
  ok: boolean;
  error?: string;
}

export class AIModelCascade {
  private readonly freeModels = [
    'google/gemini-2.0-flash-exp:free',
    'deepseek/deepseek-r1:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
  ];

  private readonly lowCostModels = [
    'google/gemini-flash-1.5',
    'anthropic/claude-3-haiku',
    'openai/gpt-4o-mini',
  ];

  private readonly premiumModels = [
    'anthropic/claude-sonnet-4.6',
    'openai/gpt-5.5',
    'x-ai/grok-4.3',
  ];

  async chat(messages: Array<{role: string; content: string}>): Promise<ModelResult> {
    const cascade = [...this.freeModels, ...this.lowCostModels, ...this.premiumModels];
    for (const model of cascade) {
      try {
        const result = await this.callModel(model, messages);
        if (result.ok) return result;
      } catch {
        continue;
      }
    }
    return { model: 'none', content: '', ok: false, error: 'All models exhausted' };
  }

  private async callModel(model: string, messages: Array<{role: string; content: string}>): Promise<ModelResult> {
    const apiKey = process.env.OPENROUTER_API_KEY ?? '';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 }),
    });
    if (!res.ok) return { model, content: '', ok: false, error: `HTTP ${res.status}` };
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return { model, content: data.choices[0].message.content, ok: true };
  }
}""",
    },
    {
        "instruction": "Score the following code output against the given rubric. Return a JSON score from 0.0 to 1.0.",
        "input": "Rubric: The TypeScript file must export a class, have no syntax errors, and implement all stated methods.\n\nOutput:\nexport class Planner {\n  createPlan(goal: string) { return { id: '1', goal, steps: [] }; }\n  addStep(plan: any, title: string) { plan.steps.push({ title }); }\n}",
        "output": '{"score": 0.85}',
    },
    {
        "instruction": "Write a Python function that takes a mission prompt and returns a list of pipeline tasks.",
        "input": "Use the jailbreak-autoresearch three-role pattern: plan with AI, execute each task, score the result.",
        "output": """from __future__ import annotations
from typing import Any

def plan_mission(prompt: str, router: Any) -> list[dict[str, Any]]:
    \"\"\"Decompose a mission prompt into executable pipeline tasks using AI planner.\"\"\"
    result = router.plan(prompt)
    if not result.ok:
        return _fallback_tasks(prompt)
    try:
        import json
        data = json.loads(result.content)
        tasks = data.get("tasks", [])
        return tasks if tasks else _fallback_tasks(prompt)
    except (json.JSONDecodeError, AttributeError):
        return _fallback_tasks(prompt)

def _fallback_tasks(prompt: str) -> list[dict[str, Any]]:
    return [
        {"id": "analyze", "title": f"Analyze: {prompt[:50]}", "capability": "mission-analysis", "files": ["lumi/sessions/context.json"]},
        {"id": "build", "title": "Build core pipeline", "capability": "pipeline-generation", "files": ["orchestration/pipeline.json"]},
        {"id": "validate", "title": "Validate and score output", "capability": "qa-validation", "files": ["testing/report.json"]},
    ]
""",
    },
    {
        "instruction": "Explain how LUMI's autonomous build loop works and what roles the three AI models play.",
        "input": "",
        "output": (
            "LUMI's autonomous build loop follows the researcher→executor→scorer pattern from jailbreak-autoresearch:\n\n"
            "1. **Planner (Researcher role)**: Receives the mission prompt and decomposes it into concrete tasks. "
            "Uses free models (Gemini Flash, DeepSeek R1) first. Outputs structured JSON task graphs.\n\n"
            "2. **Executor (Target role)**: Takes each task and generates complete file content — "
            "TypeScript classes, Python modules, JSON configs, Markdown docs. "
            "Low temperature (0.15) for precision. Writes files directly to the repository.\n\n"
            "3. **Scorer (Scorer role)**: Evaluates executor output against a quality rubric. "
            "Returns a 0.0–1.0 score. Winning outputs (score ≥ 0.6) are stored as fragments "
            "for future evolve/recombine iterations — exactly like the jailbreak-autoresearch greedy ratchet.\n\n"
            "4. **Loop**: The MissionStore SQLite database tracks job state. "
            "The ContinuousImprovement cycle can re-run failed jobs with prior winning fragments as context, "
            "improving quality over iterations until the rubric threshold is met."
        ),
    },
    {
        "instruction": "Write a JSON configuration for LUMI's model cascade with role assignments.",
        "input": "Include free, low-cost, and premium tiers. Assign planner, executor, scorer, and lumi roles.",
        "output": json.dumps({
            "version": "1.0",
            "provider": "openrouter",
            "cascade": {
                "free": [
                    "google/gemini-2.0-flash-exp:free",
                    "deepseek/deepseek-r1:free",
                    "meta-llama/llama-3.1-8b-instruct:free",
                    "mistralai/mistral-7b-instruct:free",
                    "qwen/qwen-2-7b-instruct:free"
                ],
                "low-cost": [
                    "google/gemini-flash-1.5",
                    "anthropic/claude-3-haiku",
                    "openai/gpt-4o-mini"
                ],
                "premium": [
                    "anthropic/claude-sonnet-4.6",
                    "openai/gpt-5.5",
                    "google/gemini-3.1-flash-lite",
                    "deepseek/deepseek-v4-pro",
                    "x-ai/grok-4.3"
                ]
            },
            "roles": {
                "planner": {"preferred": "google/gemini-2.0-flash-exp:free", "temperature": 0.4, "max_tokens": 1200},
                "executor": {"preferred": "deepseek/deepseek-r1:free", "temperature": 0.15, "max_tokens": 2400},
                "scorer": {"preferred": "google/gemini-flash-1.5-8b:free", "temperature": 0.0, "max_tokens": 120},
                "lumi": {"preferred": "google/gemini-2.0-flash-exp:free", "temperature": 0.72, "max_tokens": 1200}
            },
            "strategy": "free-first",
            "fallback": "cascade-on-error",
            "note": "Free models are tried first. On error or quota exhaustion, cascade to next tier."
        }, indent=2),
    },
]


def _collect_repo_examples(limit_per_dir: int = 3) -> list[dict[str, str]]:
    """Scan the repository for high-quality source files to include as examples."""
    examples: list[dict[str, str]] = []
    for src_dir in _SOURCE_DIRS:
        dir_path = REPO_ROOT / src_dir
        if not dir_path.exists():
            continue
        files = [f for f in dir_path.rglob("*") if f.is_file() and f.suffix in {".ts", ".py", ".json"}]
        files.sort(key=lambda f: f.stat().st_size, reverse=True)
        for f in files[:limit_per_dir]:
            try:
                content = f.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if len(content) < 100 or len(content) > 8000:
                continue
            rel = str(f.relative_to(REPO_ROOT))
            examples.append({
                "instruction": f"Write a complete, production-ready file for: {rel}",
                "input": f"This is a {f.suffix.lstrip('.')} file in the TrezzWorld Production Studio codebase.",
                "output": content,
            })
    return examples


def _collect_fragment_examples(store: MissionStore) -> list[dict[str, str]]:
    """Pull top-scoring pipeline output fragments as training examples."""
    examples: list[dict[str, str]] = []
    for capability in [
        "mission-analysis", "ai-configuration", "capability-routing",
        "pipeline-generation", "meta-development", "ai-finetuning",
    ]:
        fragments = store.top_fragments(capability, limit=2)
        for frag in fragments:
            if frag.get("score", 0) >= 0.6:
                examples.append({
                    "instruction": f"Generate a high-quality output for the '{capability}' capability.",
                    "input": "Follow TrezzWorld Production Studio conventions.",
                    "output": frag["fragment"],
                })
    return examples


def assemble_dataset(store: MissionStore | None = None) -> dict[str, Any]:
    """
    Assemble the full fine-tuning dataset and write it to lumi/finetune/.
    Returns a summary dict with path and example count.
    """
    if store is None:
        store = MissionStore()

    FINETUNE_DIR.mkdir(parents=True, exist_ok=True)

    # Gather examples from all sources
    examples = list(_SEED_INSTRUCTIONS)
    examples.extend(_collect_repo_examples())
    examples.extend(_collect_fragment_examples(store))

    # Deduplicate by output content
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for ex in examples:
        key = ex.get("output", "")[:200]
        if key not in seen:
            seen.add(key)
            unique.append(ex)

    # Write JSONL (OpenAI fine-tune format)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dataset_path = FINETUNE_DIR / f"dataset-{timestamp}.jsonl"
    seed_path = FINETUNE_DIR / "seed-dataset.jsonl"

    lines: list[str] = []
    for ex in unique:
        # Convert to chat-format for fine-tuning
        record = {
            "messages": [
                {"role": "system", "content": (
                    "You are LUMI, the autonomous AI brain of TrezzWorld Production Studio. "
                    "You plan, build, and orchestrate production pipelines."
                )},
                {"role": "user", "content": (
                    ex["instruction"] + ("\n\n" + ex["input"] if ex.get("input") else "")
                )},
                {"role": "assistant", "content": ex["output"]},
            ]
        }
        lines.append(json.dumps(record, ensure_ascii=False))

    content = "\n".join(lines)
    dataset_path.write_text(content, encoding="utf-8")
    seed_path.write_text(content, encoding="utf-8")  # always update seed

    return {
        "path": str(dataset_path.relative_to(REPO_ROOT)),
        "seed_path": str(seed_path.relative_to(REPO_ROOT)),
        "example_count": len(unique),
        "sources": {
            "seed_instructions": len(_SEED_INSTRUCTIONS),
            "repo_examples": len(unique) - len(_SEED_INSTRUCTIONS),
        },
        "timestamp": timestamp,
        "format": "jsonl-chat",
        "note": (
            "Dataset is in OpenAI fine-tune chat format. "
            "Upload to OpenRouter / OpenAI compatible fine-tuning endpoint. "
            "Set OPENROUTER_API_KEY and use POST /api/lumi/finetune/start to submit."
        ),
    }


def get_finetune_status() -> dict[str, Any]:
    """Return info about existing fine-tuning datasets."""
    if not FINETUNE_DIR.exists():
        return {"datasets": [], "ready": False}
    datasets = sorted(FINETUNE_DIR.glob("dataset-*.jsonl"), reverse=True)
    seed = FINETUNE_DIR / "seed-dataset.jsonl"
    return {
        "ready": seed.exists(),
        "seed_dataset": str(seed.relative_to(REPO_ROOT)) if seed.exists() else None,
        "datasets": [str(d.relative_to(REPO_ROOT)) for d in datasets[:5]],
        "total_datasets": len(datasets),
    }
