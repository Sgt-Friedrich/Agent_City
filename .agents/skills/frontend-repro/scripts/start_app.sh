#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

echo "[frontend-repro] starting backend"
(
  cd "$ROOT_DIR/backend"
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[frontend-repro] starting frontend"
cd "$ROOT_DIR"
npm --prefix frontend run dev
