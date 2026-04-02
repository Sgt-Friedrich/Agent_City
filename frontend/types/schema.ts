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

export interface TargetPreviewRequest {
  repo_path: string;
  target_id?: string;
  label?: string;
}

export interface TargetPreview {
  repo_path: string;
  source_type: string;
  suggested_target_id: string;
  suggested_label: string;
  language_hints: string[];
  framework_hints: string[];
  parser_confidence: number;
  parser_grade: string;
  node_count: number;
  edge_count: number;
  unresolved_count: number;
  warnings: string[];
}

export interface TargetPreviewResponse {
  preview: TargetPreview;
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

export interface NodeDiagnosticItem {
  node_id: string;
  name: string;
  status: string;
  district_id: string;
  qps: number;
  p95_ms: number;
  error_rate: number;
  queue_depth: number;
  active_count: number;
  score: number;
  reason: string;
  recent_trace_ids: string[];
}

export interface EdgeDiagnosticItem {
  edge_id: string;
  from_node: string;
  to_node: string;
  kind: string;
  protocol: string;
  status: string;
  observed_count: number;
  error_count: number;
  retry_count: number;
  fallback_count: number;
  avg_latency_ms: number;
  score: number;
  reason: string;
}

export interface DiagnosticsSummary {
  generated_at: string;
  target: string;
  active_trace_count: number;
  total_nodes: number;
  total_edges: number;
  inferred_edge_count: number;
  retry_event_count: number;
  fallback_event_count: number;
  error_event_count: number;
  slow_nodes: NodeDiagnosticItem[];
  error_nodes: NodeDiagnosticItem[];
  congested_nodes: NodeDiagnosticItem[];
  unstable_edges: EdgeDiagnosticItem[];
  notes: string[];
}

export interface CoveragePoint {
  label: string;
  count: number;
}

export interface ParserAnalysisIssue {
  severity: string;
  category: string;
  title: string;
  detail: string;
  suggestion: string;
}

export interface ParserAnalysisReport {
  generated_at: string;
  target: string;
  parser_confidence: number;
  parser_grade: string;
  source_coverage: Record<string, boolean>;
  unresolved_symbols: string[];
  provisional_node_count: number;
  declared_edge_count: number;
  observed_edge_count: number;
  inferred_edge_count: number;
  role_coverage: CoveragePoint[];
  district_coverage: CoveragePoint[];
  low_confidence_edges: Edge[];
  recent_parse_jobs: ParseJob[];
  issues: ParserAnalysisIssue[];
}

export interface ReportArtifact {
  id: string;
  title: string;
  category: string;
  file_name: string;
  absolute_path: string;
  size_bytes: number;
  updated_at: string;
  related_trace_ids: string[];
  related_node_ids: string[];
  related_job_ids: string[];
}

export interface ReportContentResponse {
  artifact: ReportArtifact;
  content: string;
}

export interface ReportsResponse {
  items: ReportArtifact[];
  docs_root: string;
}

export interface DesktopServiceStatus {
  url: string;
  ready: boolean;
  managed: boolean;
  pid?: number | null;
  message: string;
}

export interface DesktopAppStatus {
  shellMode: "desktop" | "browser";
  backend: DesktopServiceStatus;
  frontend: DesktopServiceStatus;
  lastError?: string | null;
  updatedAt: string;
}

export interface Filters {
  districtIds: string[];
  nodeTypes: NodeType[];
  traceId?: string;
  statuses: string[];
  spanKinds: SpanKind[];
}

export type TimelineGroupBy = "time" | "trace" | "node";

export type RepositoryStatus = "idle" | "parsing" | "ready" | "failed";

export interface RepositoryRecord {
  id: string;
  name: string;
  path: string;
  target_id: string;
  source_type: string;
  languages: string[];
  domain: string;
  parser_confidence: number;
  parser_grade: string;
  unresolved_count: number;
  inferred_edge_count: number;
  node_count: number;
  edge_count: number;
  status: RepositoryStatus;
  last_parsed_at?: string | null;
  metadata: Record<string, unknown>;
}

export interface RepositoriesResponse {
  items: RepositoryRecord[];
  count: number;
}

export type ControlJobType =
  | "parse_repository"
  | "reparse_repository"
  | "parser_regression"
  | "frontend_self_check"
  | "full_system_test"
  | "generate_report"
  | "cleanup_refs"
  | "live_simulation";

export type ControlJobStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface JobPhaseEntry {
  phase: string;
  status: ControlJobStatus;
  timestamp: string;
  message: string;
}

export interface JobRecord {
  id: string;
  type: ControlJobType;
  target?: string | null;
  status: ControlJobStatus;
  progress: number;
  stage: string;
  started_at?: string | null;
  ended_at?: string | null;
  log_summary: string;
  detail_output: string;
  artifact_path?: string | null;
  error_code?: string | null;
  retry_count: number;
  phase_log: JobPhaseEntry[];
  related_report_ids: string[];
  metadata: Record<string, unknown>;
}

export interface JobsResponse {
  items: JobRecord[];
  count: number;
}

export interface JobRunRequest {
  type: ControlJobType;
  target?: string;
  payload?: Record<string, unknown>;
}

export interface JobRunResponse {
  job: JobRecord;
}

export interface AppSettings {
  language: "en" | "zh";
  workspace_dir: string;
  data_dir: string;
  export_dir: string;
  cleanup_threshold_mb: number;
  parser_options: Record<string, unknown>;
  telemetry: Record<string, unknown>;
  logging: Record<string, unknown>;
  integrations: Record<string, unknown>;
}

export interface SettingsResponse {
  settings: AppSettings;
}

export interface AppRuntimeStatus {
  generated_at: string;
  backend_ready: boolean;
  target_count: number;
  repository_count: number;
  active_job_count: number;
  parse_job_count: number;
  last_job_id?: string | null;
  notes: string[];
}

export interface RuntimeStatusResponse {
  runtime: AppRuntimeStatus;
}
