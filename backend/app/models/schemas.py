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
