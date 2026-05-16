from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import BoundSpan, BoundTrace, Edge, EdgeKind, SpanEvent, SpanKind, TopologyGraph, TraceRecord


class TopologyBindingService:
    """Binds runtime spans to static topology and emits inferred edges."""

    def bind_trace(self, topology: TopologyGraph, trace: TraceRecord) -> BoundTrace:
        declared_by_pair: dict[tuple[str, str], list[Edge]] = {}
        declared_by_kind: dict[tuple[str, str, EdgeKind], Edge] = {}

        for edge in topology.edges:
            declared_by_pair.setdefault((edge.from_node, edge.to_node), []).append(edge)
            declared_by_kind[(edge.from_node, edge.to_node, edge.kind)] = edge

        node_alias_map = self._build_node_alias_map(topology)

        bindings: list[BoundSpan] = []
        inferred_by_key: dict[tuple[str, str, str, str], Edge] = {}

        for span in trace.spans:
            normalized = self._normalize_span_nodes(span, node_alias_map)
            binding_type, edge_id, inferred_edge = self._bind_span(
                span=span,
                from_node=normalized["from_node"],
                to_node=normalized["to_node"],
                fallback_from=normalized["fallback_from"],
                declared_by_pair=declared_by_pair,
                declared_by_kind=declared_by_kind,
            )
            if inferred_edge is not None:
                key = (
                    inferred_edge.from_node,
                    inferred_edge.to_node,
                    inferred_edge.kind.value,
                    inferred_edge.protocol,
                )
                inferred_by_key[key] = inferred_edge
            bindings.append(
                BoundSpan(
                    span_id=span.span_id,
                    binding_type=binding_type,
                    edge_id=edge_id,
                )
            )

        inferred_edges = list(inferred_by_key.values())
        return BoundTrace(trace=trace, bindings=bindings, inferred_edges=inferred_edges)

    def bind_batch(self, topology: TopologyGraph, traces: list[TraceRecord]) -> list[BoundTrace]:
        return [self.bind_trace(topology, trace) for trace in traces]

    def _bind_span(
        self,
        span: SpanEvent,
        from_node: str,
        to_node: str | None,
        fallback_from: str | None,
        declared_by_pair: dict[tuple[str, str], list[Edge]],
        declared_by_kind: dict[tuple[str, str, EdgeKind], Edge],
    ) -> tuple[str, str | None, Edge | None]:
        if to_node is None:
            return ("node_internal", None, None)

        inferred_kind = self._edge_kind_from_span(span)
        kind_declared = declared_by_kind.get((from_node, to_node, inferred_kind))
        pair_declared = declared_by_pair.get((from_node, to_node), [])

        declared = kind_declared or (pair_declared[0] if pair_declared else None)

        if declared is not None:
            if span.retry_count > 0:
                return ("retry_loop", declared.id, None)
            if fallback_from:
                return ("fallback_edge", declared.id, None)
            return ("observed_edge", declared.id, None)

        binding_type = "inferred_edge"
        if span.retry_count > 0:
            binding_type = "retry_loop"
        elif fallback_from:
            binding_type = "fallback_edge"

        inferred_edge = Edge(
            id=f"edge.inferred.{from_node}.{to_node}.{inferred_kind.value}".replace("node.", ""),
            **{"from": from_node, "to": to_node},
            kind=inferred_kind,
            protocol=span.protocol,
            status="observed",
            confidence=0.61,
            inferred_from=[span.trace_id, span.span_id],
            metrics={"last_latency_ms": float(span.latency_ms)},
            metadata={
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "status": span.status,
                "span_kind": span.span_kind.value,
                "fallback_from": fallback_from,
                "observations": 1,
                "error_count": 1 if span.status == "error" else 0,
                "retry_count": 1 if span.retry_count > 0 else 0,
                "fallback_count": 1 if bool(span.fallback_from) else 0,
                "promotable": False,
                "promotable_reason": "needs stable multi-trace observations",
            },
        )

        return (binding_type, inferred_edge.id, inferred_edge)

    def _edge_kind_from_span(self, span: SpanEvent) -> EdgeKind:
        if span.retry_count > 0:
            return EdgeKind.RETRY
        if span.fallback_from:
            return EdgeKind.FALLBACK

        if span.span_kind in {
            SpanKind.RETRIEVER,
            SpanKind.RERANKER,
            SpanKind.EMBEDDING,
            SpanKind.MEMORY,
            SpanKind.LLM,
            SpanKind.EVALUATOR,
            SpanKind.GUARDRAIL,
        }:
            return EdgeKind.DATAFLOW

        if span.protocol in {"tool-call", "mcp", "shell", "fs"}:
            return EdgeKind.INVOCATION

        return EdgeKind.OBSERVED

    def _build_node_alias_map(self, topology: TopologyGraph) -> dict[str, str]:
        alias_map: dict[str, str] = {}

        for node in topology.nodes:
            aliases = {
                node.id.lower(),
                node.name.lower(),
                node.id.lower().replace("node.", ""),
                node.name.lower().replace(" ", "_"),
                node.name.lower().replace(" ", "-"),
                node.type.value.lower(),
            }
            aliases.update(label.lower() for label in node.labels)

            role_hint = str(node.metadata.get("role", "")).lower()
            if role_hint:
                aliases.add(role_hint)

            for alias in aliases:
                alias_map.setdefault(alias, node.id)

        return alias_map

    def _normalize_span_nodes(self, span: SpanEvent, alias_map: dict[str, str]) -> dict[str, str | None]:
        from_node = self._resolve_node_id(span.from_node, alias_map)
        to_node = self._resolve_node_id(span.to_node, alias_map) if span.to_node else None
        fallback_from = self._resolve_node_id(span.fallback_from, alias_map) if span.fallback_from else None

        return {
            "from_node": from_node,
            "to_node": to_node,
            "fallback_from": fallback_from,
        }

    def _resolve_node_id(self, value: str | None, alias_map: dict[str, str]) -> str:
        if not value:
            return "node.entry"
        lowered = value.lower()
        return alias_map.get(lowered, alias_map.get(lowered.replace("node.", ""), value))
