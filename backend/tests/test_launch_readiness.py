import os
import unittest
from unittest.mock import patch

from backend.main import _config_status


class LaunchReadinessTests(unittest.TestCase):
    def test_config_status_reports_auth_and_rate_limit(self):
        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "demo-key",
                "FFMPEG_PATH": "/usr/bin/ffmpeg",
                "AUTH_REQUIRED": "true",
                "LUMI_API_KEY": "demo-lumi-key",
                "LUMI_RATE_LIMIT_PER_MINUTE": "120",
            },
            clear=False,
        ):
            status = _config_status()
            self.assertTrue(status["ok"])
            self.assertTrue(status["auth"]["required"])
            self.assertTrue(status["auth"]["apiKeyConfigured"])
            self.assertEqual(status["auth"]["rateLimitPerMinute"], 120)
            self.assertEqual(status["product"]["name"], "TrezzBLOX Studio Creator")
            self.assertTrue(status["product"]["launchReady"])
            self.assertEqual(status["launchReadiness"]["studioCreator"]["productName"], "TrezzBLOX Studio Creator")

    def test_config_status_flags_missing_auth_for_production(self):
        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "demo-key",
                "FFMPEG_PATH": "/usr/bin/ffmpeg",
                "AUTH_REQUIRED": "true",
                "LUMI_API_KEY": "",
            },
            clear=False,
        ):
            status = _config_status()
            self.assertFalse(status["ok"])
            self.assertTrue(status["auth"]["required"])
            self.assertFalse(status["auth"]["apiKeyConfigured"])
            self.assertTrue(any("AUTH_REQUIRED" in warning for warning in status["warnings"]))
            self.assertFalse(status["product"]["launchReady"])
            self.assertFalse(status["launchReadiness"]["studioCreator"]["launchReady"])


if __name__ == "__main__":
    unittest.main()
