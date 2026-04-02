@echo off
setlocal
cd /d "%~dp0"
echo [Agent_City] one-click app startup...
npm run app:start
