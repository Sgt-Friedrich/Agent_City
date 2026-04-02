# App Workbench Design

## 1. Workbench Objective

Agent_City desktop application is a local workbench for:

1. Agent architecture parsing
2. Runtime trace observation
3. City-style behavior visualization
4. Replay and diagnostics
5. Parser capability analysis
6. Report export and engineering closure

The workbench is designed for long-running analysis sessions, not one-time demos.

## 2. Main Window Layout

The main window uses a 5-region workbench layout:

1. Top status strip
- Global KPI and active mode
- Shell status (desktop app / browser preview)
- Local service readiness (frontend/backend)

2. Left navigation and filters
- Workbench mode switch:
  - Overview
  - Live
  - Diagnostics
  - Parser Analysis
  - Reports
- Search, district filter, node-type filter, trace/span filters
- Flow legend and diagnostic mode toggles

3. Center workspace
- 3D city visualization (overview/live/diagnostics)
- Parser analysis center
- Reports center

4. Right inspector
- Node/span details for runtime inspection
- Diagnostics side panel for hotspot triage

5. Bottom timeline
- Event timeline and trace stream
- Replay-linked span progression context

## 3. View Semantics

### 3.1 Overview
- Purpose: understand global architecture and health at first glance.
- Behavior: all districts visible with balanced overlays.

### 3.2 Live
- Purpose: inspect active traffic and currently executing traces.
- Behavior: live flows, active span highlights, event-hover details.

### 3.3 Replay
- Purpose: step through one request path and timing.
- Behavior: focused route playback with span timeline and synchronized details.

### 3.4 Diagnostics
- Purpose: locate slow/error/congested points quickly.
- Behavior: diagnostic scoring, unstable edge list, retry/fallback emphasis.

### 3.5 Parser Analysis
- Purpose: inspect topology trustworthiness.
- Behavior: confidence, source coverage, unresolved symbols, low-confidence edges.

### 3.6 Reports
- Purpose: read and export architecture/parser/system reports.
- Behavior: report catalog, document preview, desktop save/open actions.

## 4. Desktop Service Orchestration

The Tauri desktop shell orchestrates local services:

- Backend (FastAPI): `127.0.0.1:8000`
- Frontend workbench UI: `127.0.0.1:3000`

Behavior:
1. Detect existing external services and reuse when available.
2. Spawn managed services when not available.
3. Expose runtime status to renderer via Tauri invoke bridge.
4. Terminate managed services on app quit.

## 5. Desktop Command Contract

The shell exposes:

- `get_app_status`
- `save_text_report({ defaultFileName, content })`
- `open_path(targetPath)`
- `open_reports_directory()`

The renderer uses `frontend/lib/desktopBridge.ts` and falls back to browser behavior when shell APIs are unavailable.

## 6. Interaction Principles

1. Information-first: visual effects support diagnosis, not decoration.
2. One-step operations for common tasks.
3. Predictable drill-down:
   - district -> node -> edge -> trace -> span -> payload/report
4. Explicit failure context:
   - parser unresolved reasons
   - runtime retry/fallback/error signals

## 7. Known Boundaries

1. Desktop shell uses Tauri and local process spawn; signed bundle pipeline is out of current scope.
2. Packaging workflow is lightweight; production notarization/signing is not included.
3. Parser extraction remains heuristic-first for cross-language robustness.

## 8. Migration Readiness

Shell and service orchestration are isolated under `desktop/src-tauri` and `frontend/lib/desktopBridge.ts`.
This boundary keeps shell replacement cost low for future packaging/runtime changes.
