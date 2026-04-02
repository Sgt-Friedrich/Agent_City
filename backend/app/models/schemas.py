from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DistrictType(str, Enum):
    PLANNING = "planning"
    RETRIEVAL = "retrieval"
    MEMORY = "memory"
    TOOLS = "tools"
    LLM = "llm"
    SAFETY = "safety"
    RUNTIME = "runtime"
    BOUNDARY = "boundary"


class NodeType(str, Enum):
    AGENT = "agent"
    SUB_AGENT = "sub_agent"
    PLANNER = "planner"
    RETRIEVER = "retriever"
    RERANKER = "reranker"
    EMBEDDING = "embedding"
    MEMORY = "memory"
    TOOL = "tool"
    MCP = "mcp"
    LLM = "llm"
    PROMPT = "prompt"
    GUARDRAIL = "guardrail"
    EVALUATOR = "evaluator"
    RUNTIME = "runtime"
    SESSION = "session"
    EVENT_BUS = "event_bus"
    EXTERNAL = "external"


class EdgeKind(str, Enum):
    DEPENDENCY = "dependency"
    INVOCATION = "invocation"
    DATAFLOW = "dataflow"
    OBSERVED = "observed"
    FALLBACK = "fallback"
    RETRY = "retry"


class TraceStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"


class SpanKind(str, Enum):
    AGENT = "AGENT"
    CHAIN = "CHAIN"
    LLM = "LLM"
    TOOL = "TOOL"
    RETRIEVER = "RETRIEVER"
    RERANKER = "RERANKER"
    EMBEDDING = "EMBEDDING"
    GUARDRAIL = "GUARDRAIL"
    EVALUATOR = "EVALUATOR"
    MEMORY = "MEMORY"
    MCP = "MCP"


class Position(BaseModel):
    x: float
    y: float = 0
    z: float


class Bounds(BaseModel):
    width: float
    depth: float


class SourceProvenance(BaseModel):
    source_type: str
    location: str
    confidence: float = 0.8
    detail: str | None = None


class NodeMetricSnapshot(BaseModel):
    node_id: str
    qps: float
    p95_ms: float
    error_rate: float
    active_count: int
    queue_depth: int
    cpu: float
    memory_mb: float
    token_rate: float
    cost_rate: float


class District(BaseModel):
    id: str
    name: str
    type: DistrictType
    summary: str
    position: Position
    bounds: Bounds
    metadata: dict[str, Any] = Field(default_factory=dict)


class Node(BaseModel):
    id: str
    name: str
    type: NodeType
    district_id: str
    position: Position
    size: float
    height: float
    status: str
    labels: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    metrics: NodeMetricSnapshot | None = None
    source_provenance: list[SourceProvenance] = Field(default_factory=list)


class Edge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    kind: EdgeKind
    protocol: str
    status: str
    confidence: float = 0.8
    inferred_from: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TopologyGraph(BaseModel):
    generated_at: datetime
    districts: list[District]
    nodes: list[Node]
    edges: list[Edge]
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceEnvelope(BaseModel):
    trace_id: str
    session_id: str
    request_id: str
    user_input: str
    final_output: str
    status: TraceStatus
    token_in: int
    token_out: int
    estimated_cost: float
    duration_ms: int
    started_at: datetime
    ended_at: datetime


class SpanEvent(BaseModel):
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    from_node: str
    to_node: str | None = None
    span_kind: SpanKind
    protocol: str
    summary: str
    payload_preview: str
    payload_detail: dict[str, Any] = Field(default_factory=dict)
    direction: str
    latency_ms: int
    status: str
    timestamp: datetime
    attributes: dict[str, Any] = Field(default_factory=dict)
    retry_count: int = 0
    fallback_from: str | None = None


class FlowEvent(SpanEvent):
    pass


class TraceRecord(BaseModel):
    envelope: TraceEnvelope
    spans: list[SpanEvent]


class BoundSpan(BaseModel):
    span_id: str
    binding_type: str
    edge_id: str | None = None


