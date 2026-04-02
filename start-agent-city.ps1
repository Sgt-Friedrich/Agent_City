#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "[Agent_City] one-click app startup..."
npm run app:start
