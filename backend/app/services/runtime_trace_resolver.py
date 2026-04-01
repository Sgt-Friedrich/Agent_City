from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.models.schemas import NodeType, SpanEvent, SpanKind, TopologyGraph, TraceEnvelope, TraceRecord, TraceStatus
from app.sources.mock_trace_source import MockTraceSource, TraceScenario


@dataclass(frozen=True)
class SemanticStep:
    from_alias: str
    to_alias: str
    span_kind: SpanKind
    protocol: str
    summary: str
    status: str = "success"
    retry_count: int = 0
    fallback_from_alias: str | None = None


SEMANTIC_SCENARIOS: dict[str, list[SemanticStep]] = {
    "scenario_1": [
        SemanticStep("entry", "planner", SpanKind.AGENT, "internal/http+json", "User input enters planner"),
        SemanticStep("planner", "retriever", SpanKind.RETRIEVER, "internal/http+json", "Planner dispatches retrieval"),
        SemanticStep("retriever", "reranker", SpanKind.RERANKER, "internal/http+json", "Retriever emits candidates"),
        SemanticStep("reranker", "llm", SpanKind.LLM, "internal/http+json", "Ranked context to model"),
        SemanticStep("llm", "final", SpanKind.CHAIN, "internal/http+json", "Final response synthesis"),
    ],
    "scenario_2": [
        SemanticStep("entry", "planner", SpanKind.AGENT, "internal/http+json", "Input reaches planner"),
        SemanticStep("planner", "tool_registry", SpanKind.TOOL, "tool-call", "Planner resolves tool contract"),
        SemanticStep("tool_registry", "tool", SpanKind.TOOL, "shell", "Tool executes external operation"),
        SemanticStep("tool", "llm", SpanKind.LLM, "internal/http+json", "Tool output to model"),
        SemanticStep("llm", "final", SpanKind.CHAIN, "internal/http+json", "Final output emitted"),
    ],
    "scenario_3": [
        SemanticStep("entry", "planner", SpanKind.AGENT, "internal/http+json", "Request enters orchestration"),
        SemanticStep("planner", "memory", SpanKind.MEMORY, "internal/http+json", "Memory retrieval step"),
        SemanticStep("memory", "llm", SpanKind.LLM, "internal/http+json", "Memory context applied"),
        SemanticStep("llm", "guardrail", SpanKind.GUARDRAIL, "internal/http+json", "Guardrail policy check"),
        SemanticStep("guardrail", "final", SpanKind.CHAIN, "internal/http+json", "Approved response returned"),
    ],
    "scenario_4": [
        SemanticStep("entry", "planner", SpanKind.AGENT, "internal/http+json", "Input routed to planner"),
        SemanticStep("planner", "tool", SpanKind.TOOL, "shell", "Initial tool invocation failed", status="error"),
        SemanticStep(
            "planner",
            "tool",
            SpanKind.TOOL,
            "shell",
            "Retry invocation failed again",
            status="error",
            retry_count=1,
        ),
        SemanticStep(
            "planner",
            "fallback",
            SpanKind.CHAIN,
            "internal/http+json",
            "Fallback path activated",
            fallback_from_alias="tool",
        ),
        SemanticStep(
            "fallback",
            "final",
            SpanKind.CHAIN,
            "internal/http+json",
            "Fallback response emitted",
            fallback_from_alias="tool",
        ),
    ],
    "scenario_5": [
        SemanticStep("entry", "planner", SpanKind.AGENT, "internal/http+json", "Request enters planner"),
        SemanticStep("planner", "mcp", SpanKind.MCP, "mcp", "Planner calls MCP route"),
        SemanticStep("mcp", "tool_registry", SpanKind.TOOL, "mcp", "MCP resolves tool backend"),
        SemanticStep("tool_registry", "mcp_adapter", SpanKind.MCP, "mcp", "Tool result adaptation"),
        SemanticStep("mcp_adapter", "llm", SpanKind.LLM, "internal/http+json", "MCP result to model"),
        SemanticStep("llm", "final", SpanKind.CHAIN, "internal/http+json", "Answer generation complete"),
    ],
}


