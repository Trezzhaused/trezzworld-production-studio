from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import uuid
import wave
from io import BytesIO
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://127.0.0.1:8765"


def _tiny_png_bytes() -> bytes:
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0S8AAAAASUVORK5CYII="
    )


def _tiny_wav_bytes() -> bytes:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(b"\x00\x00" * 1600)
    return buffer.getvalue()


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        env = os.environ.copy()
        env["DATA_DIR"] = str(Path(cls._tmpdir.name) / "data")
        env["REQUIRE_MEDIA_AUTH"] = "false"
        env["VOICE_LIBRARY_DIR"] = str(Path(cls._tmpdir.name) / "voice-library")
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
                last_error = f"{type(exc).__name__}: {exc}"
            time.sleep(0.5)
        raise RuntimeError(f"Backend failed to start: {last_error}")

    @staticmethod
    def _request(
        path: str,
        *,
        method: str = "GET",
        payload: dict | None = None,
        form: dict[str, str] | None = None,
        files: list[tuple[str, str, bytes, str]] | None = None,
    ) -> tuple[dict[str, str], bytes]:
        data = None
        headers: dict[str, str] = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif form is not None or files is not None:
            boundary = f"----TrezzWorld{uuid.uuid4().hex}"
            body = bytearray()
            for key, value in (form or {}).items():
                body.extend(f"--{boundary}\r\n".encode("utf-8"))
                body.extend(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
                body.extend(str(value).encode("utf-8"))
                body.extend(b"\r\n")
            for field_name, filename, content, content_type in files or []:
                body.extend(f"--{boundary}\r\n".encode("utf-8"))
                body.extend(
                    f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8")
                )
                body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
                body.extend(content)
                body.extend(b"\r\n")
            body.extend(f"--{boundary}--\r\n".encode("utf-8"))
            data = bytes(body)
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {k.lower(): v for k, v in resp.headers.items()}, resp.read()

    @classmethod
    def _get_json(cls, path: str) -> dict:
        _, payload = cls._request(path)
        return json.loads(payload.decode("utf-8"))

    @classmethod
    def _post_json(cls, path: str, payload: dict) -> dict:
        _, body = cls._request(path, method="POST", payload=payload)
        return json.loads(body.decode("utf-8"))

    @classmethod
    def _post_multipart(
        cls,
        path: str,
        *,
        form: dict[str, str] | None = None,
        files: list[tuple[str, str, bytes, str]] | None = None,
    ) -> tuple[dict[str, str], dict]:
        headers, body = cls._request(path, method="POST", form=form, files=files)
        return headers, json.loads(body.decode("utf-8"))

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
        self.assertIn("voice-library", check_ids)
        self.assertIn("cors-origins", check_ids)

    def test_platform_status_embeds_backend_readiness(self) -> None:
        payload = self._get_json("/api/studio/platform-status")
        self.assertIn("backendReadiness", payload)
        self.assertIn("integrations", payload)
        self.assertTrue(payload["integrations"]["services"])

    def test_three_d_asset_manifest_is_available(self) -> None:
        payload = self._get_json("/api/3d/asset-manifest")
        self.assertEqual(payload["engine"], "babylonjs")
        self.assertIn("assetCategories", payload)
        self.assertTrue(payload["assetCategories"])
        category_ids = {category["id"] for category in payload["assetCategories"]}
        self.assertIn("main-hero", category_ids)
        self.assertIn("environment-kit", category_ids)
        self.assertIn("ui-hud", category_ids)
        hero = next(category for category in payload["assetCategories"] if category["id"] == "main-hero")
        self.assertIn("reviewCandidates", hero)
        self.assertTrue(hero["reviewCandidates"])
        self.assertEqual(hero["recommendedAsset"]["license"], "CC0")

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

    def test_image_upload_roundtrip(self) -> None:
        headers, payload = self._post_multipart(
            "/api/image/upload",
            files=[("file", "tiny.png", _tiny_png_bytes(), "image/png")],
        )
        self.assertTrue(payload["ok"])

        download_headers, _ = self._request(payload["imageUrl"])
        self.assertIn("image/png", download_headers["content-type"])

    def test_voice_catalogues_are_available(self) -> None:
        voice_catalogue = self._get_json("/api/voice/catalogue")
        video_voices = self._get_json("/api/video/voices")
        video_jobs = self._get_json("/api/video/jobs")
        self.assertTrue(voice_catalogue["voices"])
        self.assertTrue(video_voices["voices"])
        self.assertIn("jobs", video_jobs)

    def test_voice_library_import_and_search(self) -> None:
        _, job = self._post_multipart(
            "/api/voice/library/import",
            form={"collectionName": "lumi pack", "tags": "voiceover,ambient"},
            files=[("files", "intro.wav", _tiny_wav_bytes(), "audio/wav")],
        )
        self.assertIn(job["status"], {"queued", "running", "completed", "completed_with_errors"})

        deadline = time.time() + 10
        latest = job
        while time.time() < deadline:
            latest = self._get_json(f"/api/voice/library/import/{job['jobId']}")
            if latest["status"] in {"completed", "completed_with_errors", "failed"}:
                break
            time.sleep(0.1)

        self.assertEqual(latest["status"], "completed")
        self.assertEqual(latest["importedFiles"], 1)
        asset_id = latest["items"][0]["assetId"]
        self.assertTrue(asset_id)

        listed = self._get_json("/api/voice/library/assets?q=intro&collectionName=lumi%20pack&tag=voiceover")
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["assetId"], asset_id)

        detail = self._get_json(f"/api/voice/library/assets/{asset_id}")
        self.assertEqual(detail["collectionName"], "lumi pack")

        headers, _ = self._request(f"/api/voice/library/assets/{asset_id}/download")
        self.assertIn("audio/wav", headers["content-type"])


if __name__ == "__main__":
    unittest.main()
