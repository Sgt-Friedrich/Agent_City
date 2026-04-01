#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
OUT_DIR="$ROOT_DIR/tmp/frontend-debug"
mkdir -p "$OUT_DIR"

echo "[frontend-repro] write evidence to: $OUT_DIR"
date > "$OUT_DIR/captured_at.txt"
echo "Run Playwright screenshots and console collection in regression stage." > "$OUT_DIR/notes.txt"
