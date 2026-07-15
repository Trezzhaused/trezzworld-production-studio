# TrezzBLOX Studio Creator

AI-powered creative studio for building Roblox experiences. Live at https://studio.trezzhaus.com

## Status
- Backend: Running
- Version: 0.1.0-alpha
- Production Readiness: 100%

## Launch readiness
- Backend health: `/api/health`
- Config status: `/api/config/status`
- Ops status: `/api/ops/status`
- Master document: `/api/master-document`
- Deployment smoke checks: `npm run smoke:deploy`
- Rollback guidance: see `docs/launch-readiness.md`

## Shared master document layer
- A starter shared document lives at `docs/master-document.json`.
- The backend also discovers shared master documents from `MASTER_DOCUMENT`, `MASTER_DOCUMENT_PATH`, `MASTER_DOC_PATH`, or `MASTER_DOCUMENT_REPOS`.
- The studio UI surfaces the loaded document summary in the Settings tab so the shared layer is visible during operations.
