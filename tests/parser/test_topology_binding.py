from __future__ import annotations

from datetime import datetime, timezone
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import (  # noqa: E402
    Bounds,
    District,
    DistrictType,
    Edge,
    EdgeKind,
    Node,
    NodeType,
    Position,
    SpanEvent,
    SpanKind,
    TopologyGraph,
    TraceEnvelope,
    TraceRecord,
    TraceStatus,
)
from app.services.topology_binding import TopologyBindingService  # noqa: E402


class TopologyBindingServiceTest(unittest.TestCase):
    def _topology(self) -> TopologyGraph:
        district = District(
            id="district.planning",
            name="Planning",
            type=DistrictType.PLANNING,
            summary="planning",
            position=Position(x=0, z=0),
            bounds=Bounds(width=40, depth=40),
            metadata={},
        )
        planner = Node(
            id="node.planner_core",
            name="Planner Core",
            type=NodeType.PLANNER,
            district_id="district.planning",
            position=Position(x=0, z=0),
            size=2.0,
            height=4.0,
            status="healthy",
        )
        tool = Node(
            id="node.shell_tool",
            name="Shell Tool",
            type=NodeType.TOOL,
            district_id="district.planning",
            position=Position(x=4, z=0),
            size=2.0,
            height=4.0,
            status="healthy",
        )
        edge = Edge(
            id="edge.plan_tool",
            **{"from": "node.planner_core", "to": "node.shell_tool"},
            kind=EdgeKind.INVOCATION,
            protocol="tool-call",
            status="declared",
            confidence=0.9,
        )
        return TopologyGraph(
            generated_at=datetime.now(timezone.utc),
            districts=[district],
            nodes=[planner, tool],
            edges=[edge],
        )

    def _envelope(self) -> TraceEnvelope:
        now = datetime.now(timezone.utc)
        return TraceEnvelope(
            trace_id="trace_test",
            session_id="sess_test",
            request_id="req_test",
            user_input="test",
            final_output="ok",
            status=TraceStatus.SUCCESS,
            token_in=1,
            token_out=1,
            estimated_cost=0.0,
            duration_ms=1,
            started_at=now,
            ended_at=now,
        )

    def test_alias_binding_hits_declared_edge(self) -> None:
        topology = self._topology()
        service = TopologyBindingService()

        span = SpanEvent(
            trace_id="trace_test",
            span_id="span_1",
            from_node="planner",  # alias, not exact node id
            to_node="shell_tool",  # alias, not exact node id
            span_kind=SpanKind.TOOL,
            protocol="tool-call",
            summary="tool call",
            payload_preview="planner->tool",
            direction="outbound",
            latency_ms=20,
            status="success",
            timestamp=datetime.now(timezone.utc),
        )
        trace = TraceRecord(envelope=self._envelope(), spans=[span])

        bound = service.bind_trace(topology, trace)
        self.assertEqual(bound.bindings[0].binding_type, "observed_edge")
        self.assertEqual(bound.bindings[0].edge_id, "edge.plan_tool")
        self.assertEqual(len(bound.inferred_edges), 0)

    def test_retry_and_fallback_inferred_edges_do_not_collapse(self) -> None:
        topology = self._topology()
        service = TopologyBindingService()

        now = datetime.now(timezone.utc)
        spans = [
            SpanEvent(
                trace_id="trace_test",
                span_id="span_retry",
                from_node="node.unknown",
                to_node="node.other",
                span_kind=SpanKind.TOOL,
                protocol="tool-call",
                summary="retry",
                payload_preview="a->b",
                direction="outbound",
                latency_ms=70,
                status="error",
                timestamp=now,
                retry_count=1,
            ),
            SpanEvent(
                trace_id="trace_test",
                span_id="span_fallback",
                from_node="node.unknown",
                to_node="node.other",
                span_kind=SpanKind.CHAIN,
                protocol="internal/http+json",
                summary="fallback",
                payload_preview="a->b",
                direction="outbound",
                latency_ms=50,
                status="partial",
                timestamp=now,
                fallback_from="node.tool",
            ),
        ]
        trace = TraceRecord(envelope=self._envelope(), spans=spans)

        bound = service.bind_trace(topology, trace)
        inferred_kinds = {edge.kind for edge in bound.inferred_edges}

        self.assertIn(EdgeKind.RETRY, inferred_kinds)
        self.assertIn(EdgeKind.FALLBACK, inferred_kinds)
        self.assertEqual(len(bound.inferred_edges), 2)


if __name__ == "__main__":
    unittest.main()
