# AGENTS.md

## Project Summary
Agent_City is a desktop workbench for Agent architecture parsing, runtime trace observation, city-style visualization, replay diagnostics, parser analysis, and report export.

## Stack
- Desktop shell: Tauri
- UI workbench: Next.js + TypeScript + Tailwind + React Three Fiber + Zustand
- Local service: FastAPI + WebSocket
- Automation tests: Playwright

## Primary Commands
- Desktop app install: `npm --prefix desktop install`
- Desktop app dev: `npm --prefix desktop run dev`
- Desktop shell smoke: `npm --prefix desktop run test:smoke`
- Frontend workbench dev: `npm --prefix frontend run dev`
- Frontend build (clean): `npm --prefix frontend run build:clean`
- Frontend automation tests: `npm --prefix frontend run e2e`
- Backend service run: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (cwd: `backend`)
- Full system test: `python scripts/run_full_system_tests.py`

## App UI Debug Workflow
When asked to analyze App display or interaction issues:
1. Reproduce before patching.
2. Validate main window states at 1440x900, 1024x768, 390x844.
3. Capture screenshots plus console/page errors.
4. Classify root cause:
   - layout/sizing
   - state synchronization
   - overlay/z-index
   - 3D scene/camera/canvas
   - replay/timeline synchronization
   - runtime exception
5. Apply the smallest high-confidence fix.
6. Re-run automation tests.
7. Output root cause, changed files, verification status, residual risks.

## High-Risk Areas
- 3D scene sizing and camera framing.
- Left navigation + center workspace + right inspector + timeline coordination.
- Live flow overlays and pointer interactions.
- Replay synchronization between span list, timeline, and inspector.
- Parser/diagnostics mode switch consistency.

## Skill Chain
Prefer this repository-local sequence:
- `frontend-repro`
- `frontend-visual-debug`
- `frontend-fix`
- `frontend-regression`
- `frontend-report`

## Trigger Hints
When tasks mention °∞œ‘ æŒ Ã‚ / layout / responsive / overflow / overlap / replay / z-index / canvas / visual regression°±, use the debug skill chain.
