# App UI Automation Test Report

## Scope

This run validates the desktop workbench UI surface for:

- Main window shell layout
- Mode switching (`overview` / `diagnostics` / `parser_analysis` / `reports`)
- Replay route availability
- Responsive behavior at desktop/tablet/mobile previews
- Console/page runtime error sanity

## Environment

- Workbench UI: Next.js dev server
- Local service: FastAPI (uvicorn)
- Automation engine: Playwright Chromium
- Date: 2026-04-02

## Commands

```bash
npm --prefix frontend run e2e
npm --prefix frontend run build:clean
```

## Test Files

- `frontend/tests/e2e/layout.spec.ts`
- `frontend/tests/e2e/responsive.spec.ts`

## Result

- Total: 4
- Passed: 4
- Failed: 0

## Assertions Covered

- Main shell regions are visible:
  - `metrics-header`
  - `parse-progress-banner`
  - `filter-panel`
  - `city-scene`
  - `detail-drawer`
  - `timeline-panel`
- Mode transitions:
  - diagnostics center visible
  - parser analysis center visible
  - reports center visible
  - return to overview shows city scene
- Replay route opens and replay components are visible.
- Responsive checks at:
  - 1440x900
  - 1024x768
  - 390x844
- Horizontal overflow guard (<= 2px tolerance).

## Notes

- Next.js dev warning about `allowedDevOrigins` is non-blocking.
- Build stability uses `build:clean` to avoid stale `.next` cache artifacts.
