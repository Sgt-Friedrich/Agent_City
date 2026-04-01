from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import BoundSpan, BoundTrace, Edge, EdgeKind, SpanEvent, TopologyGraph, TraceRecord


class TopologyBindingService:
    """Binds runtime spans to static topology and emits inferred edges."""

    def bind_trace(self, topology: TopologyGraph, trace: TraceRecord) -> BoundTrace:
        declared_edges = {
            (edge.from_node, edge.to_node): edge for edge in topology.edges
        }

        bindings: list[BoundSpan] = []
        inferred_by_key: dict[tuple[str, str], Edge] = {}

        for span in trace.spans:
            binding_type, edge_id, inferred_edge = self._bind_span(span, declared_edges)
            if inferred_edge is not None:
                inferred_by_key[(inferred_edge.from_node, inferred_edge.to_node)] = inferred_edge
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
        declared_edges: dict[tuple[str, str], Edge],
    ) -> tuple[str, str | None, Edge | None]:
        if span.to_node is None:
            return ("node_internal", None, None)

        key = (span.from_node, span.to_node)
        declared = declared_edges.get(key)

        if declared is not None:
            if span.retry_count > 0:
                return ("retry_loop", declared.id, None)
            if span.fallback_from:
                return ("fallback_edge", declared.id, None)
            return ("observed_edge", declared.id, None)

        inferred_kind = EdgeKind.OBSERVED
        binding_type = "inferred_edge"

        if span.retry_count > 0:
            inferred_kind = EdgeKind.RETRY
            binding_type = "retry_loop"
        elif span.fallback_from:
            inferred_kind = EdgeKind.FALLBACK
            binding_type = "fallback_edge"

        inferred_edge = Edge(
            id=f"edge.inferred.{span.from_node}.{span.to_node}".replace("node.", ""),
            **{"from": span.from_node, "to": span.to_node},
            kind=inferred_kind,
            protocol=span.protocol,
            status="observed",
            confidence=0.66,
            inferred_from=[span.trace_id, span.span_id],
            metrics={"last_latency_ms": float(span.latency_ms)},
            metadata={
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "status": span.status,
                "span_kind": span.span_kind.value,
            },
        )

        return (binding_type, inferred_edge.id, inferred_edge)