class BoundTrace(BaseModel):
    trace: TraceRecord
    bindings: list[BoundSpan]
    inferred_edges: list[Edge] = Field(default_factory=list)


class MetricSummary(BaseModel):
    total_traces: int
    active_flows: int
    avg_latency_ms: float
    error_rate: float
    token_usage: int
    estimated_cost: float


class RawComponent(BaseModel):
    id: str
    name: str
    role: str
    summary: str
    source_type: str
    source_location: str
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RawRelation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str
    protocol: str
    confidence: float = 0.7
    inferred_from: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DiscoveryResult(BaseModel):
    components: list[RawComponent]
    relations: list[RawRelation]
    parser_confidence: float | None = None
    parser_grade: str | None = None
    unresolved_symbols: list[str] = Field(default_factory=list)
    source_coverage: dict[str, bool] = Field(default_factory=dict)


class LiveMessage(BaseModel):
    message_type: str
    trace_id: str
    payload: dict[str, Any]


class AdapterCapabilities(BaseModel):
    name: str
    supports_streaming: bool
    supports_payload_detail: bool
    supports_metrics: bool


class TraceIngestAdapter(BaseModel):
    adapter_name: str
    config: dict[str, Any] = Field(default_factory=dict)


class TargetDescriptor(BaseModel):
    id: str
    label: str
    source_type: str
    repo_path: str
    node_count: int
    edge_count: int


class RegisterTargetRequest(BaseModel):
    repo_path: str
    target_id: str | None = None
    label: str | None = None
    force: bool = False


class PreviewTargetRequest(BaseModel):
    repo_path: str
    target_id: str | None = None
    label: str | None = None


class PreviewTargetResponse(BaseModel):
    repo_path: str
    source_type: str
    suggested_target_id: str
    suggested_label: str
    language_hints: list[str] = Field(default_factory=list)
    framework_hints: list[str] = Field(default_factory=list)
    parser_confidence: float
    parser_grade: str
    node_count: int
    edge_count: int
    unresolved_count: int
    warnings: list[str] = Field(default_factory=list)


class ParseJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ParseJob(BaseModel):
    id: str
    source: str
    repo_path: str
    repo_name: str
    target_id: str | None = None
    status: ParseJobStatus
    progress: int = Field(default=0, ge=0, le=100)
    step: str
    message: str | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None


class NodeDiagnosticItem(BaseModel):
    node_id: str
    name: str
    status: str
    district_id: str
    qps: float
    p95_ms: float
    error_rate: float
    queue_depth: int
    active_count: int
    score: float
    reason: str
    recent_trace_ids: list[str] = Field(default_factory=list)


class EdgeDiagnosticItem(BaseModel):
    edge_id: str
    from_node: str
    to_node: str
    kind: str
    protocol: str
    status: str
    observed_count: int
    error_count: int
    retry_count: int
    fallback_count: int
    avg_latency_ms: float
    score: float
    reason: str


class DiagnosticsSummary(BaseModel):
    generated_at: datetime
    target: str
    active_trace_count: int
    total_nodes: int
    total_edges: int
    inferred_edge_count: int
    retry_event_count: int
    fallback_event_count: int
    error_event_count: int
    slow_nodes: list[NodeDiagnosticItem] = Field(default_factory=list)
    error_nodes: list[NodeDiagnosticItem] = Field(default_factory=list)
    congested_nodes: list[NodeDiagnosticItem] = Field(default_factory=list)
    unstable_edges: list[EdgeDiagnosticItem] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class CoveragePoint(BaseModel):
    label: str
    count: int


class ParserAnalysisIssue(BaseModel):
    severity: str
    category: str
    title: str
    detail: str
    suggestion: str


