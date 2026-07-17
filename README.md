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

## Roblox Studio MCP connection
A workspace MCP configuration is available at `.vscode/mcp.json` for Windows-based Roblox Studio workflows. It exposes a `Roblox_Studio` server entry that launches the Roblox MCP batch file from `%LOCALAPPDATA%\Roblox` with:

```bat
cmd.exe /c cd /d %LOCALAPPDATA%\Roblox && .\mcp.bat
```

If your Roblox MCP launcher is installed under a different path, update the command in `.vscode/mcp.json` before connecting the server from your MCP client.

## Shared master document layer
- A starter shared document lives at `docs/master-document.json`.
- The backend also discovers shared master documents from `MASTER_DOCUMENT`, `MASTER_DOCUMENT_PATH`, `MASTER_DOC_PATH`, or `MASTER_DOCUMENT_REPOS`.
- The studio UI surfaces the loaded document summary in the Settings tab so the shared layer is visible during operations.
