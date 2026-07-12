from __future__ import annotations

import os
from typing import Any

from .config import VERSION
from .env_loader import LOADED_ENV_FILES


def build_ops_status() -> dict[str, Any]:
    monitoring_configured = bool(
        os.environ.get("UPTIME_MONITOR_URL")
        or os.environ.get("SENTRY_DSN")
        or os.environ.get("LOGTAIL_TOKEN")
        or os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    )
    error_tracking = {
        "configured": bool(os.environ.get("SENTRY_DSN") or os.environ.get("LOGTAIL_TOKEN")),
        "providers": [
            provider
            for provider, enabled in (
                ("sentry", bool(os.environ.get("SENTRY_DSN"))),
                ("logtail", bool(os.environ.get("LOGTAIL_TOKEN"))),
            )
            if enabled
        ],
    }
    log_aggregation = {
        "configured": bool(os.environ.get("LOGTAIL_TOKEN") or os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")),
        "transport": "external" if bool(os.environ.get("LOGTAIL_TOKEN") or os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")) else "stdout",
    }
    master_file_configured = bool(
        os.environ.get("MASTER_FILE")
        or os.environ.get("MASTER_ENV_FILE")
        or os.environ.get("SHARED_ENV_FILE")
        or os.environ.get("ENV_FILE")
        or os.environ.get("DOTENV_PATH")
    )
    return {
        "service": "trezzworld-production-studio",
        "version": VERSION,
        "environment": {
            "appEnv": os.environ.get("APP_ENV", "production"),
            "masterFileConfigured": master_file_configured,
            "loadedEnvFiles": [str(path) for path in LOADED_ENV_FILES],
            "openRouterConfigured": bool(os.environ.get("OPENROUTER_API_KEY")),
        },
        "monitoring": {
            "uptimeEndpoint": "/api/health",
            "configured": monitoring_configured,
            "checks": [
                {"name": "health", "endpoint": "/api/health"},
                {"name": "config", "endpoint": "/api/config/status"},
                {"name": "ops", "endpoint": "/api/ops/status"},
            ],
        },
        "errorTracking": error_tracking,
        "logAggregation": log_aggregation,
        "rollback": {
            "documented": True,
            "workflow": ".github/workflows/deploy.yml",
            "instructions": "Re-run the deployment workflow or redeploy the previous Railway release from the deployment panel if a release regresses.",
        },
        "smokeTests": {
            "script": "scripts/deploy-smoke-test.sh",
            "endpoints": ["/api/health", "/api/config/status", "/api/ops/status"],
        },
        "compliance": {
            "privacyPolicy": True,
            "termsOfService": True,
            "contactPage": True,
            "cookieConsent": True,
        },
    }
