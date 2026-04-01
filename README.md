# Agent City Visual Observability MVP

A runnable MVP for **agent architecture parsing + runtime flow monitoring + city-style visualization**.

The platform is designed around **two parsing layers + one rendering layer**:

- Static Parsing Layer: discover architecture from config/registries/code hints and normalize into topology.
- Runtime Parsing Layer: resolve request execution into traces/spans/flow events and bind them to topology.
- Visualization Layer: render districts/buildings/roads and overlay live/replay flows.

---

## Step 1. Project Structure

```text
agent-city-mvp/
  backend/
    app/
      main.py
      dependencies.py
      models/
        schemas.py
      routers/
        topology.py
        traces.py
        nodes.py
        metrics.py
      services/
        topology_discovery.py
        topology_normalizer.py
        runtime_trace_resolver.py
        topology_binding.py
        telemetry_adapters.py
        platform_service.py
      sources/
        mock_topology_source.py
        mock_trace_source.py
        mock_metrics_source.py
      generators/
        live_event_generator.py
    requirements.txt
    sample_data/
      topology.sample.json
      traces.sample.json
      trace_detail.sample.json
      flow_events.sample.json
      metrics_summary.sample.json
  frontend/
    app/
      layout.tsx
      page.tsx
      globals.css
      replay/[traceId]/page.tsx
    components/
      DashboardApp.tsx
      city/
        CityScene.tsx
        DistrictGround.tsx
        BuildingNode.tsx
        EdgeRoad.tsx
        LiveFlows.tsx
      panels/
        MetricsHeader.tsx
        FilterPanel.tsx
        DetailDrawer.tsx
        TimelinePanel.tsx
      replay/
        ReplayApp.tsx
        ReplayController.tsx
        ReplaySpanList.tsx
    hooks/
      useBootstrapData.ts
      useLiveFlowSocket.ts
      useFilteredTopology.ts
    lib/
      api.ts
      config.ts
      colorMaps.ts
      utils.ts
    store/
      useDashboardStore.ts
    types/
      schema.ts
    package.json
    tailwind.config.ts
    tsconfig.json
  samples/
    (copied sample json from backend/sample_data)
  requirements.txt
```

---

## Step 2. Data Models and Types

Canonical schema implemented in:

- Backend: `backend/app/models/schemas.py`
- Frontend: `frontend/types/schema.ts`

Includes:

- `District`
- `Node`
- `Edge`
- `TraceEnvelope`
- `SpanEvent` / `FlowEvent`
- `NodeMetricSnapshot`
- `TopologyGraph`
- `TraceRecord`
- `BoundTrace`

`Edge` supports:

- `kind`, `protocol`, `confidence`, `inferred_from`
- declared + observed + fallback + retry + inferred semantics

`SpanKind` supports:

- `AGENT`, `CHAIN`, `LLM`, `TOOL`, `RETRIEVER`, `RERANKER`, `EMBEDDING`, `GUARDRAIL`, `EVALUATOR`, `MEMORY`, `MCP`

---

## Step 3. Backend Topology Parser and Resolver

Core parser modules:

- `topology_discovery.py`
  - Topology Discovery from mock config/workflow/registry/python snippets.
- `topology_normalizer.py`
  - Maps discovered components into `District / Node / Edge` and city layout coordinates.
- `runtime_trace_resolver.py`
  - Generates runtime traces and spans for 5 required path patterns.
- `topology_binding.py`
  - Binds spans to static edges and emits inferred runtime edges when missing.

Mock sources:

- `mock_topology_source.py`
- `mock_trace_source.py`
- `mock_metrics_source.py`

Orchestrator:

- `platform_service.py` (cache topology, traces, metrics, inferred edges)

---

## Step 4. Backend REST + WebSocket

FastAPI entry: `backend/app/main.py`

REST API:

- `GET /api/topology`
- `GET /api/traces`
- `GET /api/traces/{trace_id}`
- `GET /api/nodes/{node_id}`
- `GET /api/metrics/summary`

WebSocket:

- `GET /ws/live`
- Streams `trace_started -> flow_event* -> trace_completed` continuously
- Simulates request-to-trace runtime execution

---

## Step 5. Frontend Base Layout

Main page `/`:

- Top KPI header
- Left filter panel
- Center 3D city scene
- Right detail drawer
- Bottom live timeline

State management:

- Zustand: `frontend/store/useDashboardStore.ts`

Data access:

- REST hooks: `useBootstrapData`
- WS live feed: `useLiveFlowSocket`

---

## Step 6. City Rendering

3D renderer:

- React Three Fiber + Drei
- `CityScene.tsx` composes:
  - `DistrictGround` (district blocks)
  - `BuildingNode` (module buildings)
  - `EdgeRoad` (static/observed roads)

Visual mapping:

- Building area: `node.size`
- Building height: `node.height`
- Status color:
  - healthy/success: green
  - warning/partial: yellow
  - error: red
  - idle/default: gray

---

## Step 7. Live Flow Overlay

Live flow renderer:

- `LiveFlows.tsx`
- Per-event moving particles + directional line segments

Color mapping:

- LLM: blue
- Retrieval/Reranker/Embedding: green
- Tool/MCP: purple
- Memory: yellow
- Error/Failed: red

Latency mapping:

- Particle speed decreases as `latency_ms` rises

---

## Step 8. Replay Mode

Replay route:

- `/replay/[traceId]`

Replay components:

- `ReplayController.tsx`: play/pause/reset/scrub
- `ReplaySpanList.tsx`: span-by-span replay index
- `ReplayApp.tsx`: darkened replay layout + focused path

Replay behavior:

- City remains visible, active trace path is incrementally highlighted
- Current span details shown in controller and inspector

---

## Step 9. Run and Verify

### 1) Start backend

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

Replay example: `http://localhost:3000/replay/<trace_id>`

---

## Mock Data Behavior

- Initial topology is discovered and normalized at backend startup.
- Initial traces are seeded by `RuntimeTraceResolver`.
- WebSocket continuously emits new synthetic traces/spans.
- `samples/` and `backend/sample_data/` contain sample JSON outputs.

---

## Where Each Layer Lives

### Static Parsing Layer

- `backend/app/services/topology_discovery.py`
- `backend/app/services/topology_normalizer.py`
- `backend/app/sources/mock_topology_source.py`

### Runtime Parsing Layer

- `backend/app/services/runtime_trace_resolver.py`
- `backend/app/services/topology_binding.py`
- `backend/app/generators/live_event_generator.py`
- `backend/app/sources/mock_trace_source.py`

### Visualization Layer

- `frontend/components/city/*`
- `frontend/components/panels/*`
- `frontend/components/replay/*`
- `frontend/store/useDashboardStore.ts`

---

## Future Integration: OpenTelemetry / OpenInference / Jaeger / Langfuse / Phoenix

Extension seam is already reserved:

- `backend/app/services/telemetry_adapters.py` defines adapter interface.
- Replace `MockTraceSource` with real adapters:
  - OTLP collector ingestion
  - Jaeger/Tempo query adapter
  - Langfuse/Phoenix trace adapter
  - Real runtime logs/MCP event stream adapter

Suggested migration path:

1. Implement `TelemetryAdapter` concrete classes.
2. Replace `RuntimeTraceResolver.generate_trace` input with adapter-provided span streams.
3. Keep `TopologyBindingService` unchanged to preserve static+runtime binding semantics.
4. Keep frontend contracts unchanged (`schema.ts`) for low-friction migration.

---

## Notes

- This MVP prioritizes parser architecture and runtime data binding over visual polish.
- The data contracts are intentionally strict to support future production telemetry replacement.
