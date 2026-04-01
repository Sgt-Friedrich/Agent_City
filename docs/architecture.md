# Agent_City Architecture

## 1. Architecture Overview

Agent_City is a **desktop application workbench** composed of four layers:

1. Desktop shell layer (Electron)
2. UI workbench layer (Next.js/React)
3. Local service layer (FastAPI)
4. Parsing/runtime core layer (discovery/normalization/binding)

## 2. Layer Diagram

```mermaid
flowchart LR
  subgraph Desktop["Desktop Shell (Electron)"]
    Main["main.js"]
    Preload["preload.js"]
    IPC["IPC bridge"]
    ProcMgr["local service manager"]
  end

  subgraph UI["Workbench UI (Next.js)"]
    ShellUI["Main Window Layout"]
    City["City Visualization"]
    Replay["Replay Center"]
    Diag["Diagnostics Center"]
    Parser["Parser Analysis Center"]
    Reports["Reports Center"]
    Store["Zustand app state"]
  end

  subgraph API["Local Service (FastAPI)"]
    Routers["REST + WebSocket routers"]
    Platform["PlatformService"]
    ReportSvc["ReportService"]
  end

  subgraph Core["Parsing + Runtime Core"]
    Discovery["Topology Discovery"]
    Normalizer["Topology Normalizer"]
    Runtime["Runtime Trace Resolver"]
    Binding["Topology Binding"]
    Parsers["Multi-language parsers"]
  end

  Main --> ProcMgr
  Main --> IPC
  IPC --> Preload
  Preload --> ShellUI
  ShellUI --> Store
  Store --> City
  Store --> Replay
  Store --> Diag
  Store --> Parser
  Store --> Reports

  Store --> Routers
  Routers --> Platform
  Routers --> ReportSvc
  Platform --> Discovery
  Platform --> Normalizer
  Platform --> Runtime
  Platform --> Binding
  Discovery --> Parsers
```

## 3. Desktop Shell Responsibilities

- Start and supervise local backend/frontend services when needed.
- Reuse existing local services if already running.
- Expose desktop-safe capabilities through preload bridge:
  - report save
  - open local path
  - app status query
- Keep renderer isolated from Node internals.

Code paths:
- `desktop/main.js`
- `desktop/preload.js`
- `desktop/src/serviceManager.js`

## 4. Local Service Responsibilities

### 4.1 Platform APIs
- Topology and target management
- Trace stream and replay data
- Metrics and diagnostics summary
- Parser analysis report generation

### 4.2 Reports APIs
- report catalog
- report content retrieval

Code paths:
- `backend/app/main.py`
- `backend/app/routers/*.py`
- `backend/app/services/platform_service.py`
- `backend/app/services/report_service.py`

## 5. Parsing and Runtime Core

### Static parsing
- `topology_discovery.py`
- `topology_normalizer.py`
- `parsers/*.py` (Python/TS/Go/Rust/Java/C#/Config)
- `confidence_scoring.py`

### Runtime parsing and binding
- `runtime_trace_resolver.py`
- `topology_binding.py`

### Semantics
- declared edge / observed edge / inferred edge / retry / fallback
- unresolved symbols + confidence + graceful degradation

## 6. Workbench UI Composition

Main window composition:

1. Top KPI/status strip
2. Left navigation + filters
3. Center workspace (city/parser/reports)
4. Right inspector (detail/diagnostics)
5. Bottom timeline

Primary modules:
- `frontend/components/DashboardApp.tsx`
- `frontend/components/city/*`
- `frontend/components/analysis/*`
- `frontend/components/panels/*`

## 7. Data Contracts

Canonical contract definitions:
- Backend: `backend/app/models/schemas.py`
- Frontend: `frontend/types/schema.ts`

Key entities:
- `District`, `Node`, `Edge`
- `TraceEnvelope`, `SpanEvent`, `FlowEvent`
- `DiagnosticsSummary`, `ParserAnalysisReport`
- `ReportArtifact`, `ReportContent`
- `DesktopAppStatus`

## 8. Test and Closure Loop

- Parser regression tests: `tests/parser/*`
- App UI automation tests: `frontend/tests/e2e/*`
- Full-system test runner: `scripts/run_full_system_tests.py`
- Reference cleanup: `scripts/cleanup_refs.py`

Outputs:
- parser reports
- frontend fix reports
- full system test report
