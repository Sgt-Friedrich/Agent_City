# Frontend E2E Test Report

## Scope

This run validates the frontend visual stack for:

- Dashboard core layout
- Replay route availability
- Responsive behavior at desktop/tablet/mobile
- Runtime console/page error sanity checks

## Environment

- Frontend: `Next.js (dev server)`
- Backend: `FastAPI (uvicorn)`
- Browser engine: `Playwright Chromium`

## Commands Executed

```bash
npm --prefix frontend run e2e:install
npm --prefix frontend run e2e
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
  - `filter-panel`
  - `city-scene`
  - `detail-drawer`
  - `timeline-panel`
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

## Observations

- Next.js dev server emitted a non-blocking warning for future `allowedDevOrigins` behavior.
- No blocking runtime/frontend regression was observed in this run.

## Follow-up

- Optional hardening: add `allowedDevOrigins` in `frontend/next.config.mjs` to silence future compatibility warning.
