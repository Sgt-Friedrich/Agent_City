# Frontend Fix Report (2026-04-02)

## Scope
Stabilize the productized dashboard modes (`overview/diagnostics/parser`) and remove runtime regressions discovered by Playwright.

## Issues Found

1. Parser Analysis mode runtime crash:
   - Cause: `ParserAnalysisCenter` assumed edge fields are always `from/to` and called `.split()` on `undefined`.
2. Diagnostics mode console error warning:
   - Cause: duplicate React keys in Recent Trace Handles list (`trace_id` duplicates).

## Fixes Applied

### 1) API + Frontend edge field compatibility
- Backend: `backend/app/routers/analysis.py`
  - analysis endpoints now serialize with `by_alias=True`.
- Frontend: `frontend/components/analysis/ParserAnalysisCenter.tsx`
  - added endpoint resolver (`from/to` with `from_node/to_node` fallback).
  - added safe short-name formatting.

### 2) Duplicate key warning elimination
- `frontend/components/analysis/DiagnosticsCenter.tsx`
  - dedupe trace handles via `Set` before rendering.
  - hardened key generation for notes list.
- `frontend/components/analysis/ParserAnalysisCenter.tsx`
  - hardened unresolved symbol keys with index suffix.

## Added Regression Test

- `tests/parser/test_analysis_api.py`
  - verifies `/api/analysis/parser` exposes edge fields as `from/to`.

## Validation

- Backend compile: `python -m compileall backend/app` (pass)
- Parser unit tests: `python -m unittest discover -s tests/parser -p "test_*.py" -v` (11/11 pass)
- Frontend build: `npm --prefix frontend run build` (pass)
- Frontend e2e: `npm --prefix frontend run e2e` (4/4 pass)

## Remaining Risks

- Next.js dev warning about future `allowedDevOrigins` config remains non-blocking.
