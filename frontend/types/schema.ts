export type DistrictType =
  | "planning"
  | "retrieval"
  | "memory"
  | "tools"
  | "llm"
  | "safety"
  | "runtime"
  | "boundary";

export type NodeType =
  | "agent"
  | "sub_agent"
  | "planner"
  | "retriever"
  | "reranker"
  | "embedding"
  | "memory"
  | "tool"
  | "mcp"
  | "llm"
  | "prompt"
  | "guardrail"
  | "evaluator"
  | "runtime"
  | "session"
  | "event_bus"
  | "external";

export type EdgeKind =
  | "dependency"
  | "invocation"
  | "dataflow"
  | "observed"
  | "fallback"
  | "retry";

export type TraceStatus = "running" | "success" | "error" | "partial";

export type SpanKind =
  | "AGENT"
  | "CHAIN"
  | "LLM"
  | "TOOL"
  | "RETRIEVER"
  | "RERANKER"
  | "EMBEDDING"
  | "GUARDRAIL"
  | "EVALUATOR"
  | "MEMORY"
  | "MCP";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  width: number;
  depth: number;
}

export interface SourceProvenance {
  source_type: string;
  location: string;
  confidence: number;
  detail?: string;
}

export interface NodeMetricSnapshot {
  node_id: string;
  qps: number;
  p95_ms: number;
  error_rate: number;
  active_count: number;
  queue_depth: number;
  cpu: number;
  memory_mb: number;
  token_rate: number;
  cost_rate: number;
}

export interface District {
  id: string;
  name: string;
  type: DistrictType;
  summary: string;
  position: Position;
  bounds: Bounds;
  metadata: Record<string, unknown>;
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  district_id: string;
  position: Position;
  size: number;
  height: number;
  status: string;
  labels: string[];
  metadata: Record<string, unknown>;
  metrics?: NodeMetricSnapshot;
  source_provenance: SourceProvenance[];
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  protocol: string;
  status: string;
  confidence: number;
  inferred_from: string[];
  metrics: Record<string, number>;
  metadata: Record<string, unknown>;
}

export interface TopologyGraph {
  generated_at: string;
  districts: District[];
  nodes: Node[];
  edges: Edge[];
  target?: string;
}

export interface TraceEnvelope {
  trace_id: string;
  session_id: string;
  request_id: string;
  user_input: string;
  final_output: string;
  status: TraceStatus;
  token_in: number;
  token_out: number;
  estimated_cost: number;
  duration_ms: number;
  started_at: string;
  ended_at: string;
}

export interface FlowEvent {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  from_node: string;
  to_node?: string | null;
  span_kind: SpanKind;
  protocol: string;
  summary: string;
  payload_preview: string;
  payload_detail: Record<string, unknown>;
  direction: string;
  latency_ms: number;
  status: string;
  timestamp: string;
  attributes: Record<string, unknown>;
  retry_count: number;
  fallback_from?: string | null;
}

export interface TraceRecord {
  envelope: TraceEnvelope;
  spans: FlowEvent[];
}

export interface BoundSpan {
  span_id: string;
  binding_type: string;
  edge_id?: string | null;
}

export interface BoundTraceResponse {
  trace: TraceRecord;
  bindings: BoundSpan[];
  inferred_edges: Edge[];
}

export interface MetricsSummary {
  total_traces: number;
  active_flows: number;
  avg_latency_ms: number;
  error_rate: number;
  token_usage: number;
  estimated_cost: number;
}

export interface TracesResponse {
  items: TraceRecord[];
  count: number;
  target?: string;
}

export interface LiveMessage {
  type: "trace_started" | "flow_event" | "trace_completed" | "heartbeat" | "error";
  trace?: TraceEnvelope;
  trace_id?: string;
  span?: FlowEvent;
  binding?: BoundSpan;
  inferred_edges?: Edge[];
  message?: string;
  active_trace_id?: string;
  target?: string;
}

export interface TargetOption {
  id: string;
  label: string;
  source_type?: string;
  repo_path?: string;
  node_count?: number;
  edge_count?: number;
}

export interface TargetsResponse {
  items: TargetOption[];
}

export interface RegisterTargetRequest {
  repo_path: string;
  target_id?: string;
  label?: string;
  force?: boolean;
}

export interface RegisterTargetResponse {
  target: TargetOption;
}

export type ParseJobStatus = "queued" | "running" | "completed" | "failed";

export interface ParseJob {
  id: string;
  source: string;
  repo_path: string;
  repo_name: string;
  target_id?: string | null;
  status: ParseJobStatus;
  progress: number;
  step: string;
  message?: string | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface ParseJobsResponse {
  items: ParseJob[];
  drop_directory: string;
}

export interface Filters {
  districtIds: string[];
  nodeTypes: NodeType[];
  traceId?: string;
  statuses: string[];
  spanKinds: SpanKind[];
}
