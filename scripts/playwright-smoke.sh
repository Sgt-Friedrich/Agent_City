#!/usr/bin/env bash
set -euo pipefail

npm --prefix frontend run e2e "$@"
