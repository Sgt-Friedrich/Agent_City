#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "[Agent_City] starting desktop app workbench..."

if (-not (Test-Path "desktop\\node_modules")) {
  npm --prefix desktop install
}

npm --prefix desktop run dev
