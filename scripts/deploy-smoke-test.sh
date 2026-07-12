#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8000}"
ENDPOINTS=(/api/health /api/config/status /api/ops/status)

for endpoint in "${ENDPOINTS[@]}"; do
  echo "Checking $BASE_URL$endpoint"
  curl --fail --silent --show-error --location "$BASE_URL$endpoint" >/dev/null
done

echo "Smoke checks passed for $BASE_URL"
