# Frontend E2E Test Report

## Scope

This run validates the full frontend interaction surface for:

- Dashboard shell and core panels
- Mode switch (`overview` / `diagnostics` / `parser_analysis`)
- Replay route availability and panel visibility
- Responsive behavior at desktop/tablet/mobile
- Runtime console/page error sanity checks

## Environment

- Frontend: Next.js dev server
- Backend: FastAPI (uvicorn)
- Browser: Playwright Chromium
- Date: 2026-04-02

## Commands Executed

```bash
npm --prefix frontend run e2e:install
npm --prefix frontend run e2e
npm --prefix frontend run build
```

## Test Files

- `frontend/tests/e2e/layout.spec.ts`
- `frontend/tests/e2e/responsive.spec.ts`

## Result

- Total: 4
- Passed: 4
- Failed: 0

## Assertions Covered

- Dashboard core zones are visible:
  - `metrics-header`
  - `parse-progress-banner`
  - `filter-panel`
  - `city-scene`
  - `detail-drawer`
  - `timeline-panel`
- Mode transitions are functional:
  - diagnostics center visible after switching to diagnostics mode
  - parser analysis center visible after switching to parser mode
  - city scene visible after switching back to overview
- Replay link opens replay page successfully.
- Replay core zones are visible:
  - `replay-controller`
  - `replay-city-panel`
  - `replay-span-list`
- Responsive checks at:
  - 1440x900
  - 1024x768
  - 390x844
- Horizontal overflow guard (<= 2px tolerance).

## Regressions Fixed In This Run

1. Parser Analysis runtime crash due mixed edge field names (`from/to` vs `from_node/to_node`).
2. Diagnostics panel duplicate React keys causing console error warnings.

## Observations

- Next.js dev server emits a non-blocking warning about future `allowedDevOrigins` behavior.
- No blocking runtime/frontend regression remained after fixes.

## Follow-up

- Optional hardening: add `allowedDevOrigins` in `frontend/next.config.mjs` to silence future compatibility warning.