class ParserAnalysisReport(BaseModel):
    generated_at: datetime
    target: str
    parser_confidence: float
    parser_grade: str
    source_coverage: dict[str, bool] = Field(default_factory=dict)
    unresolved_symbols: list[str] = Field(default_factory=list)
    provisional_node_count: int
    declared_edge_count: int
    observed_edge_count: int
    inferred_edge_count: int
    role_coverage: list[CoveragePoint] = Field(default_factory=list)
    district_coverage: list[CoveragePoint] = Field(default_factory=list)
    low_confidence_edges: list[Edge] = Field(default_factory=list)
    recent_parse_jobs: list[ParseJob] = Field(default_factory=list)
    issues: list[ParserAnalysisIssue] = Field(default_factory=list)


class AnalysisReportExport(BaseModel):
    target: str
    generated_at: datetime
    markdown: str


class ReportArtifact(BaseModel):
    id: str
    title: str
    category: str
    file_name: str
    absolute_path: str
    size_bytes: int
    updated_at: datetime
    related_trace_ids: list[str] = Field(default_factory=list)
    related_node_ids: list[str] = Field(default_factory=list)
    related_job_ids: list[str] = Field(default_factory=list)


class ReportContent(BaseModel):
    artifact: ReportArtifact
    content: str


class RepositoryStatus(str, Enum):
    IDLE = "idle"
    PARSING = "parsing"
    READY = "ready"
    FAILED = "failed"


class RepositoryRecord(BaseModel):
    id: str
    name: str
    path: str
    target_id: str
    source_type: str
    languages: list[str] = Field(default_factory=list)
    domain: str
    parser_confidence: float
    parser_grade: str
    unresolved_count: int
    inferred_edge_count: int
    node_count: int
    edge_count: int
    status: RepositoryStatus
    last_parsed_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class JobType(str, Enum):
    PARSE_REPOSITORY = "parse_repository"
    REPARSE_REPOSITORY = "reparse_repository"
    PARSER_REGRESSION = "parser_regression"
    FRONTEND_SELF_CHECK = "frontend_self_check"
    FULL_SYSTEM_TEST = "full_system_test"
    GENERATE_REPORT = "generate_report"
    CLEANUP_REFS = "cleanup_refs"
    LIVE_SIMULATION = "live_simulation"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPhaseEntry(BaseModel):
    phase: str
    status: JobStatus
    timestamp: datetime
    message: str = ""


class JobRecord(BaseModel):
    id: str
    type: JobType
    target: str | None = None
    status: JobStatus
    progress: int = Field(default=0, ge=0, le=100)
    stage: str = "queued"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    log_summary: str = ""
    detail_output: str = ""
    artifact_path: str | None = None
    error_code: str | None = None
    retry_count: int = 0
    phase_log: list[JobPhaseEntry] = Field(default_factory=list)
    related_report_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class JobRunRequest(BaseModel):
    type: JobType
    target: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class AppLanguage(str, Enum):
    EN = "en"
    ZH = "zh"


class AppSettings(BaseModel):
    language: AppLanguage = AppLanguage.EN
    workspace_dir: str = ""
    data_dir: str = ""
    export_dir: str = ""
    cleanup_threshold_mb: float = 200.0
    parser_options: dict[str, Any] = Field(default_factory=lambda: {"strict_mode": False})
    telemetry: dict[str, Any] = Field(default_factory=lambda: {"enabled": False, "level": "basic"})
    logging: dict[str, Any] = Field(default_factory=lambda: {"level": "info"})
    integrations: dict[str, Any] = Field(default_factory=dict)


class UpdateSettingsRequest(BaseModel):
    language: AppLanguage | None = None
    workspace_dir: str | None = None
    data_dir: str | None = None
    export_dir: str | None = None
    cleanup_threshold_mb: float | None = None
    parser_options: dict[str, Any] | None = None
    telemetry: dict[str, Any] | None = None
    logging: dict[str, Any] | None = None
    integrations: dict[str, Any] | None = None


class AppRuntimeStatus(BaseModel):
    generated_at: datetime
    backend_ready: bool
    target_count: int
    repository_count: int
    active_job_count: int
    parse_job_count: int
    last_job_id: str | None = None
    notes: list[str] = Field(default_factory=list)
