# App UI Fix Report (2026-04-02)

## Scope
Stabilize workbench mode switching and analysis surfaces in the desktop-app-oriented Agent_City UI.

## Issues Found

1. Parser Analysis runtime crash:
   - Cause: mixed edge payload fields (`from/to` vs `from_node/to_node`) produced `undefined.split(...)`.
2. Diagnostics panel warning noise:
   - Cause: duplicate React keys in trace-handle rendering.
3. Workbench mode coverage gap:
   - Cause: reports mode and desktop shell status were missing in main window flow.

## Fixes Applied

### 1) Analysis payload compatibility hardening
- Backend: `backend/app/routers/analysis.py`
  - analysis endpoints now use `model_dump(by_alias=True)`.
- UI: `frontend/components/analysis/ParserAnalysisCenter.tsx`
  - tolerant endpoint mapping + safe formatting.

### 2) Diagnostics rendering cleanup
- `frontend/components/analysis/DiagnosticsCenter.tsx`
  - dedupe trace handles via `Set`
  - hardened key generation

### 3) Workbench feature completion
- Added `Reports` mode and report center:
  - `frontend/components/analysis/ReportsCenter.tsx`
  - `backend/app/routers/reports.py`
  - `backend/app/services/report_service.py`
- Added desktop shell status polling:
  - `frontend/hooks/useDesktopAppStatus.ts`
- Reworked main window shell composition:
  - `frontend/components/DashboardApp.tsx`

## Added Regression Tests

- `tests/parser/test_analysis_api.py`
- `tests/parser/test_reports_api.py`
- updated app UI automation: `frontend/tests/e2e/layout.spec.ts` (reports mode assertion)

## Validation

- Backend compile: pass
- Parser unit tests: `12/12` pass
- Workbench build (`build:clean`): pass
- App UI automation tests: `4/4` pass
- Desktop shell contract smoke: pass (`npm --prefix desktop run test:smoke`)

## Remaining Risks

- `next build` may intermittently fail with `/_document` cache artifact if stale `.next` exists; `build:clean` mitigates this in CI and local checks.
- Desktop shell currently uses Electron; production packaging hardening (signing/notarization) is out of current scope.
