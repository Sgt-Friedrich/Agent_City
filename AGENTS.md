# AGENTS.md

## Project Summary
Agent_City is a desktop workbench for Agent architecture parsing, runtime trace observation, city-style visualization, replay diagnostics, parser analysis, and report export.

## Stack
- Desktop shell: Tauri
- UI workbench: Next.js + TypeScript + Tailwind + React Three Fiber + Zustand
- Local service: FastAPI + WebSocket
- Automation tests: Playwright

## Primary Commands
- One-click app start: `npm run app:start`
- Desktop app dev: `npm --prefix desktop run dev`
- Desktop shell smoke: `npm --prefix desktop run test:smoke`
- Frontend workbench dev: `npm --prefix frontend run dev`
- Frontend build (clean): `npm --prefix frontend run build:clean`
- App UI automation tests (static bundle): `npm --prefix frontend run e2e:app`
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
When tasks mention “显示问题 / layout / responsive / overflow / overlap / replay / z-index / canvas / visual regression”, use the debug skill chain.

## External Reference Policy (Must Follow)
When researching external products/projects for design or architecture:

Priority order:
1. Official documentation first
2. Official screenshots/demo pages second
3. Source repositories only when necessary
4. Community blogs/forums only as supplemental (must be labeled non-official)
5. Unattributed screenshots last (do not use as primary evidence)

Clone restrictions:
- Do not mass-clone first.
- If clone is required, use shallow clone (`--depth=1`) and prefer `--filter=blob:none`.
- Keep external repos under `refs/` or `tmp_refs/` only.
- Analyze only required directories/files.

Mandatory output before clone (per reference target):
1. 3-5 key takeaways
2. What fits Agent_City
3. What should not be copied directly
4. Whether clone is required
5. If clone is required, exact directories/files to inspect

Cleanup requirements:
- Remove all unneeded reference repos after research.
- Any single reference directory > 200MB must be deleted.
- Run cleanup script and record what was kept/removed.
