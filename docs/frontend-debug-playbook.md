# App UI Debug Playbook

## Goal
Provide a repeatable workflow for diagnosing and fixing Agent_City desktop app UI issues.

## Standard Loop
1. Launch desktop app workbench (`npm --prefix desktop run dev`) or browser preview fallback.
2. Reproduce in the main window states (desktop/tablet/mobile viewports).
3. Capture screenshots and console/page/runtime errors.
4. Classify root cause:
   - layout/sizing
   - state synchronization
   - overlay/z-index
   - 3D scene/camera
   - replay/timeline sync
   - runtime exception
5. Apply minimal patch.
6. Re-run automation checks and compare before/after.
7. Record fix report.

## Mandatory Checks
- `metrics-header`, `filter-panel`, `city-scene`, `detail-drawer`, `timeline-panel` are visible.
- diagnostics / parser analysis / reports views switch correctly.
- no blocking runtime errors in console/page logs.
- no severe clipping/overlap under 390x844.
- replay window route opens and key controls remain interactive.

## Commands
- Desktop app: `npm --prefix desktop run dev`
- Local backend only: `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
- Workbench UI only: `npm --prefix frontend run dev`
- App UI automation: `npm --prefix frontend run e2e`
- Full system check: `python scripts/run_full_system_tests.py`
