$ErrorActionPreference = "Stop"

if (!(Test-Path "frontend/package.json")) {
  throw "frontend/package.json not found"
}

npm --prefix frontend install
npm --prefix frontend run dev
