from __future__ import annotations

from collections import deque
from datetime import datetime, timedelta, timezone

from app.models.schemas import BoundTrace, Edge, MetricSummary, Node, SpanEvent, TopologyGraph, TraceRecord
from app.services.runtime_trace_resolver import RuntimeTraceResolver
from app.services.topology_binding import TopologyBindingService
from app.services.topology_discovery import TopologyDiscovery
from app.services.topology_normalizer import TopologyNormalizer
from app.sources.mock_metrics_source import MockMetricsSource
from app.sources.mock_topology_source import MockTopologySource
from app.sources.mock_trace_source import MockTraceSource


class PlatformService:
    """Application service coordinating static and runtime architecture views."""

    def __init__(self) -> None:
        self._topology_source = MockTopologySource()
        self._trace_source = MockTraceSource()
        self._metrics_source = MockMetricsSource()

        self._discovery = TopologyDiscovery(self._topology_source)
        self._normalizer = TopologyNormalizer()
        self._runtime_resolver = RuntimeTraceResolver(self._trace_source)
        self._binding = TopologyBindingService()

        self._base_topology = self._normalizer.normalize(self._discovery.discover())
        self._observed_edges: dict[str, Edge] = {}

        self._trace_records: dict[str, TraceRecord] = {}
        self._bound_traces: dict[str, BoundTrace] = {}
        self._trace_order: list[str] = []
        self._recent_flow_events: deque[SpanEvent] = deque(maxlen=600)

        self._refresh_node_metrics()
        self._seed_initial_traces(10)

    def get_topology(self) -> TopologyGraph:
        topology = self._base_topology.model_copy(deep=True)
        topology.edges.extend(self._observed_edges.values())
        return topology

    def list_traces(self, limit: int = 50) -> list[TraceRecord]:
        selected_ids = self._trace_order[-limit:]
        return [self._trace_records[trace_id] for trace_id in reversed(selected_ids)]

    def get_bound_trace(self, trace_id: str) -> BoundTrace | None:
        return self._bound_traces.get(trace_id)

    def get_trace(self, trace_id: str) -> TraceRecord | None:
        return self._trace_records.get(trace_id)

    def get_node(self, node_id: str) -> Node | None:
        topology = self.get_topology()
        for node in topology.nodes:
            if node.id == node_id:
                return node
        return None

    def get_metrics_summary(self) -> MetricSummary:
        now = datetime.now(timezone.utc)
        active_flow_count = sum(
            1
            for event in self._recent_flow_events
            if now - event.timestamp <= timedelta(seconds=18)
        )
        traces = list(self._trace_records.values())
        return self._metrics_source.summary(traces=traces, active_flow_count=active_flow_count)

    def generate_live_trace(self, scenario_id: str | None = None) -> BoundTrace:
        trace = self._runtime_resolver.generate_trace(scenario_id=scenario_id)
        bound = self._binding.bind_trace(self.get_topology(), trace)
        self._register_bound_trace(bound)
        self._refresh_node_metrics()
        return bound

    def _seed_initial_traces(self, count: int) -> None:
        for trace in self._runtime_resolver.generate_batch(count):
            bound = self._binding.bind_trace(self.get_topology(), trace)
            self._register_bound_trace(bound)

    def _register_bound_trace(self, bound: BoundTrace) -> None:
        trace_id = bound.trace.envelope.trace_id
        if trace_id not in self._trace_records:
            self._trace_order.append(trace_id)

        self._trace_records[trace_id] = bound.trace
        self._bound_traces[trace_id] = bound

        for inferred in bound.inferred_edges:
            self._observed_edges[inferred.id] = inferred

        for span in bound.trace.spans:
            self._recent_flow_events.append(span)

    def _refresh_node_metrics(self) -> None:
        snapshots = self._metrics_source.snapshot_for_nodes(self._base_topology.nodes)
        for node in self._base_topology.nodes:
            node.metrics = snapshots.get(node.id)
