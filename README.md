# TrezzWorld Production Studio

> Offline-first creative suite built with **Electron**, **React**, and **FastAPI**.

---

## Repository Structure

```
trezzworld-production-studio/
├── app/
│   ├── electron/
│   │   ├── main.ts          # Electron main process
│   │   └── preload.ts       # Preload script (contextBridge API)
│   └── react/
│       ├── index.html       # HTML entry point for Vite
│       ├── main.tsx         # React DOM entry
│       └── App.tsx          # Root React component
├── backend/
│   ├── __init__.py
│   ├── config.py            # App configuration constants
│   ├── main.py              # FastAPI application
│   └── requirements.txt     # Python dependencies
├── docs/
│   └── README.md            # Additional documentation
├── dist/                    # Build output (git-ignored)
│   ├── electron/            # Compiled Electron main + preload
│   └── renderer/            # Vite-built React app
├── release/                 # electron-builder distributable (git-ignored)
├── .gitignore
├── CHANGELOG.md
├── electron-builder.yml     # electron-builder packaging config
├── package.json
├── tsconfig.json            # TypeScript config for React renderer
├── tsconfig.node.json       # TypeScript config for Electron (CommonJS)
└── vite.config.ts           # Vite config for React renderer
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Python | ≥ 3.11 |

---

## Development

### 1 – Install Node dependencies

```powershell
npm install
```

### 2 – Install Python dependencies

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
pip install -r backend/requirements.txt
```

### 3 – Start the FastAPI backend

Open a dedicated terminal:

```powershell
npm run backend:dev
```

The API will be available at `http://localhost:8000`. You can browse the auto-generated docs at `http://localhost:8000/docs`.

### 4 – Start Electron + React (dev mode)

In another terminal:

```powershell
npm run dev
```

This runs:
- **`npm run dev:renderer`** – Vite dev server on `http://localhost:5173`
- **`npm run dev:electron`** – waits for the renderer, then launches Electron pointing at it

---

## Build & Package

```powershell
# Build renderer (Vite) + Electron (tsc)
npm run build

# Package into a distributable (uses electron-builder)
npm run dist
```

Distributables are written to the `release/` folder.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Returns `{ status, version }` |
| GET | `/api/meta-development/status` | Returns roadmap phases, repository intelligence, and readiness checks |
| GET | `/api/meta-builder/status` | Returns MetaBuilder gap analysis, next actions, and autonomy readiness estimate |
| POST | `/api/meta-builder/continue` | Generates the next autonomous action batch from a high-level objective |
| GET | `/api/studio/control-plane` | Returns the ready-to-start studio GUI/control-plane model |
| POST | `/api/studio/control-plane/boot` | Bootstraps a prompt-driven LUMI mission batch for the control plane |
| GET | `/docs` | FastAPI interactive docs (Swagger UI) |

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Run renderer + Electron concurrently in dev mode |
| `npm run dev:renderer` | Start Vite dev server only |
| `npm run dev:electron` | Start Electron only (waits for renderer) |
| `npm run build` | Build renderer and Electron for production |
| `npm run dist` | Build then package with electron-builder |
| `npm run backend:dev` | Start FastAPI dev server with hot-reload |

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
