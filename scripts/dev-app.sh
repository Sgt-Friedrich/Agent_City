#!/usr/bin/env bash
set -euo pipefail

echo "[Agent_City] starting desktop app workbench..."

if [ ! -d "desktop/node_modules" ]; then
  npm --prefix desktop install
fi

npm --prefix desktop run dev
