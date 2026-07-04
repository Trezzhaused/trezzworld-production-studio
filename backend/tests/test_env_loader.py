import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.env_loader import bootstrap_environment


class EnvLoaderTests(unittest.TestCase):
    def test_bootstrap_environment_loads_master_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            master_path = Path(tmpdir) / "master.env"
            master_path.write_text("OPENROUTER_API_KEY=shared-key\n", encoding="utf-8")

            with patch.dict(os.environ, {}, clear=True):
                os.environ["MASTER_FILE"] = str(master_path)
                loaded = bootstrap_environment()

                self.assertIn(master_path, loaded)
                self.assertEqual(os.environ["OPENROUTER_API_KEY"], "shared-key")


if __name__ == "__main__":
    unittest.main()
