# Agent City Visual Observability MVP

A runnable MVP for **agent architecture parsing + runtime flow monitoring + city-style visualization**.

The system follows **two parsing layers + one rendering layer**:

- Static Parsing Layer: discover architecture from config/registry/code and normalize to topology.
- Runtime Parsing Layer: resolve request execution to traces/spans/events and bind to topology.
- Visualization Layer: render districts/buildings/roads and overlay live/replay flow animations.

## 1) Project Structure

```text
agent-city-mvp/
  docs/
    reference-notes.md
  backend/
    app/
      main.py
      dependencies.py
      models/schemas.py
      routers/{topology,traces,nodes,metrics}.py
      services/
        topology_discovery.py
        topology_normalizer.py
        runtime_trace_resolver.py
        topology_binding.py
        telemetry_adapters.py
        platform_service.py
      sources/
        topology_source_protocol.py
        mock_topology_source.py
        repo_topology_source.py
        intelligent_topology_source.py
        mock_trace_source.py
        mock_metrics_source.py
      generators/live_event_generator.py
    requirements.txt
    sample_data/*.json
  frontend/
    app/{layout,page,globals}.tsx
    app/replay/[traceId]/page.tsx
    components/{city,panels,replay}/*.tsx
    hooks/{useBootstrapData,useLiveFlowSocket,useFilteredTopology}.ts
    lib/{api,config,colorMaps,visualTheme,utils}.ts
    store/useDashboardStore.ts
    types/schema.ts
  samples/*.json
  scripts/
    cleanup_refs.py
```

## 2) Data Models and Types

Canonical schema:

- Backend: `backend/app/models/schemas.py`
- Frontend: `frontend/types/schema.ts`

Includes:

- `District`
- `Node`
- `Edge`
- `TraceEnvelope`
- `SpanEvent` / `FlowEvent`
- `NodeMetricSnapshot`
- `TraceRecord`
- `BoundTrace`

`SpanKind` includes:

- `AGENT`, `CHAIN`, `LLM`, `TOOL`, `RETRIEVER`, `RERANKER`, `EMBEDDING`, `GUARDRAIL`, `EVALUATOR`, `MEMORY`, `MCP`

## 3) Static Parsing Layer (Architecture Parsing Core)

Files:

- `backend/app/services/topology_discovery.py`
- `backend/app/services/topology_normalizer.py`
- `backend/app/sources/topology_source_protocol.py`
- `backend/app/sources/repo_topology_source.py`
- `backend/app/sources/intelligent_topology_source.py`

Capabilities:

- Topology Discovery
  - Reads agent config/workflow/tool registry/MCP-related code signals.
  - Supports repository targets: `mock`, `claude`, `codex`.
  - Supports unknown repositories via heuristic intelligent parsing:
    - path/content role scoring
    - registration snippet extraction
    - import/call based relation inference
    - semantic edge completion (planner/retrieval/tool/memory/llm/guardrail/runtime)
- Topology Normalizer
  - Normalizes to `District / Node / Edge`.
  - Adds layout coordinates for city rendering.
- Provenance
  - `source_type`, `source_location`, `inferred_from`, `confidence` retained in normalized objects.

## 4) Runtime Parsing Layer

Files:

- `backend/app/services/runtime_trace_resolver.py`
- `backend/app/services/topology_binding.py`
- `backend/app/generators/live_event_generator.py`

Capabilities:

- Runtime Trace Resolver
  - Builds traces from semantic paths and maps aliases to real topology nodes.
  - Simulates required 5 path families:
    1. `chat -> planner -> retriever -> reranker -> llm -> final`
    2. `chat -> planner -> tool -> llm -> final`
    3. `chat -> planner -> memory -> llm -> guardrail -> final`
    4. `chat -> planner -> tool -> retry -> fallback -> final`
    5. `chat -> planner -> mcp -> tool result -> llm -> final`
- Topology + Trace Binding
  - Binds spans to declared edges.
  - Emits inferred observed/fallback/retry edges when absent.

## 5) Backend APIs

FastAPI entry: `backend/app/main.py`

REST:

- `GET /api/targets`
- `POST /api/targets/register`
- `GET /api/topology?target=mock|claude|codex`
- `GET /api/traces?target=...`
- `GET /api/traces/{trace_id}?target=...`
- `GET /api/nodes/{node_id}?target=...`
- `GET /api/metrics/summary?target=...`

WebSocket:

- `/ws/live?target=mock|claude|codex`
- Stream: `trace_started -> flow_event* -> trace_completed -> heartbeat`

Register unknown repository target:

```bash
curl -X POST "http://localhost:8000/api/targets/register" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "D:/path/to/new-agent-repo",
    "target_id": "new_agent",
    "label": "New Agent",
    "force": true
  }'
```

Then use:

- `GET /api/topology?target=new_agent`
- `/ws/live?target=new_agent`

## 6) Frontend Visualization Layer

Main page `/`:

- KPI header
- Left filter panel
- Center 3D city scene
- Right detail drawer
- Bottom timeline
- Flow hover card + city mini-map
- Diagnostic mode switch (`realtime` / `heatmap` / `errors`)

Replay page `/replay/[traceId]?target=...`:

