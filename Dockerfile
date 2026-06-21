# Stage 1: Build the React UI
FROM node:20-slim AS ui-builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
COPY app/ app/
COPY vite.config.ts tsconfig.json tsconfig.node.json ./
RUN npm run build:renderer

# Stage 2: Python backend + built UI
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies: FFmpeg for video encoding, plus Inkscape/GIMP/
# FreeCAD/Xvfb backing LUMI's creative-tool capabilities (backend/lumi_creative_tools.py)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg inkscape gimp freecad xvfb && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ backend/

# Copy phase architecture files (required for production readiness checks)
COPY kernel/ kernel/
COPY orchestration/ orchestration/
COPY digitalTwin/ digitalTwin/
COPY capability/ capability/
COPY testing/ testing/
COPY autonomous/ autonomous/
COPY lumi/ lumi/
COPY security/ security/
COPY quality/ quality/
COPY deployment/ deployment/
COPY README.md README.md

# Copy built React UI from stage 1
COPY --from=ui-builder /build/dist/renderer dist/renderer/

# Expose port
ENV PORT=8000
EXPOSE 8000

# Start FastAPI — use $PORT directly (Railway sets this)
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
