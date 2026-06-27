from __future__ import annotations

import base64
import importlib
import io
import os
import sys
import tempfile
import time
import unittest
import wave
from pathlib import Path

from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parents[2]


def _tiny_png_bytes() -> bytes:
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0S8AAAAASUVORK5CYII="
    )


def _tiny_wav_bytes() -> bytes:
    buffer = io.BytesIO()
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
        os.environ["DATA_DIR"] = str(Path(cls._tmpdir.name) / "data")
        os.environ["REQUIRE_MEDIA_AUTH"] = "false"
        os.environ["VOICE_LIBRARY_DIR"] = str(Path(cls._tmpdir.name) / "voice-library")
        for module_name in [name for name in list(sys.modules) if name == "backend" or name.startswith("backend.")]:
            sys.modules.pop(module_name, None)
        backend_main = importlib.import_module("backend.main")
        cls.client = TestClient(backend_main.app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        cls._tmpdir.cleanup()

    def test_status_exposes_readiness_summary(self) -> None:
        payload = self.client.get("/api/status").json()
        self.assertEqual(payload["status"], "running")
        self.assertIn("readinessScore", payload)
        self.assertIn("warnings", payload)

    def test_health_readiness_returns_checks(self) -> None:
        payload = self.client.get("/api/health/readiness").json()
        self.assertIn("checks", payload)
        check_ids = {check["id"] for check in payload["checks"]}
        self.assertIn("data-dir", check_ids)
        self.assertIn("mission-store", check_ids)
        self.assertIn("backend-smoke-tests", check_ids)
        self.assertIn("voice-library", check_ids)
        self.assertIn("cors-origins", check_ids)

    def test_platform_status_embeds_backend_readiness(self) -> None:
        payload = self.client.get("/api/studio/platform-status").json()
        self.assertIn("backendReadiness", payload)
        self.assertIn("integrations", payload)
        self.assertTrue(payload["integrations"]["services"])

    def test_document_roundtrip(self) -> None:
        created = self.client.post(
            "/api/document/create",
            json={"title": "Smoke", "content": "backend ready", "format": "md"},
        ).json()
        self.assertTrue(created["ok"])
        document_id = created["documentId"]

        loaded = self.client.get(f"/api/document/{document_id}").json()
        self.assertEqual(loaded["content"], "backend ready")

        updated = self.client.post(
            f"/api/document/{document_id}/update",
            json={"content": "backend updated", "format": "txt"},
        ).json()
        self.assertTrue(updated["ok"])

        reloaded = self.client.get(f"/api/document/{document_id}").json()
        self.assertEqual(reloaded["content"], "backend updated")
        self.assertEqual(reloaded["format"], "txt")

    def test_image_upload_roundtrip(self) -> None:
        response = self.client.post(
            "/api/image/upload",
            files={"file": ("tiny.png", _tiny_png_bytes(), "image/png")},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])

        downloaded = self.client.get(payload["imageUrl"])
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded.headers["content-type"], "image/png")

    def test_voice_catalogues_are_available(self) -> None:
        voice_catalogue = self.client.get("/api/voice/catalogue").json()
        video_voices = self.client.get("/api/video/voices").json()
        video_jobs = self.client.get("/api/video/jobs").json()
        self.assertTrue(voice_catalogue["voices"])
        self.assertTrue(video_voices["voices"])
        self.assertIn("jobs", video_jobs)

    def test_voice_library_import_and_search(self) -> None:
        response = self.client.post(
            "/api/voice/library/import",
            data={"collectionName": "lumi pack", "tags": "voiceover,ambient"},
            files=[("files", ("intro.wav", _tiny_wav_bytes(), "audio/wav"))],
        )
        self.assertEqual(response.status_code, 200)
        job = response.json()
        self.assertIn(job["status"], {"queued", "running", "completed", "completed_with_errors"})

        deadline = time.time() + 10
        latest = job
        while time.time() < deadline:
            latest = self.client.get(f"/api/voice/library/import/{job['jobId']}").json()
            if latest["status"] in {"completed", "completed_with_errors", "failed"}:
                break
            time.sleep(0.1)

        self.assertEqual(latest["status"], "completed")
        self.assertEqual(latest["importedFiles"], 1)
        asset_id = latest["items"][0]["assetId"]
        self.assertTrue(asset_id)

        listed = self.client.get("/api/voice/library/assets?q=intro&collectionName=lumi pack&tag=voiceover").json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["assetId"], asset_id)

        detail = self.client.get(f"/api/voice/library/assets/{asset_id}").json()
        self.assertEqual(detail["collectionName"], "lumi pack")

        downloaded = self.client.get(f"/api/voice/library/assets/{asset_id}/download")
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded.headers["content-type"], "audio/wav")


if __name__ == "__main__":
    unittest.main()
