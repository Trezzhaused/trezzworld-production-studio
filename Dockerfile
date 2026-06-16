# ── Stage 1: Build the React UI ──────────────────────────────────────────────
FROM node:20-slim AS ui-builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY app/ app/
COPY vite.config.ts tsconfig.json tsconfig.node.json ./

RUN npm run build:renderer

# ── Stage 2: Python backend + built UI ───────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ backend/

# Copy built React UI from stage 1 (served as static files by FastAPI)
COPY --from=ui-builder /build/dist/renderer dist/renderer/

# Expose the port Railway / any host will forward to
ENV PORT=8000
EXPOSE 8000

# Start the FastAPI server
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
