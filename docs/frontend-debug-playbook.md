# Frontend Debug Playbook

## Goal
Provide a repeatable debugging workflow for frontend display, responsiveness, overlay, and replay sync issues.

## Process
1. Reproduce first (desktop/tablet/mobile).
2. Capture screenshots and console/runtime errors.
3. Classify root cause.
4. Implement minimal patch.
5. Re-run e2e checks and compare before/after.
6. Write report.

## Mandatory Checks
- `metrics-header`, `filter-panel`, `city-scene`, `detail-drawer`, `timeline-panel` are visible.
- No blocking console/page runtime errors.
- No severe clipping/overlap under 390x844.
- Replay route opens and core replay controls remain interactive.

## Commands
- Backend: `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
- Frontend: `npm --prefix frontend run dev`
- E2E: `npm --prefix frontend run e2e`
