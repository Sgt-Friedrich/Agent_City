# Product UX

## 1. UX Objective

Agent_City is a desktop analysis workbench. The UX goal is:

1. Understand architecture quickly.
2. Observe runtime behavior continuously.
3. Diagnose issues with minimal interaction friction.
4. Close the loop from issue -> fix -> regression -> report.

## 2. Workbench Navigation Model

The left navigation provides direct mode switching:

- Overview
- Live
- Diagnostics
- Parser Analysis
- Reports

This avoids deep nested menus and keeps mode transitions explicit.

## 3. Main Window Information Hierarchy

### Top strip
- KPI summary
- active mode
- desktop shell status
- local service readiness

### Left panel
- mode switch
- filters
- search
- diagnostic toggles

### Center workspace
- city view (overview/live/diagnostics)
- parser analysis surface
- reports document center

### Right inspector
- node/span details
- diagnostics hotspot list

### Bottom timeline
- request path progression
- event stream context

## 4. Interaction Principles

1. Default simple, drill-down rich.
2. Hover for summary, click for detail.
3. Mode-specific emphasis:
   - overview: structure first
   - live: motion first
   - diagnostics: anomaly first
   - parser analysis: confidence first
   - reports: evidence first

## 5. Visual Semantics

### District
- clear semantic zoning, not random placement.

### Building
- height = activity/heat
- footprint = component scope
- color = health status

### Flow
- color by span kind/status
- speed and trail convey latency/load
- retry/fallback/error with explicit visual patterns

## 6. Diagnostics UX

Diagnostics is designed for quick triage:
- slow nodes
- error nodes
- congested nodes
- unstable edges (retry/fallback/error)
- trace handles for focused follow-up

## 7. Parser Analysis UX

Parser analysis emphasizes explainability:
- parser confidence and grade
- source coverage map
- unresolved symbols
- low-confidence edges
- issue list with suggestions

## 8. Reports UX

Reports center supports:
- artifact catalog
- inline content preview
- export selected document
- export live analysis report
- open docs directory from desktop shell

## 9. Desktop-first Behavior

Compared with browser-only tools, this workbench adds:
- local service orchestration awareness
- desktop save/open capabilities
- stable long-session operation context
- consistent local environment assumptions

## 10. Known UX Boundaries

- Extremely large topologies may require future clustering strategy.
- Parser confidence remains heuristic-driven for unknown frameworks.
- Desktop shell uses Tauri; production signing/notarization remains outside current scope.
