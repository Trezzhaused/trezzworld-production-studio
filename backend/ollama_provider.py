"""
Ollama local model provider for LUMI.

Connects to a local Ollama instance (default http://localhost:11434).
Supports SuperGemma 26B (gemma3:27b / gemma2:27b), Llama 3.1, Mistral, and any
model pulled into the local Ollama registry.

Usage:
    Set OLLAMA_HOST env var to override the default base URL.
    Ollama must be running: `ollama serve`
    Pull a model first: `ollama pull gemma3:27b`
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

OLLAMA_DEFAULT_HOST = "http://localhost:11434"

# Known SuperGemma / Google Gemma models available via Ollama
SUPER_GEMMA_MODELS: list[str] = [
    "gemma3:27b",    # SuperGemma 26B (27B params) — flagship
    "gemma3:12b",
    "gemma3:4b",
    "gemma2:27b",    # Previous gen 27B
    "gemma2:9b",
    "gemma:7b",
]

# Full curated local model list (Ollama defaults)
OLLAMA_MODELS: list[dict[str, str]] = [
    {"id": "gemma3:27b",          "family": "gemma",    "label": "SuperGemma 26B (gemma3:27b)"},
    {"id": "gemma3:12b",          "family": "gemma",    "label": "Gemma 3 12B"},
    {"id": "gemma3:4b",           "family": "gemma",    "label": "Gemma 3 4B"},
    {"id": "gemma2:27b",          "family": "gemma",    "label": "Gemma 2 27B"},
    {"id": "llama3.1:8b",         "family": "llama",    "label": "Llama 3.1 8B"},
    {"id": "llama3.1:70b",        "family": "llama",    "label": "Llama 3.1 70B"},
    {"id": "mistral:7b",          "family": "mistral",  "label": "Mistral 7B"},
    {"id": "mistral-nemo:12b",    "family": "mistral",  "label": "Mistral Nemo 12B"},
    {"id": "qwen2.5:7b",          "family": "qwen",     "label": "Qwen 2.5 7B"},
    {"id": "qwen2.5:72b",         "family": "qwen",     "label": "Qwen 2.5 72B"},
    {"id": "deepseek-r1:7b",      "family": "deepseek", "label": "DeepSeek R1 7B"},
    {"id": "deepseek-r1:32b",     "family": "deepseek", "label": "DeepSeek R1 32B"},
    {"id": "phi4:14b",            "family": "phi",      "label": "Phi-4 14B"},
    {"id": "phi3.5:3.8b",         "family": "phi",      "label": "Phi 3.5 3.8B"},
]


@dataclass
class OllamaResult:
    model: str
    content: str
    ok: bool = True
    error: str = ""
    usage: dict[str, int] = field(default_factory=dict)


class OllamaProvider:
    """
    Client for local Ollama inference.

    Falls back gracefully when Ollama is not running — returns ok=False
    so the AIRouter cascade can continue to OpenRouter models.
    """

    def __init__(self, host: str | None = None, timeout: int = 120) -> None:
        self.host = (host or os.environ.get("OLLAMA_HOST", OLLAMA_DEFAULT_HOST)).rstrip("/")
        self.api_key = os.environ.get("OLLAMA_API_KEY", "").strip()
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = "Bearer " + self.api_key
        return headers

    # ------------------------------------------------------------------
    # Status probe
    # ------------------------------------------------------------------

    def is_available(self) -> bool:
        """Return True if Ollama is reachable."""
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", headers=self._headers(), method="GET")
            with urllib.request.urlopen(req, timeout=3):
                return True
        except Exception:
            return False

    def list_local_models(self) -> list[dict[str, Any]]:
        """Return models currently pulled in the local Ollama registry."""
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", headers=self._headers(), method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("models", [])
        except Exception:
            return []

    def local_model_ids(self) -> set[str]:
        """Return the set of model IDs currently available locally."""
        models = self.list_local_models()
        return {m.get("name", "").split(":")[0] + ":" + m.get("name", "").split(":")[-1]
                if ":" in m.get("name", "") else m.get("name", "")
                for m in models}

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> OllamaResult:
        """Send a chat request to the local Ollama model."""
        payload = json.dumps({
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self.host}/api/chat",
            data=payload,
            headers={
                "Content-Type": "application/json",
                **self._headers(),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data.get("message", {}).get("content", "")
                usage = {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                }
                return OllamaResult(model=model, content=content, ok=True, usage=usage)
        except urllib.error.URLError as exc:
            return OllamaResult(model=model, content="", ok=False,
                                error=f"Ollama unavailable: {exc.reason}")
        except (json.JSONDecodeError, KeyError) as exc:
            return OllamaResult(model=model, content="", ok=False,
                                error=f"Ollama parse error: {exc}")

    def super_gemma_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> OllamaResult:
        """
        Attempt SuperGemma 26B (gemma3:27b) first, then fall back to
        smaller Gemma variants if the large model is not pulled locally.
        """
        available = self.local_model_ids()
        for model_id in SUPER_GEMMA_MODELS:
            if model_id in available:
                return self.chat(model_id, messages, temperature, max_tokens)

        # If no Gemma is pulled, try gemma3:27b anyway (will error if not present)
        return self.chat("gemma3:27b", messages, temperature, max_tokens)

    # ------------------------------------------------------------------
    # Model catalogue for API surface
    # ------------------------------------------------------------------

    def catalogue(self) -> list[dict[str, Any]]:
        """Return the full local model catalogue with availability flags."""
        available = self.local_model_ids()
        return [
            {
                "id": m["id"],
                "family": m["family"],
                "label": m["label"],
                "available": any(
                    m["id"] == a or m["id"].split(":")[0] == a.split(":")[0]
                    for a in available
                ),
            }
            for m in OLLAMA_MODELS
        ]


# Module-level singleton
_provider: OllamaProvider | None = None


def get_ollama() -> OllamaProvider:
    """Return the module-level OllamaProvider singleton."""
    global _provider  # noqa: PLW0603
    if _provider is None:
        _provider = OllamaProvider()
    return _provider
