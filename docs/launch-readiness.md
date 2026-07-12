# Launch readiness checklist

## Operational safety
- Monitor `/api/health`, `/api/config/status`, and `/api/ops/status` from your uptime provider.
- Route logs to stdout plus an external aggregation service if `LOGTAIL_TOKEN` or `OTEL_EXPORTER_OTLP_ENDPOINT` is configured.
- Keep `SENTRY_DSN` or `LOGTAIL_TOKEN` populated for exception visibility in production.

## Deployment smoke tests
- Run `npm run smoke:deploy` after starting the backend locally or in a deployment environment.
- The smoke test validates the health, configuration, and ops endpoints before a release is considered healthy.

## Rollback plan
1. Re-run the deployment workflow to roll forward to the latest known-good revision.
2. If the release regresses after deployment, redeploy the previous Railway release from the Railway dashboard.
3. Verify `/api/health`, `/api/config/status`, `/api/ops/status`, and the public studio URL before re-enabling user traffic.

## Lumi + shared env readiness
- Ensure `OPENROUTER_API_KEY` is configured for the LUMI chat pipeline.
- Make sure the shared master environment file is reachable through `MASTER_FILE`, `MASTER_ENV_FILE`, `SHARED_ENV_FILE`, or a supported default path.
- Confirm the backend can read the same shared env values by checking `/api/config/status`.
