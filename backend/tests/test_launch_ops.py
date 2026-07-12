import os
import unittest
from unittest.mock import patch

from backend.main import _config_status
from backend.ops import build_ops_status


class LaunchOpsReadinessTests(unittest.TestCase):
    def test_config_status_exposes_master_file_and_lumi_summary(self):
        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "demo-key",
                "FFMPEG_PATH": "/usr/bin/ffmpeg",
                "MASTER_FILE": "/tmp/master.env",
            },
            clear=False,
        ):
            status = _config_status()
            self.assertTrue(status["lumi"]["routerConfigured"])
            self.assertTrue(status["masterFile"]["configured"])
            self.assertTrue(status["launchReadiness"]["deploymentSmokeTest"])
            self.assertTrue(status["launchReadiness"]["compliancePages"])

    def test_ops_status_reports_rollbacks_and_compliance(self):
        with patch.dict(os.environ, {"SENTRY_DSN": "https://demo@sentry.io/1"}, clear=False):
            status = build_ops_status()
            self.assertEqual(status["service"], "trezzworld-production-studio")
            self.assertTrue(status["rollback"]["documented"])
            self.assertTrue(status["compliance"]["privacyPolicy"])
            self.assertTrue(status["compliance"]["cookieConsent"])
            self.assertTrue(status["errorTracking"]["configured"])


if __name__ == "__main__":
    unittest.main()
