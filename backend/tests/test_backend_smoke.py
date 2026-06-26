from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://127.0.0.1:8765"


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        env = os.environ.copy()
        env["DATA_DIR"] = str(Path(cls._tmpdir.name) / "data")
        cls._server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "backend.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
            ],
            cwd=REPO_ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        cls._wait_until_ready()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._server.terminate()
        try:
            cls._server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            cls._server.kill()
        cls._tmpdir.cleanup()

    @classmethod
    def _wait_until_ready(cls) -> None:
        deadline = time.time() + 30
        last_error = ""
        while time.time() < deadline:
            try:
                payload = cls._get_json("/api/status")
                if payload.get("status") == "running":
                    return
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
            time.sleep(0.5)
        raise RuntimeError(f"Backend failed to start: {last_error}")

    @staticmethod
    def _request(path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
        data = None
        headers: dict[str, str] = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    @classmethod
    def _get_json(cls, path: str) -> dict:
        return cls._request(path)

    @classmethod
    def _post_json(cls, path: str, payload: dict) -> dict:
        return cls._request(path, method="POST", payload=payload)

    def test_status_exposes_readiness_summary(self) -> None:
        payload = self._get_json("/api/status")
        self.assertEqual(payload["status"], "running")
        self.assertIn("readinessScore", payload)
        self.assertIn("warnings", payload)

    def test_health_readiness_returns_checks(self) -> None:
        payload = self._get_json("/api/health/readiness")
        self.assertIn("checks", payload)
        check_ids = {check["id"] for check in payload["checks"]}
        self.assertIn("data-dir", check_ids)
        self.assertIn("mission-store", check_ids)
        self.assertIn("backend-smoke-tests", check_ids)

    def test_platform_status_embeds_backend_readiness(self) -> None:
        payload = self._get_json("/api/studio/platform-status")
        self.assertIn("backendReadiness", payload)
        self.assertIn("integrations", payload)
        self.assertTrue(payload["integrations"]["services"])

    def test_document_roundtrip(self) -> None:
        created = self._post_json(
            "/api/document/create",
            {"title": "Smoke", "content": "backend ready", "format": "md"},
        )
        self.assertTrue(created["ok"])
        document_id = created["documentId"]

        loaded = self._get_json(f"/api/document/{document_id}")
        self.assertEqual(loaded["content"], "backend ready")

        updated = self._post_json(
            f"/api/document/{document_id}/update",
            {"content": "backend updated", "format": "txt"},
        )
        self.assertTrue(updated["ok"])

        reloaded = self._get_json(f"/api/document/{document_id}")
        self.assertEqual(reloaded["content"], "backend updated")
        self.assertEqual(reloaded["format"], "txt")


if __name__ == "__main__":
    unittest.main()
