"""
AI Router — OpenRouter cascade client for LUMI.

Architecture inspired by model/jailbreak-autoresearch/src/openrouter.py.
Routes requests through free models first, cascades to low-cost then premium.

Three-role model (from jailbreak-autoresearch):
  planner   → proposes tasks, decompose goals  (high-creativity, structured output)
  executor  → generates code / content          (precise, low-temperature)
  scorer    → judges output against rubric       (deterministic, 0.0–1.0)
  lumi      → conversational LUMI interface      (balanced)
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# ---------------------------------------------------------------------------
# Model cascade: free-tier first → low-cost → premium
# Models sourced from model/jailbreak-autoresearch/models.json + free variants
# ---------------------------------------------------------------------------
_CASCADE: list[dict[str, Any]] = [
    # ── Free tier ──────────────────────────────────────────────────────────
    {"id": "google/gemini-2.0-flash-exp:free",        "tier": "free",     "pri": 1},
    {"id": "google/gemini-flash-1.5-8b:free",         "tier": "free",     "pri": 2},
    {"id": "deepseek/deepseek-r1:free",               "tier": "free",     "pri": 3},
    {"id": "meta-llama/llama-3.1-8b-instruct:free",   "tier": "free",     "pri": 4},
    {"id": "mistralai/mistral-7b-instruct:free",      "tier": "free",     "pri": 5},
    {"id": "qwen/qwen-2-7b-instruct:free",            "tier": "free",     "pri": 6},
    # ── Low-cost paid ──────────────────────────────────────────────────────
    {"id": "google/gemini-flash-1.5",                 "tier": "low-cost", "pri": 7},
    {"id": "anthropic/claude-3-haiku",                "tier": "low-cost", "pri": 8},
    {"id": "openai/gpt-4o-mini",                      "tier": "low-cost", "pri": 9},
    {"id": "mistralai/mistral-nemo",                  "tier": "low-cost", "pri": 10},
    # ── Premium fallback ───────────────────────────────────────────────────
    {"id": "anthropic/claude-sonnet-4.6",             "tier": "premium",  "pri": 11},
    {"id": "openai/gpt-5.5",                          "tier": "premium",  "pri": 12},
    {"id": "google/gemini-3.1-flash-lite",            "tier": "premium",  "pri": 13},
    {"id": "deepseek/deepseek-v4-pro",                "tier": "premium",  "pri": 14},
    {"id": "x-ai/grok-4.3",                          "tier": "premium",  "pri": 15},
]

# Per-role preferred model lists (free-first within role)
_ROLE_MODELS: dict[str, list[str]] = {
    "planner": [
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
        "anthropic/claude-sonnet-4.6",
    ],
    "executor": [
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1:free",
        "mistralai/mistral-7b-instruct:free",
        "google/gemini-flash-1.5",
        "openai/gpt-4o-mini",
        "openai/gpt-5.5",
    ],
    "scorer": [
        "google/gemini-flash-1.5-8b:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2-7b-instruct:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
    ],
    "lumi": [
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.5",
    ],
    "researcher": [  # harness-style proposer (jailbreak-autoresearch pattern)
        "deepseek/deepseek-r1:free",
        "google/gemini-2.0-flash-exp:free",
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.5",
        "google/gemini-3.1-flash-lite",
    ],
}

_REFERER = "https://github.com/Trezzhaused/trezzworld-production-studio"
_APP_TITLE = "TrezzWorld Production Studio - LUMI"


@dataclass
class ChatResult:
    model: str
    content: str
    usage: dict[str, int] = field(default_factory=dict)
    ok: bool = True
    error: str = ""


class AIRouter:
    """
    OpenRouter cascade client.

    Tries role-preferred models in order (free first).
    On error or quota exhaustion, falls back to the next model.
    Mirrors the three-role researcher/target/scorer architecture from
    model/jailbreak-autoresearch and adapts it for production pipeline use.
    """

    def __init__(self, api_key: str | None = None, timeout: int = 60) -> None:
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.timeout = timeout

    # ------------------------------------------------------------------
    # Private HTTP layer (mirrors jailbreak-autoresearch src/openrouter.py)
    # ------------------------------------------------------------------

    def _raw_call(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> ChatResult:
        if not self.api_key:
            return ChatResult(model=model, content="", ok=False, error="OPENROUTER_API_KEY not set.")

        payload = json.dumps({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }).encode("utf-8")

        req = urllib.request.Request(
            OPENROUTER_API_URL,
            data=payload,
            headers={
                "Authorization": "Bearer " + self.api_key,
                "Content-Type": "application/json",
                "HTTP-Referer": _REFERER,
                "X-Title": _APP_TITLE,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                return ChatResult(model=model, content=content, usage=usage, ok=True)
        except urllib.error.HTTPError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"HTTP {exc.code}: {exc.reason}")
        except urllib.error.URLError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"URLError: {exc.reason}")
        except (KeyError, json.JSONDecodeError, IndexError) as exc:
            return ChatResult(model=model, content="", ok=False, error=f"ParseError: {exc}")

    # ------------------------------------------------------------------
    # Cascade dispatcher
    # ------------------------------------------------------------------

    def chat(
        self,
        messages: list[dict[str, str]],
        role: str = "lumi",
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> ChatResult:
        """
        Route a chat request through the free-first cascade.
        role: 'planner' | 'executor' | 'scorer' | 'lumi' | 'researcher'
        """
        preferred = _ROLE_MODELS.get(role, _ROLE_MODELS["lumi"])
        tried: set[str] = set()

        for model_id in preferred:
            tried.add(model_id)
            result = self._raw_call(model_id, messages, temperature, max_tokens)
            if result.ok:
                return result

        # Full cascade fallback (sorted by tier priority)
        for model_info in sorted(_CASCADE, key=lambda m: m["pri"]):
            mid = model_info["id"]
            if mid not in tried:
                result = self._raw_call(mid, messages, temperature, max_tokens)
                if result.ok:
                    return result

        return ChatResult(model="none", content="", ok=False, error="All models in cascade exhausted.")

    # ------------------------------------------------------------------
    # Role-specific convenience methods
    # ------------------------------------------------------------------

    def plan(self, goal: str, context: str = "") -> ChatResult:
        """
        Planner role: decompose a goal into concrete build tasks.
        Returns JSON: {"tasks": [{"id", "title", "capability", "description", "files": [...]}]}
        """
        system = (
            "You are LUMI's planner — the Autonomous Build Planner for TrezzWorld Production Studio. "
            "Decompose the given goal into 3–8 concrete, executable production tasks. "
            "Each task must map to a real file that needs to be created or modified. "
            "Respond ONLY with valid JSON matching this schema exactly:\n"
            '{"tasks": [{"id": "string", "title": "string", "capability": "string", '
            '"description": "string", "files": ["relative/path.ts"]}]}'
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Goal: {goal}\n\nContext:\n{context}\n\nDecompose into tasks."},
        ]
        return self.chat(messages, role="planner", temperature=0.4, max_tokens=1200)

    def execute(self, task_title: str, task_description: str, file_path: str = "") -> ChatResult:
        """
        Executor role: generate complete file content for a build task.
        Writes TypeScript by default, detects Python/JSON/Markdown from file_path.
        """
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else "ts"
        lang_hint = {
            "py": "Python", "ts": "TypeScript", "tsx": "TypeScript (React JSX)",
            "json": "JSON", "md": "Markdown", "yaml": "YAML", "yml": "YAML",
        }.get(ext, "TypeScript")

        system = (
            f"You are LUMI's executor — you write complete, production-ready {lang_hint} files. "
            "Output ONLY the file content with no markdown fences, no explanation, no preamble. "
            "The file must be fully functional, importable, and follow best practices."
        )
        user = (
            f"Task: {task_title}\n"
            f"Description: {task_description}\n"
            f"Target file: {file_path or '(infer from task)'}\n\n"
            "Write the complete file content now."
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        return self.chat(messages, role="executor", temperature=0.15, max_tokens=2400)

    def score(self, output: str, rubric: str) -> float:
        """
        Scorer role: judge output quality against rubric.
        Returns float in [0.0, 1.0]. Mirrors jailbreak-autoresearch scoring.py.
        """
        system = (
            "You are a strict quality evaluator. "
            "Score the given output against the rubric on a scale from 0.0 (completely fails) to 1.0 (perfect). "
            'Respond ONLY with valid JSON: {"score": <number between 0.0 and 1.0>}'
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"Rubric:\n{rubric}\n\nOutput to evaluate (first 2000 chars):\n{output[:2000]}",
            },
        ]
        result = self.chat(messages, role="scorer", temperature=0.0, max_tokens=120)
        if not result.ok:
            return 0.0
        try:
            data = json.loads(result.content)
            return max(0.0, min(1.0, float(data["score"])))
        except (json.JSONDecodeError, KeyError, ValueError, TypeError):
            # Try regex fallback
            match = re.search(r"(\d+(?:\.\d+)?)", result.content)
            if match:
                val = float(match.group(1))
                return max(0.0, min(1.0, val / (10.0 if val > 1.0 else 1.0)))
        return 0.0

    def lumi_chat(
        self,
        user_message: str,
        history: list[dict[str, str]] | None = None,
    ) -> ChatResult:
        """
        LUMI conversational interface — the studio AI assistant.
        Maintains conversation history for multi-turn sessions.
        """
        system = (
            "You are LUMI (Layered Universal Media Intelligence), "
            "the autonomous AI brain of TrezzWorld Production Studio. "
            "You plan builds, generate code, create media production pipelines, "
            "and orchestrate full end-to-end creative and technical projects. "
            "You are direct, technically precise, and creative. "
            "You always describe what you are building or what you would build next. "
            "You have access to the three-role AI pipeline: planner, executor, and scorer. "
            "You draw from OpenRouter free models first (Gemini, DeepSeek, Llama, Mistral) "
            "and escalate to Claude/GPT/Grok only when needed."
        )
        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        if history:
            messages.extend(history[-20:])  # keep last 20 turns
        messages.append({"role": "user", "content": user_message})
        return self.chat(messages, role="lumi", temperature=0.72, max_tokens=1200)

    def researcher_propose(self, goal: str, context: str = "", prior_fragments: str = "") -> ChatResult:
        """
        Researcher role (jailbreak-autoresearch pattern):
        Proposes an approach/harness for a given goal, using prior winning fragments.
        """
        system = (
            "You are LUMI's research proposer. "
            "Given a goal and context, propose the best approach to achieve it. "
            "Draw on any prior successful fragments provided. "
            "Be creative, iterative, and aim for maximum quality. "
            "Respond with a structured JSON proposal: "
            '{"approach": "string", "steps": ["string"], "rationale": "string"}'
        )
        user = (
            f"Goal: {goal}\nContext: {context}"
            + (f"\n\nPrior successful fragments:\n{prior_fragments}" if prior_fragments else "")
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        return self.chat(messages, role="researcher", temperature=0.85, max_tokens=1000)

    # ------------------------------------------------------------------
    # Model cascade info (for status endpoint)
    # ------------------------------------------------------------------

    def cascade_info(self) -> list[dict[str, Any]]:
        """Return the full model cascade configuration."""
        return [
            {
                "id": m["id"],
                "tier": m["tier"],
                "priority": m["pri"],
            }
            for m in sorted(_CASCADE, key=lambda x: x["pri"])
        ]


# Module-level singleton (no API key required at import time)
_router_instance: AIRouter | None = None


def get_router() -> AIRouter:
    """Return the module-level AIRouter singleton."""
    global _router_instance  # noqa: PLW0603
    if _router_instance is None:
        _router_instance = AIRouter()
    return _router_instance


if __name__ == "__main__":
    # Quick smoke test: python -m backend.ai_router
    router = get_router()
    if not router.api_key:
        print("No OPENROUTER_API_KEY set — cascade will return errors without a key.", file=sys.stderr)
    info = router.cascade_info()
    print(f"Model cascade loaded: {len(info)} models")
    for entry in info[:6]:
        print(f"  [{entry['tier']:8s}] {entry['id']}")
    print(f"  ... and {len(info) - 6} more")