- Play/pause/reset/replay/scrub
- Speed control (`0.5x/1x/1.5x/2x/4x`)
- Highlight current span path in city
- Span list + current span details
- Cinematic darkening + current step subtitle

Target switching:

- Header dropdown selects `mock / claude / codex`.
- Frontend refetches topology/traces/metrics and reconnects WS for selected target.
- Header `+ add repo` button registers unseen repositories and switches target automatically.

Visual style layer:

- Theme tokens and mapping helpers: `frontend/lib/visualTheme.ts`
- Business-to-visual mapping:
  - district color: architecture domain (planning/retrieval/memory/tools/llm/safety/runtime/boundary)
  - node height: module scale/weight and hotness
  - node color: health status (`healthy/warning/error/idle`)
  - flow color: span kind (`LLM/retrieval/tool+MCP/memory/runtime/error`)
  - flow density: throughput hint
  - flow speed: latency inverse (slower motion = bottleneck)
- Diagnostic animations:
  - pulse status lamp: active node
  - dashed/curved flow: retry/fallback
  - red blink flow: error/rejection
  - replay dark mode + single-trace highlight: demo and troubleshooting readability
- Demo readability effects:
  - district border + hover summary
  - close-range labels, far-range declutter
  - mini-map overview for quick spatial orientation

## 7) How To Run

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

- Dashboard: `http://localhost:3000`
- Replay: `http://localhost:3000/replay/<trace_id>?target=claude`

## 8) Reference Cleanup Rule (>=200MB)

Reference cleanup script:

```bash
python scripts/cleanup_refs.py --root . --dry-run
python scripts/cleanup_refs.py --root . --threshold-mb 200
```

Behavior:

- Scans `refs/`, `tmp/`, `external_examples/`
- Prints each subdirectory size
- Deletes directories larger than 200MB (unless `--dry-run`)

Reference notes and executed cleanup log:

- `docs/reference-notes.md`

Parser regression artifacts:

- `docs/parser-test-plan.md`
- `docs/parser-test-results.md`
- `docs/parser-capability-summary.md`
- `docs/parser-fix-report.md`
- `docs/parser-regression-summary.md`
- `tests/fixtures/parsed_samples/*.json`

Run parser regression:

```bash
python scripts/run_parser_regression.py
```

Run representative parser retest:

```bash
python scripts/run_parser_retest.py
```

## 9) Real Repo Validation (Claude/Codex)

Implemented and validated with local repos:

- `../claude-code-src-main`
- `../codex-main`
- current project path as unseen repository target (intelligent parser)

Validation checks performed:

- Target discovery: `/api/targets` returns `mock`, `claude`, `codex`.
- Topology parsing:
  - `claude`: nodes and edges discovered from real paths/registries.
  - `codex`: workspace crates and Cargo dependency edges parsed.
- Runtime flow binding:
  - For all 5 scenarios, generated spans map to existing nodes.
- WebSocket stream:
  - `/ws/live?target=claude|codex` emits valid flow events.
- Unknown target intelligent parsing:
  - `POST /api/targets/register` -> `source_type=intelligent_repo_scan`.
  - topology/trace/ws endpoints work on registered unseen target.

Generated target-specific sample data:

- `samples/claude.*.sample.json`
- `samples/codex.*.sample.json`
- `samples/mock.*.sample.json`

## 10) OpenTelemetry / OpenInference / Jaeger / Langfuse / Phoenix Extension

Reserved integration seam:

- `backend/app/services/telemetry_adapters.py`

Migration path:

1. Implement concrete `TelemetryAdapter` for OTLP/Jaeger/Tempo/Langfuse/Phoenix.
2. Feed real spans into `RuntimeTraceResolver` instead of mock source.
3. Keep `TopologyBindingService` and frontend schema contract unchanged.
4. Replace WS generator input with adapter stream for real-time production telemetry.

## 11) Layer Mapping Summary

Static Parsing Layer:

- `topology_discovery.py`
- `topology_normalizer.py`
- `repo_topology_source.py`
- `intelligent_topology_source.py`

Runtime Parsing Layer:

- `runtime_trace_resolver.py`
- `topology_binding.py`
- `live_event_generator.py`

Visualization Layer:

- `frontend/components/city/*`
- `frontend/components/panels/*`
- `frontend/components/replay/*`
- `frontend/store/useDashboardStore.ts`

## 12) Visual Mapping Semantics

Business-to-visual mapping used in the city view:

- District color: architecture domain (`planning/retrieval/memory/tools/llm/safety/runtime/boundary`)
- Building base size: module scope / weight
- Building height: module hotness / activity
- Building color: node health status
  - healthy: green
  - warning: yellow
  - error: red
  - idle: gray-blue
- Status lamp pulse: active node
- Flow color:
  - LLM: blue
  - Retrieval: green
  - Tool/MCP: purple
  - Memory: yellow
  - Error/Retry/Fallback: red
- Flow density: throughput hint
- Flow speed/trail: latency and blocking hint

Diagnostic-oriented effects:

- Retry/fallback: dashed / loop-like curved flow styling
- Error: red highlighted flow + timeline emphasis
- Replay: city dimming + focused trace path
- Diagnostic mode: `realtime` / `heatmap` / `errors`
