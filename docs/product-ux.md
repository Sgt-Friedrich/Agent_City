# Agent_City Product UX

## 1. Product UX Goals
1. First screen explains the system without training.
2. Common actions are one-step reachable.
3. Drill-down path stays coherent from global to payload detail.
4. Diagnostic signals are explicit, not hidden in logs.

## 2. Information Architecture
- Top bar: KPI + mode status + target switch
- Left panel: filters/search/legend
- Center canvas: city rendering and live behavior
- Right panel: detail inspector or diagnostics focus
- Bottom panel: timeline and event stream

## 3. Modes and Intent

| Mode | Primary user question | Main visual behavior |
|---|---|---|
| `overview` | What is the structure and current health? | full city, balanced overlays |
| `live` | What is executing right now? | active flows and event emphasis |
| `diagnostics` | Where are slow/error/retry/fallback hotspots? | heat/error emphasis, unstable edges |
| `parser_analysis` | How trustworthy is parsed topology? | confidence/coverage/issues panel |
| `replay` | How did one request execute over time? | city dim + single trace highlight |

## 4. Interaction Model
- Hover node: summary card (status, qps, p95, error)
- Hover flow: from/to, protocol, span kind, latency, status
- Click node: sync with detail drawer and dependency context
- Click trace/span: filter timeline and enter replay
- Search/filter: district, node type, status, span kind, trace

## 5. Visual Semantics

### 5.1 District Layout
- Planning/orchestration is central
- Retrieval and memory are side clusters
- Tool/MCP/external integrations are boundary/industrial zones
- LLM is landmark-like tower cluster
- Safety/guardrail nodes are placed near critical paths

### 5.2 Node Mapping
- Height -> activity/heat
- Footprint -> ownership/scope
- Color -> status
  - healthy: green
  - warning: yellow
  - error: red
  - idle: gray-blue

### 5.3 Flow Mapping
- LLM: blue
- Retrieval: green
- Tool/MCP: purple
- Memory: yellow
- Error/retry/fallback/reject: red

## 6. Diagnostics UX
- Slow nodes: latency-driven scoring
- Error nodes: status + error-rate + runtime errors
- Congestion nodes: queue depth + active count
- Unstable edges: retries/fallback/errors + latency
- Notes section: interpretation hints for current window

## 7. Parser Analysis UX
- Confidence and grade are shown at top
- Source coverage matrix exposes missing evidence sources
- Issues provide category + severity + actionable suggestion
- Low-confidence edges enable direct jump to diagnostics
- Unresolved symbols are explicit, not hidden

## 8. Replay UX
- Global dimming to reduce visual noise
- Current span/node pulse highlight
- Timeline cursor tracks progression
- Span detail is synchronized with right panel
- Speed control and step navigation support demos and debugging

## 9. Frontend Self-Debug Loop
Built-in workflow (`AGENTS.md` + `.agents/skills/frontend-*`):
1. Reproduce issue at desktop/tablet/mobile.
2. Capture screenshots and console/page errors.
3. Classify root cause (layout/state/runtime/3D layer).
4. Apply minimal fix.
5. Run Playwright regression.
6. Produce fix report.

## 10. Accessibility and Readability
- High-contrast dark theme with restrained neon accents
- Motion used for diagnostics, not decoration
- Dense views keep text readable at zoom levels
- Key interactions remain keyboard reachable where practical

## 11. UX Boundaries
Current known limits:
- Parser analysis relies on heuristic + regex-first extraction
- Very dynamic runtime-generated graphs may still need adapter help
- Massive topologies may require clustering/virtualization in future
