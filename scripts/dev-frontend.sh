#!/usr/bin/env bash
set -euo pipefail

if [ -f frontend/package.json ]; then
  if command -v npm >/dev/null 2>&1; then
    npm --prefix frontend install
    npm --prefix frontend run dev
  else
    echo "npm not found"
    exit 1
  fi
else
  echo "frontend/package.json not found"
  exit 1
fi
