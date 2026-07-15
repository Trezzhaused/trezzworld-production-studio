import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.master_document import build_master_document_status, load_master_document


class MasterDocumentTests(unittest.TestCase):
    def test_build_master_document_status_returns_generated_payload(self) -> None:
        status = build_master_document_status()
        self.assertTrue(status["ready"])
        self.assertEqual(status["product"], "TrezzBLOX Studio Creator")
        self.assertIn("studio.trezzhaus.com", status["domains"])
        self.assertIn("trezzworld-studio-production", status["domains"])

    def test_load_master_document_reads_external_json_document(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "master-document.json"
            payload = {
                "title": "Shared Launch Blueprint",
                "summary": "External summary for the live launch stack.",
                "domains": ["studio.trezzhaus.com", "trezzworld-studio-production"],
                "workstreams": [{"name": "Launch", "focus": "Release planning"}],
                "repositories": ["studio.trezzhaus.com"],
                "capabilities": ["Cross-repo handoff"],
                "launchChecklist": ["Verify the handoff"],
            }
            path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.dict(os.environ, {"MASTER_DOCUMENT": str(path)}, clear=False):
                document = load_master_document()
                status = build_master_document_status()

            self.assertEqual(document["title"], "Shared Launch Blueprint")
            self.assertEqual(document["summary"], "External summary for the live launch stack.")
            self.assertEqual(document["source"], str(path))
            self.assertEqual(status["title"], "Shared Launch Blueprint")
            self.assertEqual(status["source"], str(path))

    def test_load_master_document_reads_external_markdown_document(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "master-document.md"
            path.write_text("# Shared Release Notes\n\nThis document lives in a shared repo.\n", encoding="utf-8")
            with patch.dict(os.environ, {"MASTER_DOCUMENT": str(path)}, clear=False):
                document = load_master_document()

            self.assertEqual(document["title"], "Shared Release Notes")
            self.assertEqual(document["summary"], "This document lives in a shared repo.")
            self.assertEqual(document["source"], str(path))

    def test_load_master_document_reads_repo_name_from_master_document_repos(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_root = Path(tmpdir)
            sibling_repo = repo_root / "trezzworld-studio-production"
            sibling_repo.mkdir()
            path = sibling_repo / "master-document.md"
            path.write_text("# Shared Repo Notes\n\nA sibling repo doc.\n", encoding="utf-8")
            with patch.dict(os.environ, {"MASTER_DOCUMENT_REPOS": "trezzworld-studio-production"}, clear=False):
                document = load_master_document(repo_root)

            self.assertEqual(document["title"], "Shared Repo Notes")
            self.assertEqual(document["summary"], "A sibling repo doc.")
            self.assertEqual(document["source"], str(path))


if __name__ == "__main__":
    unittest.main()
