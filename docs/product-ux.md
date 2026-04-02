# Product UX

## 1. UX Goal

Turn Agent_City from a visualization surface into a complete desktop workbench where users can:
- import repositories,
- launch parsing/testing jobs,
- monitor runtime flow in city view,
- diagnose issues,
- replay traces,
- export reports,
- and iterate with confidence.

## 2. Navigation Model

Primary left navigation modes:
- Overview
- Live
- Replay
- Diagnostics
- Parser Analysis
- Repositories
- Jobs
- Reports
- Settings

Design intent: one-step access to common workflows, no deep nested menu.

## 3. Information Hierarchy

### Top strip
- KPIs
- current mode
- shell/backend/frontend status
- global control actions

### Left panel
- mode switch
- quick analysis entry
- filters/search
- legends

### Center workspace
- city view (overview/live/replay/diagnostics)
- parser analysis center
- repositories center
- jobs center
- reports center
- settings center

### Right inspector
- node/span detail
- diagnostics hotspot support
- context actions

### Bottom strip
- timeline (architecture modes)
- task stream (control modes)

## 4. Interaction Principles

1. Information first: readability before visual effects.
2. Default concise, click for depth.
3. Keep mode semantics explicit:
   - Overview: structure first
   - Live: flow first
   - Replay: path + timing first
   - Diagnostics: anomaly first
   - Parser Analysis: confidence first
   - Repositories/Jobs/Reports/Settings: control first

## 5. Control Plane UX

### Repositories center
- list + health/quality indicators
- parse/re-parse/open/remove/export actions
- direct jump to parser analysis or topology

### Jobs center
- active job visibility
- status/progress/timestamps/log summary
- quick-run actions for common operational tasks

### Reports center
- report list + preview + export/open

### Settings center
- runtime snapshot + persistent app settings
- language switching (`zh` / `en`) with immediate UI refresh

## 6. i18n UX Rules

- locale switch should be immediate and persistent
- status labels must remain consistent across panels
- avoid mixed-language UI in main workflows
- date/time should follow locale format where context is user-facing

## 7. Diagnostics UX

Diagnostics should answer quickly:
- where errors cluster,
- which nodes are slow/congested,
- where retry/fallback is happening,
- and how to drill down into trace/replay/report.

## 8. First-Time Flow

1. Open App
2. Click “add local repository”
3. Use import wizard:
   - select path
   - detect stack
   - preview topology confidence
   - parse and attach
4. Enter Overview/Diagnostics/Parser Analysis
5. Export report or trigger regression jobs

## 9. Known UX Boundaries

- Large-scale topology still needs future clustering and progressive disclosure tuning.
- Some deep technical strings remain intentionally raw in low-level debug panels.
