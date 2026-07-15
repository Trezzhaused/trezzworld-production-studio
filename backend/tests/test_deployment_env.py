import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.deployment_env import discover_master_file, load_deployment_environment


class DeploymentEnvTests(unittest.TestCase):
    def test_discovers_checkout_env_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_root = Path(tmpdir)
            checkout_root = repo_root / ".master-file-repo"
            checkout_root.mkdir(parents=True)
            master_path = checkout_root / "master.env"
            master_path.write_text("RAILWAY_TOKEN=shared-token\n", encoding="utf-8")

            discovered = discover_master_file(repo_root)
            self.assertEqual(discovered, master_path)

    def test_load_deployment_environment_prefers_existing_env_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_root = Path(tmpdir)
            checkout_root = repo_root / ".master-file-repo"
            checkout_root.mkdir(parents=True)
            master_path = checkout_root / "master.env"
            master_path.write_text(
                "RAILWAY_TOKEN=shared-token\nRAILWAY_PROJECT_ID=proj-123\nPRODUCTION_URL=https://shared.example\n",
                encoding="utf-8",
            )

            with patch.dict(os.environ, {"RAILWAY_TOKEN": "repo-secret-token"}, clear=True):
                env_file, missing = load_deployment_environment(repo_root=repo_root, required_vars=["RAILWAY_TOKEN", "RAILWAY_PROJECT_ID"])

                self.assertEqual(env_file, master_path)
                self.assertEqual(os.environ["RAILWAY_TOKEN"], "repo-secret-token")
                self.assertEqual(os.environ["RAILWAY_PROJECT_ID"], "proj-123")
                self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
