from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import ceil, sqrt

from app.models.schemas import (
    Bounds,
    District,
    DistrictType,
    DiscoveryResult,
    Edge,
    EdgeKind,
    Node,
    NodeType,
    Position,
    SourceProvenance,
    TopologyGraph,
)


DISTRICT_LAYOUT: dict[str, dict[str, object]] = {
    "district.runtime": {
        "name": "Runtime District",
        "type": DistrictType.RUNTIME,
        "summary": "Ingress, session orchestration, event routing and final render pipeline.",
        "position": Position(x=0, z=58),
        "bounds": Bounds(width=52, depth=30),
    },
    "district.planning": {
        "name": "Planning District",
        "type": DistrictType.PLANNING,
        "summary": "Planner/orchestrator and execution strategy center.",
        "position": Position(x=0, z=8),
        "bounds": Bounds(width=50, depth=36),
    },
    "district.retrieval": {
        "name": "Retrieval District",
        "type": DistrictType.RETRIEVAL,
        "summary": "Retriever, reranker and semantic search chain.",
        "position": Position(x=-62, z=14),
        "bounds": Bounds(width=44, depth=34),
    },
    "district.memory": {
        "name": "Memory District",
        "type": DistrictType.MEMORY,
        "summary": "Session memory, long-term memory and persistence operations.",
        "position": Position(x=-62, z=-34),
        "bounds": Bounds(width=44, depth=30),
    },
    "district.tools": {
        "name": "Tools District",
        "type": DistrictType.TOOLS,
        "summary": "Tool registry, shell/browser execution and MCP integration.",
        "position": Position(x=62, z=18),
        "bounds": Bounds(width=48, depth=38),
    },
    "district.llm": {
        "name": "LLM District",
        "type": DistrictType.LLM,
        "summary": "Model gateway, prompt assets, and response synthesis.",
        "position": Position(x=62, z=-28),
        "bounds": Bounds(width=44, depth=32),
    },
    "district.safety": {
        "name": "Safety District",
        "type": DistrictType.SAFETY,
        "summary": "Guardrail, evaluation and policy enforcement chain.",
        "position": Position(x=0, z=-56),
        "bounds": Bounds(width=46, depth=28),
    },
    "district.boundary": {
        "name": "Boundary District",
        "type": DistrictType.BOUNDARY,
        "summary": "External services and shared integration boundaries.",
        "position": Position(x=102, z=0),
        "bounds": Bounds(width=38, depth=46),
    },
}


ROLE_TO_NODE_TYPE: dict[str, NodeType] = {
    "planner": NodeType.PLANNER,
    "retriever": NodeType.RETRIEVER,
    "reranker": NodeType.RERANKER,
    "embedding": NodeType.EMBEDDING,
    "memory": NodeType.MEMORY,
    "tool": NodeType.TOOL,
    "mcp": NodeType.MCP,
    "llm": NodeType.LLM,
    "prompt": NodeType.PROMPT,
    "guardrail": NodeType.GUARDRAIL,
    "evaluator": NodeType.EVALUATOR,
    "runtime_node": NodeType.RUNTIME,
    "session": NodeType.SESSION,
    "event_bus": NodeType.EVENT_BUS,
    "external": NodeType.EXTERNAL,
    "agent": NodeType.AGENT,
    "sub_agent": NodeType.SUB_AGENT,
}


ROLE_TO_DISTRICT: dict[str, str] = {
    "planner": "district.planning",
    "agent": "district.planning",
    "sub_agent": "district.planning",
    "retriever": "district.retrieval",
    "reranker": "district.retrieval",
    "embedding": "district.retrieval",
    "memory": "district.memory",
    "tool": "district.tools",
    "mcp": "district.tools",
    "llm": "district.llm",
    "prompt": "district.llm",
    "guardrail": "district.safety",
    "evaluator": "district.safety",
    "runtime_node": "district.runtime",
    "session": "district.runtime",
    "event_bus": "district.runtime",
    "external": "district.boundary",
}


RELATION_TO_EDGE_KIND: dict[str, EdgeKind] = {
    "dependency": EdgeKind.DEPENDENCY,
    "invocation": EdgeKind.INVOCATION,
    "dataflow": EdgeKind.DATAFLOW,
    "fallback": EdgeKind.FALLBACK,
    "retry": EdgeKind.RETRY,
}