class RuntimeTraceResolver:
    def __init__(self, source: MockTraceSource):
        self._source = source
        self._scenario_map: dict[str, TraceScenario] = {
            scenario.scenario_id: scenario for scenario in self._source.list_scenarios()
        }

        self._topology: TopologyGraph | None = None
        self._target_name: str = "mock"
        self._type_index: dict[NodeType, list[str]] = {}
        self._name_index: dict[str, str] = {}

    def configure(self, topology: TopologyGraph, target_name: str = "mock") -> None:
        self._topology = topology
        self._target_name = target_name
        self._rebuild_indices(topology)

    def generate_trace(self, scenario_id: str | None = None, session_id: str | None = None) -> TraceRecord:
        scenario = self._pick_scenario(scenario_id)
        semantic_steps = SEMANTIC_SCENARIOS[scenario.scenario_id]
        materialized_steps = self._materialize_steps(semantic_steps)

        trace_id = f"trace_{uuid.uuid4().hex[:10]}"
        session = session_id or f"sess_{uuid.uuid4().hex[:8]}"
        request_id = f"req_{uuid.uuid4().hex[:8]}"
        started_at = datetime.now(timezone.utc)

        spans: list[SpanEvent] = []
        cursor = started_at
        parent_span_id: str | None = None

        token_in_total = random.randint(450, 1400)
        token_out_total = random.randint(280, 920)

        for index, step in enumerate(materialized_steps):
            span_id = f"span_{trace_id[-5:]}_{index + 1:02d}"
            latency = random.randint(70, 1200)
            span_timestamp = cursor + timedelta(milliseconds=latency)

            payload_detail = {
                "step_index": index,
                "step_count": len(materialized_steps),
                "scenario": scenario.name,
                "from": step["from_node"],
                "to": step["to_node"],
                "protocol": step["protocol"],
                "target": self._target_name,
                "redaction": {
                    "enabled": True,
                    "strategy": "field-mask-v1",
                    "masked_fields": ["api_key", "auth_token", "user_email"],
                },
            }

            spans.append(
                SpanEvent(
                    trace_id=trace_id,
                    span_id=span_id,
                    parent_span_id=parent_span_id,
                    from_node=step["from_node"],
                    to_node=step["to_node"],
                    span_kind=step["span_kind"],
                    protocol=step["protocol"],
                    summary=step["summary"],
                    payload_preview=f"{step['from_node']} -> {step['to_node']}",
                    payload_detail=payload_detail,
                    direction="outbound",
                    latency_ms=latency,
                    status=step["status"],
                    timestamp=span_timestamp,
                    attributes={
                        "scenario_id": scenario.scenario_id,
                        "scenario_name": scenario.name,
                        "target": self._target_name,
                        "otlp_compatible": True,
                        "openinference_span_kind": step["span_kind"].value,
                    },
                    retry_count=step["retry_count"],
                    fallback_from=step["fallback_from"],
                )
            )

            parent_span_id = span_id
            cursor = span_timestamp

        ended_at = cursor
        duration_ms = int((ended_at - started_at).total_seconds() * 1000)

        trace_status = self._derive_status(spans)
        envelope = TraceEnvelope(
            trace_id=trace_id,
            session_id=session,
            request_id=request_id,
            user_input=scenario.user_input,
            final_output=scenario.final_output,
            status=trace_status,
            token_in=token_in_total,
            token_out=token_out_total,
            estimated_cost=round((token_in_total + token_out_total) / 1000 * 0.0045, 5),
            duration_ms=duration_ms,
            started_at=started_at,
            ended_at=ended_at,
        )
        return TraceRecord(envelope=envelope, spans=spans)

    def generate_batch(self, count: int) -> list[TraceRecord]:
        scenarios = list(self._scenario_map.keys())
        traces: list[TraceRecord] = []
        for idx in range(count):
            scenario_id = scenarios[idx % len(scenarios)]
            traces.append(self.generate_trace(scenario_id=scenario_id))
        return traces

    def _pick_scenario(self, scenario_id: str | None) -> TraceScenario:
        if scenario_id and scenario_id in self._scenario_map:
            return self._scenario_map[scenario_id]
        return random.choice(list(self._scenario_map.values()))

    def _derive_status(self, spans: list[SpanEvent]) -> TraceStatus:
        has_error = any(span.status == "error" for span in spans)
        if has_error and spans[-1].status == "success":
            return TraceStatus.PARTIAL
        if has_error:
            return TraceStatus.ERROR
        return TraceStatus.SUCCESS

    def _rebuild_indices(self, topology: TopologyGraph) -> None:
        self._type_index = {node_type: [] for node_type in NodeType}
        self._name_index = {}

        for node in topology.nodes:
            self._type_index.setdefault(node.type, []).append(node.id)
            self._name_index[node.name.lower()] = node.id
            self._name_index[node.id.lower()] = node.id

    def _materialize_steps(self, semantic_steps: list[SemanticStep]) -> list[dict]:
        materialized: list[dict] = []

        for step in semantic_steps:
            from_node = self._resolve_alias(step.from_alias)
            to_node = self._resolve_alias(step.to_alias, from_node)
            fallback_from = (
                self._resolve_alias(step.fallback_from_alias) if step.fallback_from_alias else None
            )

            materialized.append(
                {
                    "from_node": from_node,
                    "to_node": to_node,
                    "span_kind": step.span_kind,
                    "protocol": step.protocol,
                    "summary": step.summary,
                    "status": step.status,
                    "retry_count": step.retry_count,
                    "fallback_from": fallback_from,
                }
            )

        return materialized

    def _resolve_alias(self, alias: str | None, avoid_node: str | None = None) -> str:
        if self._topology is None or not self._topology.nodes:
            return "node.entry"

        alias = alias or "entry"
        alias = alias.lower()

        alias_candidates: dict[str, list[NodeType]] = {
            "entry": [NodeType.RUNTIME, NodeType.SESSION, NodeType.EVENT_BUS],
            "planner": [NodeType.PLANNER, NodeType.AGENT, NodeType.SUB_AGENT],
            "retriever": [NodeType.RETRIEVER],
            "reranker": [NodeType.RERANKER, NodeType.RETRIEVER],
            "memory": [NodeType.MEMORY],
            "tool_registry": [NodeType.TOOL],
            "tool": [NodeType.TOOL],
            "mcp": [NodeType.MCP],
            "mcp_adapter": [NodeType.RUNTIME, NodeType.MCP],
            "llm": [NodeType.LLM, NodeType.PROMPT],
            "guardrail": [NodeType.GUARDRAIL, NodeType.EVALUATOR],
            "fallback": [NodeType.RUNTIME, NodeType.PLANNER],
            "final": [NodeType.RUNTIME, NodeType.EVENT_BUS],
        }

        keywords: dict[str, list[str]] = {
            "entry": ["chat", "gateway", "cli", "tui", "session", "app-server"],
            "planner": ["plan", "planner", "core", "orchestr", "rollout"],
            "retriever": ["retriev", "search", "context", "file-search"],
            "reranker": ["rerank", "rank"],
            "memory": ["memory", "state", "mem"],
            "tool_registry": ["registry", "tools", "tool"],
            "tool": ["tool", "shell", "exec", "bash", "powershell"],
            "mcp": ["mcp", "rmcp"],
            "mcp_adapter": ["adapter", "result", "bridge", "protocol"],
            "llm": ["llm", "model", "api", "chatgpt", "codex_api"],
            "guardrail": ["guard", "policy", "sandbox", "execpolicy"],
            "fallback": ["fallback", "degrade", "retry"],
            "final": ["final", "render", "response", "output"],
        }

        candidates = []
        for node_type in alias_candidates.get(alias, [NodeType.RUNTIME]):
            candidates.extend(self._type_index.get(node_type, []))

        if not candidates:
            candidates = [node.id for node in self._topology.nodes]

        if alias == "tool_registry":
            registry_candidates = [
                candidate
                for candidate in candidates
                if "registry" in candidate.lower() or candidate.lower().endswith(".tools") or "_tools" in candidate.lower()
            ]
            if registry_candidates:
                candidates = registry_candidates

        if alias == "tool":
            concrete_tool_candidates = [
                candidate
                for candidate in candidates
                if "registry" not in candidate.lower() and not candidate.lower().endswith(".tools")
            ]
            if concrete_tool_candidates:
                candidates = concrete_tool_candidates

        for candidate in candidates:
            if avoid_node and candidate == avoid_node:
                continue
            candidate_lower = candidate.lower()
            if any(keyword in candidate_lower for keyword in keywords.get(alias, [])):
                return candidate

        for node in self._topology.nodes:
            if node.id in candidates and avoid_node and node.id == avoid_node:
                continue
            name = node.name.lower()
            if any(keyword in name for keyword in keywords.get(alias, [])):
                return node.id

        for candidate in candidates:
            if avoid_node and candidate == avoid_node:
                continue
            return candidate

        return self._topology.nodes[0].id
