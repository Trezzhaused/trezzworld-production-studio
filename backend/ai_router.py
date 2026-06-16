"""
AI Router — OpenRouter cascade client for LUMI.

Architecture inspired by model/jailbreak-autoresearch/src/openrouter.py.
Routes requests through free models first, cascades to low-cost then premium.

Three-role model (from jailbreak-autoresearch):
  planner   → proposes tasks, decompose goals  (high-creativity, structured output)
  executor  → generates code / content          (precise, low-temperature)
  scorer    → judges output against rubric       (deterministic, 0.0–1.0)
  lumi      → conversational LUMI interface      (balanced)

Local Ollama models (SuperGemma 26B etc.) are tried first when available.
Set OLLAMA_HOST env var to override the default http://localhost:11434.

User-key fallback: when the OpenRouter cascade is exhausted, the router will
try any user-provided provider keys (OpenRouter, Google, OpenAI, Anthropic)
before returning the "exhausted" message with upgrade guidance.
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
    {"id": "google/gemini-2.0-flash-exp:free",              "tier": "free",     "pri": 1},
    {"id": "google/gemini-2.5-flash:free",                  "tier": "free",     "pri": 2},
    {"id": "google/gemma-3-27b-it:free",                    "tier": "free",     "pri": 3},
    {"id": "google/gemma-3-12b-it:free",                    "tier": "free",     "pri": 4},
    {"id": "google/gemini-flash-1.5-8b:free",               "tier": "free",     "pri": 5},
    {"id": "deepseek/deepseek-r1:free",                     "tier": "free",     "pri": 6},
    {"id": "deepseek/deepseek-chat-v3-0324:free",           "tier": "free",     "pri": 7},
    {"id": "meta-llama/llama-3.3-70b-instruct:free",        "tier": "free",     "pri": 8},
    {"id": "meta-llama/llama-3.1-8b-instruct:free",         "tier": "free",     "pri": 9},
    {"id": "mistralai/mistral-7b-instruct:free",            "tier": "free",     "pri": 10},
    {"id": "qwen/qwen3-8b:free",                            "tier": "free",     "pri": 11},
    {"id": "qwen/qwen-2-7b-instruct:free",                  "tier": "free",     "pri": 12},
    {"id": "microsoft/phi-4-reasoning:free",                "tier": "free",     "pri": 13},
    {"id": "nousresearch/hermes-3-llama-3.1-8b:free",       "tier": "free",     "pri": 14},
    # ── Low-cost paid ──────────────────────────────────────────────────────
    {"id": "google/gemini-flash-1.5",                       "tier": "low-cost", "pri": 15},
    {"id": "anthropic/claude-3-haiku",                      "tier": "low-cost", "pri": 16},
    {"id": "openai/gpt-4o-mini",                            "tier": "low-cost", "pri": 17},
    {"id": "mistralai/mistral-nemo",                        "tier": "low-cost", "pri": 18},
    # ── Premium fallback ───────────────────────────────────────────────────
    {"id": "anthropic/claude-sonnet-4.6",                   "tier": "premium",  "pri": 19},
    {"id": "openai/gpt-5.5",                                "tier": "premium",  "pri": 20},
    {"id": "google/gemini-3.1-flash-lite",                  "tier": "premium",  "pri": 21},
    {"id": "deepseek/deepseek-v4-pro",                      "tier": "premium",  "pri": 22},
    {"id": "x-ai/grok-4.3",                                 "tier": "premium",  "pri": 23},
]

# Per-role preferred model lists (free-first within role)
_ROLE_MODELS: dict[str, list[str]] = {
    "planner": [
        "google/gemini-2.5-flash:free",
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1:free",
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
        "anthropic/claude-sonnet-4.6",
    ],
    "executor": [
        "google/gemini-2.5-flash:free",
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "google/gemini-flash-1.5",
        "openai/gpt-4o-mini",
        "openai/gpt-5.5",
    ],
    "scorer": [
        "google/gemini-flash-1.5-8b:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen3-8b:free",
        "qwen/qwen-2-7b-instruct:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
    ],
    "lumi": [
        "google/gemini-2.5-flash:free",
        "google/gemini-2.0-flash-exp:free",
        "google/gemma-3-27b-it:free",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "qwen/qwen3-8b:free",
        "microsoft/phi-4-reasoning:free",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku",
        "anthropic/claude-sonnet-4.6",
        "openai/gpt-5.5",
    ],
    "researcher": [  # harness-style proposer (jailbreak-autoresearch pattern)
        "google/gemini-2.5-flash:free",
        "deepseek/deepseek-r1:free",
        "google/gemma-3-27b-it:free",
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

    # ------------------------------------------------------------------
    # User-key fallback — direct provider calls when cascade is exhausted
    # ------------------------------------------------------------------

    def _call_openai_compatible(
        self,
        api_base: str,
        api_key: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
        extra_headers: dict[str, str] | None = None,
    ) -> ChatResult:
        """Call any OpenAI-compatible endpoint (OpenAI, Google Gemini, OpenRouter)."""
        payload = json.dumps({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }).encode("utf-8")
        headers: dict[str, str] = {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(api_base, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                return ChatResult(model=model, content=content, ok=True, usage=data.get("usage", {}))
        except urllib.error.HTTPError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"HTTP {exc.code}: {exc.reason}")
        except urllib.error.URLError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"URLError: {exc.reason}")
        except (KeyError, json.JSONDecodeError, IndexError) as exc:
            return ChatResult(model=model, content="", ok=False, error=f"ParseError: {exc}")

    def _call_anthropic_direct(
        self,
        api_key: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> ChatResult:
        """Call Anthropic's Messages API directly (non-OpenAI format)."""
        # Extract system message if present
        system = ""
        chat_messages: list[dict[str, str]] = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                chat_messages.append(m)

        body: dict[str, Any] = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            body["system"] = system

        payload = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=payload,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["content"][0]["text"]
                return ChatResult(model=model, content=content, ok=True)
        except urllib.error.HTTPError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"HTTP {exc.code}: {exc.reason}")
        except urllib.error.URLError as exc:
            return ChatResult(model=model, content="", ok=False, error=f"URLError: {exc.reason}")
        except (KeyError, json.JSONDecodeError, IndexError) as exc:
            return ChatResult(model=model, content="", ok=False, error=f"ParseError: {exc}")

    def chat_with_user_keys(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.72,
        max_tokens: int = 1200,
    ) -> ChatResult:
        """
        Fallback: try user-provided provider keys in priority order.
        Called after the main OpenRouter cascade is exhausted.
        """
        from .user_key_store import get_user_key_store  # noqa: PLC0415
        store = get_user_key_store()
        providers = store.ordered_providers()

        for provider, key in providers:
            if provider == "openrouter":
                # User's own OpenRouter key — try the free-tier cascade
                user_router = AIRouter(api_key=key, timeout=self.timeout)
                result = user_router.chat(messages, role="lumi", temperature=temperature, max_tokens=max_tokens)
                if result.ok:
                    return result

            elif provider == "google":
                # Google Gemini via OpenAI-compatible endpoint
                result = self._call_openai_compatible(
                    api_base="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    api_key=key,
                    model="gemini-2.0-flash",
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if result.ok:
                    return result
                # Fallback to 1.5 flash if 2.0 fails
                result = self._call_openai_compatible(
                    api_base="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    api_key=key,
                    model="gemini-1.5-flash",
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if result.ok:
                    return result

            elif provider == "openai":
                # OpenAI via native endpoint
                result = self._call_openai_compatible(
                    api_base="https://api.openai.com/v1/chat/completions",
                    api_key=key,
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if result.ok:
                    return result

            elif provider == "anthropic":
                # Anthropic via native Messages API
                result = self._call_anthropic_direct(
                    api_key=key,
                    model="claude-haiku-4-5",
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if result.ok:
                    return result

        return ChatResult(model="none", content="", ok=False, error="All user keys exhausted or not configured.")

    def lumi_chat(
        self,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        use_ollama: bool = False,
        ollama_model: str | None = None,
        domain: str | None = None,
    ) -> ChatResult:
        """
        LUMI conversational interface — the studio AI assistant.
        Maintains conversation history for multi-turn sessions.

        Priority order:
          1. Local Ollama — auto-used when use_ollama=True OR when no OPENROUTER_API_KEY is set
          2. OpenRouter free-tier cascade (OPENROUTER_API_KEY)
          3. User-provided provider keys (openrouter → google → openai → anthropic)
          4. Ollama last-resort (when API key was set but full cascade failed)
          5. Helpful exhausted message with upgrade guidance

        Args:
            user_message: The user's message.
            history: Prior conversation turns.
            use_ollama: Route to local Ollama instead of OpenRouter.
            ollama_model: Specific Ollama model (e.g. 'gemma3:27b').
            domain: Creative domain for prompt enhancement
                    ('video'|'music'|'game'|'code'|'creative').
        """
        from .lumi_prompt_enhancer import detect_domain, enhance_prompt  # noqa: PLC0415

        resolved_domain = domain or detect_domain(user_message)
        enhanced = enhance_prompt(user_message, domain=resolved_domain)
        system_content = enhanced[0]["content"]

        messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
        if history:
            messages.extend(history[-20:])
        messages.append({"role": "user", "content": user_message})

        # Check Ollama availability once — used in steps 1 and 4
        from .ollama_provider import get_ollama  # noqa: PLC0415
        ollama = get_ollama()
        ollama_available = ollama.is_available()

        # 1. Route to local Ollama when requested OR when no API key is configured
        if use_ollama or not self.api_key:
            if ollama_available:
                if ollama_model:
                    oll_result = ollama.chat(ollama_model, messages, temperature=0.72, max_tokens=1200)
                else:
                    oll_result = ollama.super_gemma_chat(messages, temperature=0.72, max_tokens=1200)
                if oll_result.ok:
                    return ChatResult(model=oll_result.model, content=oll_result.content, ok=True, usage=oll_result.usage)
            # Ollama unavailable or failed — fall through to OpenRouter

        # 2. OpenRouter cascade (system key)
        result = self.chat(messages, role="lumi", temperature=0.72, max_tokens=1200)
        if result.ok:
            return result

        # 3. User-provided keys fallback
        user_result = self.chat_with_user_keys(messages, temperature=0.72, max_tokens=1200)
        if user_result.ok:
            return user_result

        # 4. Auto-try Ollama as last resort (when use_ollama=False and key was set but cascade failed)
        if not use_ollama and self.api_key and ollama_available:
            oll_result = ollama.super_gemma_chat(messages, temperature=0.72, max_tokens=1200)
            if oll_result.ok:
                return ChatResult(model=oll_result.model, content=oll_result.content, ok=True, usage=oll_result.usage)

        # 5. All sources exhausted — return helpful guidance as LUMI response
        return ChatResult(
            model="none",
            content=_build_exhausted_message(),
            ok=False,
            error="All models in cascade exhausted.",
        )

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


def _build_exhausted_message() -> str:
    """
    Build a helpful in-chat message shown to the user when all AI sources are exhausted.
    Guides them to add their own key, wait for rate limit reset, or upgrade.
    """
    from .user_key_store import PROVIDER_CATALOGUE  # noqa: PLC0415

    lines = [
        "Hi! I'm LUMI — TrezzWorld's AI assistant.",
        "",
        "I've temporarily run out of AI resources. All model sources in my cascade have been exhausted.",
        "Here's how to get me back online:\n",
        "─────────────────────────────────────────",
        "OPTION 1 — Run Ollama locally (100% FREE, no account needed) ⭐",
        "─────────────────────────────────────────",
        "Install Ollama: https://ollama.com/download",
        "Then run these two commands in your terminal:",
        "  ollama serve",
        "  ollama pull gemma3:27b",
        "Once Ollama is running, switch to '🖥️ Ollama (local)' in the AI Models tab,",
        "or just ask me anything — I'll automatically use it when available.\n",
        "─────────────────────────────────────────",
        "OPTION 2 — Add your own AI account key",
        "─────────────────────────────────────────",
    ]

    for pid, info in sorted(PROVIDER_CATALOGUE.items(), key=lambda x: x[1]["priority"]):
        star = " ⭐ RECOMMENDED" if info.get("recommended") else ""
        lines.append(f"• {info['name']}{star}")
        lines.append(f"  {info['description']}")
        lines.append(f"  Cost: {info['cost']}")
        lines.append(f"  Get key: {info['get_key_url']}")
        lines.append("")

    lines += [
        "Once you have a key, go to the 🤖 AI Models tab → API Keys section and add it there.",
        "Or connect it directly via:",
        "  POST http://127.0.0.1:8000/api/lumi/user-key",
        '  Body: {"provider": "openrouter", "api_key": "sk-or-..."}\n',
        "─────────────────────────────────────────",
        "OPTION 3 — Check back in 12 hours",
        "─────────────────────────────────────────",
        "Free-tier rate limits reset within 24 hours.",
        "Come back later and I'll pick up right where we left off.\n",
        "─────────────────────────────────────────",
        "OPTION 4 — Upgrade via OpenRouter (lowest cost)",
        "─────────────────────────────────────────",
        "Add $5 credit at https://openrouter.ai — that's thousands of messages",
        "using Gemini Flash or Llama models. No subscription required.",
    ]

    return "\n".join(lines)


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
