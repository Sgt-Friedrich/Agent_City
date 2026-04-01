from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.models.schemas import SpanEvent, SpanKind, TraceEnvelope, TraceRecord, TraceStatus
from app.sources.mock_trace_source import MockTraceSource, TraceScenario


@dataclass(frozen=True)
class StepTemplate:
    from_node: str
    to_node: str
    span_kind: SpanKind
    protocol: str
    summary: str
    status: str = "success"
    retry_count: int = 0
    fallback_from: str | None = None


SCENARIO_PATHS: dict[str, list[StepTemplate]] = {
    "scenario_1": [
        StepTemplate("node.chat_gateway", "node.planner_core", SpanKind.AGENT, "internal/http+json", "User input enters planner"),
        StepTemplate("node.planner_core", "node.retriever_hybrid", SpanKind.RETRIEVER, "internal/http+json", "Planner dispatches retrieval"),
        StepTemplate("node.retriever_hybrid", "node.reranker_cross", SpanKind.RERANKER, "internal/http+json", "Retriever emits candidate passages"),
        StepTemplate("node.reranker_cross", "node.llm_router", SpanKind.LLM, "internal/http+json", "Reranked context goes to model"),
        StepTemplate("node.llm_router", "node.final_renderer", SpanKind.CHAIN, "internal/http+json", "Final response synthesized"),
    ],
    "scenario_2": [
        StepTemplate("node.chat_gateway", "node.planner_core", SpanKind.AGENT, "internal/http+json", "Input to planning stage"),
        StepTemplate("node.planner_core", "node.tool_registry", SpanKind.TOOL, "tool-call", "Planner resolves a tool"),
        StepTemplate("node.tool_registry", "node.shell_tool", SpanKind.TOOL, "shell", "Shell tool executes command"),
        StepTemplate("node.shell_tool", "node.llm_router", SpanKind.LLM, "internal/http+json", "Tool result fed into model"),
        StepTemplate("node.llm_router", "node.final_renderer", SpanKind.CHAIN, "internal/http+json", "Final output streamed"),
    ],
    "scenario_3": [
        StepTemplate("node.chat_gateway", "node.planner_core", SpanKind.AGENT, "internal/http+json", "Request enters orchestrator"),
        StepTemplate("node.planner_core", "node.memory_short", SpanKind.MEMORY, "internal/http+json", "Load short-term memory"),
        StepTemplate("node.memory_short", "node.llm_router", SpanKind.LLM, "internal/http+json", "Memory context injected"),
        StepTemplate("node.llm_router", "node.guardrail_policy", SpanKind.GUARDRAIL, "internal/http+json", "Run policy validation"),
        StepTemplate("node.guardrail_policy", "node.final_renderer", SpanKind.CHAIN, "internal/http+json", "Approved response returned"),
    ],
    "scenario_4": [
        StepTemplate("node.chat_gateway", "node.planner_core", SpanKind.AGENT, "internal/http+json", "Input reaches planner"),
        StepTemplate("node.planner_core", "node.shell_tool", SpanKind.TOOL, "shell", "Initial tool invocation fails", status="error"),
        StepTemplate(
            "node.planner_core",
            "node.shell_tool",
            SpanKind.TOOL,
            "shell",
            "Retry invocation still unstable",
            status="error",
            retry_count=1,
        ),
        StepTemplate(
            "node.planner_core",
            "node.fallback_router",
            SpanKind.CHAIN,
            "internal/http+json",
            "Fallback route activated",
            status="success",
            fallback_from="node.shell_tool",
        ),
        StepTemplate(
            "node.fallback_router",
            "node.final_renderer",
            SpanKind.CHAIN,
            "internal/http+json",
            "Fallback response returned",
            status="success",
            fallback_from="node.shell_tool",
        ),
    ],
    "scenario_5": [
        StepTemplate("node.chat_gateway", "node.planner_core", SpanKind.AGENT, "internal/http+json", "Input routed to planner"),
        StepTemplate("node.planner_core", "node.mcp_gateway", SpanKind.MCP, "mcp", "Planner requests MCP execution"),
        StepTemplate("node.mcp_gateway", "node.tool_registry", SpanKind.TOOL, "mcp", "MCP resolves tool backend"),
        StepTemplate("node.tool_registry", "node.mcp_result_adapter", SpanKind.MCP, "mcp", "Tool result normalized"),
        StepTemplate("node.mcp_result_adapter", "node.llm_router", SpanKind.LLM, "internal/http+json", "Adapted result to LLM"),
        StepTemplate("node.llm_router", "node.final_renderer", SpanKind.CHAIN, "internal/http+json", "Final answer emitted"),
    ],
}


class RuntimeTraceResolver:
    def __init__(self, source: MockTraceSource):
        self._source = source
        self._scenario_map: dict[str, TraceScenario] = {
            scenario.scenario_id: scenario for scenario in self._source.list_scenarios()
        }

    def generate_trace(self, scenario_id: str | None = None, session_id: str | None = None) -> TraceRecord:
        scenario = self._pick_scenario(scenario_id)
        steps = SCENARIO_PATHS[scenario.scenario_id]

        trace_id = f"trace_{uuid.uuid4().hex[:10]}"
        session = session_id or f"sess_{uuid.uuid4().hex[:8]}"
        request_id = f"req_{uuid.uuid4().hex[:8]}"
        started_at = datetime.now(timezone.utc)

        spans: list[SpanEvent] = []
        cursor = started_at
        parent_span_id: str | None = None

        token_in_total = random.randint(450, 1400)
        token_out_total = random.randint(280, 920)

        for index, step in enumerate(steps):
            span_id = f"span_{trace_id[-5:]}_{index + 1:02d}"
            latency = random.randint(70, 1200)
            span_timestamp = cursor + timedelta(milliseconds=latency)

            payload_detail = {
                "step_index": index,
                "step_count": len(steps),
                "scenario": scenario.name,
                "from": step.from_node,
                "to": step.to_node,
                "protocol": step.protocol,
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
                    from_node=step.from_node,
                    to_node=step.to_node,
                    span_kind=step.span_kind,
                    protocol=step.protocol,
                    summary=step.summary,
                    payload_preview=f"{step.from_node} -> {step.to_node}",
                    payload_detail=payload_detail,
                    direction="outbound",
                    latency_ms=latency,
                    status=step.status,
                    timestamp=span_timestamp,
                    attributes={
                        "scenario_id": scenario.scenario_id,
                        "scenario_name": scenario.name,
                        "otlp_compatible": True,
                        "openinference_span_kind": step.span_kind.value,
                    },
                    retry_count=step.retry_count,
                    fallback_from=step.fallback_from,
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
