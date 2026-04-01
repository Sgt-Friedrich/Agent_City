# AGENTS.md

## Project Summary
This repository contains an Agent architecture visualizer with a 3D city view, live flow overlays, replay mode, and monitoring panels.

## Frontend Stack
- Next.js
- TypeScript
- Tailwind CSS
- React Three Fiber
- Zustand
- Playwright

## Canonical Frontend Rules
- Reuse existing components, tokens, and layout primitives.
- Prefer minimal, high-confidence fixes.
- Do not create a parallel styling system.
- Preserve desktop/tablet/mobile behavior.
- Avoid one-off absolute positioning unless already established.

## Primary Commands
- Frontend install: `npm --prefix frontend install`
- Frontend dev: `npm --prefix frontend run dev`
- Frontend build: `npm --prefix frontend run build`
- Frontend e2e: `npm --prefix frontend run e2e`
- Backend run: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (cwd: `backend`)

## Frontend Debug Workflow
When asked to analyze frontend display issues:
1. Reproduce first. Do not patch before reproduction.
2. Validate at 1440x900, 1024x768, 390x844.
3. Capture screenshots and console/runtime errors.
4. Classify root cause: CSS/layout, responsive, state, hydration/runtime, z-index/portal, 3D canvas sizing, replay sync.
5. Apply minimal fix.
6. Re-run Playwright checks.
7. Output root cause, changed files, validation results, residual risks.

## Project-Specific High-Risk Areas
- 3D canvas sizing and camera framing.
- KPI header + filter panel + detail drawer + timeline overlap.
- Live flow overlay pointer blocking.
- Replay path highlight and timeline synchronization.

## Skill Chain
Prefer this repo-local sequence:
- `frontend-repro`
- `frontend-visual-debug`
- `frontend-fix`
- `frontend-regression`
- `frontend-report`

## Trigger Hints
When tasks mention °∞œ‘ æŒ Ã‚ / layout / responsive / screenshot / overflow / overlap / tooltip / replay / z-index / canvas size / visual regression°±, prefer the frontend debugging skills chain.
