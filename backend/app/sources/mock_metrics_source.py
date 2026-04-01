from __future__ import annotations

import random
from typing import Iterable

from app.models.schemas import MetricSummary, Node, NodeMetricSnapshot, TraceRecord, TraceStatus


class MockMetricsSource:
    def snapshot_for_nodes(self, nodes: Iterable[Node]) -> dict[str, NodeMetricSnapshot]:
        snapshots: dict[str, NodeMetricSnapshot] = {}
        for node in nodes:
            base_qps = random.uniform(0.3, 8.0)
            error_rate = random.uniform(0.0, 0.08)
            snapshots[node.id] = NodeMetricSnapshot(
                node_id=node.id,
                qps=round(base_qps, 2),
                p95_ms=round(random.uniform(50, 1600), 2),
                error_rate=round(error_rate, 4),
                active_count=random.randint(0, 18),
                queue_depth=random.randint(0, 25),
                cpu=round(random.uniform(12, 86), 2),
                memory_mb=round(random.uniform(128, 4096), 2),
                token_rate=round(random.uniform(10, 1600), 2),
                cost_rate=round(random.uniform(0.001, 0.25), 4),
            )
        return snapshots

    def summary(self, traces: Iterable[TraceRecord], active_flow_count: int) -> MetricSummary:
        trace_list = list(traces)
        if not trace_list:
            return MetricSummary(
                total_traces=0,
                active_flows=0,
                avg_latency_ms=0,
                error_rate=0,
                token_usage=0,
                estimated_cost=0,
            )

        total = len(trace_list)
        avg_latency = sum(t.envelope.duration_ms for t in trace_list) / total
        error_count = sum(1 for t in trace_list if t.envelope.status == TraceStatus.ERROR)
        token_usage = sum(t.envelope.token_in + t.envelope.token_out for t in trace_list)
        estimated_cost = sum(t.envelope.estimated_cost for t in trace_list)
        return MetricSummary(
            total_traces=total,
            active_flows=active_flow_count,
            avg_latency_ms=round(avg_latency, 2),
            error_rate=round(error_count / total, 4),
            token_usage=token_usage,
            estimated_cost=round(estimated_cost, 4),
        )
