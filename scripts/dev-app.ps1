#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "[Agent_City] one-click desktop startup..."
node scripts/start-app.js dev