class TopologyNormalizer:
    """Normalizes discovered architecture into a unified topology schema."""

    def normalize(self, discovery: DiscoveryResult) -> TopologyGraph:
        districts = self._build_districts(discovery)
        nodes = self._build_nodes(discovery, districts)
        edges = self._build_edges(discovery)

        return TopologyGraph(
            generated_at=datetime.now(timezone.utc),
            districts=districts,
            nodes=nodes,
            edges=edges,
        )

    def _build_districts(self, discovery: DiscoveryResult) -> list[District]:
        counts = defaultdict(int)
        for component in discovery.components:
            district_id = ROLE_TO_DISTRICT.get(component.role, "district.runtime")
            counts[district_id] += 1

        districts: list[District] = []
        for district_id, config in DISTRICT_LAYOUT.items():
            districts.append(
                District(
                    id=district_id,
                    name=str(config["name"]),
                    type=config["type"],
                    summary=str(config["summary"]),
                    position=config["position"],
                    bounds=config["bounds"],
                    metadata={"node_count": counts[district_id]},
                )
            )
        return districts

    def _build_nodes(self, discovery: DiscoveryResult, districts: list[District]) -> list[Node]:
        district_map = {district.id: district for district in districts}
        by_district: dict[str, list] = defaultdict(list)

        for component in discovery.components:
            district_id = ROLE_TO_DISTRICT.get(component.role, "district.runtime")
            by_district[district_id].append(component)

        nodes: list[Node] = []
        for district_id, components in by_district.items():
            district = district_map[district_id]
            positions = self._layout_positions(district, len(components))

            for index, component in enumerate(components):
                weight = float(component.metadata.get("weight", 1.0))
                status = str(component.metadata.get("status", "healthy"))
                call_bias = 1.8 if component.role in {"planner", "llm", "runtime_node"} else 1.0

                node = Node(
                    id=component.id,
                    name=component.name,
                    type=ROLE_TO_NODE_TYPE.get(component.role, NodeType.RUNTIME),
                    district_id=district_id,
                    position=positions[index],
                    size=round(2.2 + weight * 1.8, 2),
                    height=round(5 + (weight * 5.4 * call_bias), 2),
                    status=status,
                    labels=sorted(set(component.tags + [component.role])),
                    metadata={
                        "summary": component.summary,
                        "role": component.role,
                        "sources": component.metadata.get("sources", []),
                    },
                    source_provenance=[
                        SourceProvenance(
                            source_type=component.source_type,
                            location=component.source_location,
                            confidence=0.88,
                            detail="discovery stage",
                        )
                    ],
                )
                nodes.append(node)

        return nodes

    def _layout_positions(self, district: District, count: int) -> list[Position]:
        if count <= 0:
            return []

        cols = ceil(sqrt(count))
        rows = ceil(count / cols)
        spacing_x = district.bounds.width / (cols + 1)
        spacing_z = district.bounds.depth / (rows + 1)

        start_x = district.position.x - district.bounds.width / 2 + spacing_x
        start_z = district.position.z - district.bounds.depth / 2 + spacing_z

        positions: list[Position] = []
        for idx in range(count):
            col = idx % cols
            row = idx // cols
            positions.append(
                Position(
                    x=round(start_x + col * spacing_x, 2),
                    y=0,
                    z=round(start_z + row * spacing_z, 2),
                )
            )
        return positions

    def _build_edges(self, discovery: DiscoveryResult) -> list[Edge]:
        edges: list[Edge] = []
        for relation in discovery.relations:
            edge_kind = RELATION_TO_EDGE_KIND.get(relation.relation_type, EdgeKind.DEPENDENCY)
            edge = Edge(
                id=relation.id,
                **{
                    "from": relation.source,
                    "to": relation.target,
                },
                kind=edge_kind,
                protocol=relation.protocol,
                status="declared",
                confidence=relation.confidence,
                inferred_from=relation.inferred_from,
                metrics={"latency_hint_ms": relation.metadata.get("latency_hint_ms", 80)},
                metadata={
                    "relation_type": relation.relation_type,
                    "is_evidence": bool(relation.metadata.get("evidence_only", False)),
                },
            )
            edges.append(edge)
        return edges
