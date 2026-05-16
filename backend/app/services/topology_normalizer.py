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
    RawComponent,
    RawRelation,
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
        components = self._augment_with_relation_placeholders(discovery.components, discovery.relations)
        districts = self._build_districts(components)
        nodes = self._build_nodes(components, districts)
        node_ids = {node.id for node in nodes}
        edges = self._build_edges(discovery.relations, node_ids=node_ids)

        return TopologyGraph(
            generated_at=datetime.now(timezone.utc),
            districts=districts,
            nodes=nodes,
            edges=edges,
            metadata={
                "parser_confidence": discovery.parser_confidence,
                "parser_grade": discovery.parser_grade,
                "unresolved_symbols": discovery.unresolved_symbols,
                "confidence_breakdown": discovery.confidence_breakdown,
                "source_coverage": discovery.source_coverage,
            },
        )

    def _build_districts(self, components: list[RawComponent]) -> list[District]:
        counts = defaultdict(int)
        for component in components:
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

    def _build_nodes(self, components: list[RawComponent], districts: list[District]) -> list[Node]:
        district_map = {district.id: district for district in districts}
        by_district: dict[str, list] = defaultdict(list)

        for component in components:
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
                        "display_name": self._display_name_for_component(component),
                        "technical_name": component.id,
                        "explainability": self._build_explainability_profile(component),
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

    def _display_name_for_component(self, component: RawComponent) -> str:
        base = component.name.strip()
        if base:
            return base
        return component.id.replace("node.", "").replace("_", " ").title()

    def _build_explainability_profile(self, component: RawComponent) -> dict[str, object]:
        role = component.role
        role_to_io: dict[str, tuple[list[str], list[str], list[str], str]] = {
            "planner": (["user task", "context signals"], ["execution plan", "step routing"], ["internal/http+json"], "planning failure can stall full request chain"),
            "agent": (["task objective"], ["delegated actions"], ["internal/http+json"], "agent orchestration drift may propagate downstream"),
            "sub_agent": (["delegated sub-task"], ["partial result"], ["internal/http+json"], "sub-agent instability increases retries"),
            "retriever": (["query", "memory refs"], ["candidate contexts"], ["internal/http+json"], "low retrieval quality hurts LLM grounding"),
            "reranker": (["retrieved contexts"], ["ordered contexts"], ["internal/http+json"], "reranker errors may degrade response quality"),
            "embedding": (["raw content"], ["vector embeddings"], ["internal/http+json"], "embedding drift breaks semantic retrieval"),
            "memory": (["session updates"], ["state snapshot"], ["internal/http+json"], "state inconsistency causes wrong long-context behavior"),
            "tool": (["tool-call request"], ["tool output"], ["tool-call", "shell", "fs"], "tool failures trigger retry/fallback chains"),
            "mcp": (["mcp request"], ["mcp tool result"], ["mcp"], "mcp transport failures isolate external capabilities"),
            "llm": (["prompt + context"], ["model completion"], ["internal/http+json"], "llm latency and errors dominate end-to-end time"),
            "prompt": (["prompt template refs"], ["resolved prompt"], ["internal/module"], "prompt mismatch causes policy and quality drift"),
            "guardrail": (["candidate output"], ["approved/rejected output"], ["internal/http+json"], "guardrail false positives can block valid output"),
            "evaluator": (["trace outputs"], ["quality score"], ["internal/http+json"], "missing eval feedback weakens self-improvement loops"),
            "runtime_node": (["incoming event"], ["routed event"], ["internal/http+json"], "runtime bottlenecks impact all module paths"),
            "session": (["session event"], ["session state"], ["internal/http+json"], "session loss breaks continuity"),
            "event_bus": (["published event"], ["subscribed event"], ["ws", "internal/http+json"], "event bus lag creates systemic congestion"),
            "external": (["integration request"], ["external response"], ["http+json"], "external dependency outages cause boundary failures"),
        }

        defaults = (["runtime input"], ["runtime output"], ["internal/http+json"], "insufficient static evidence; verify runtime traces")
        inputs, outputs, protocols, risk_hint = role_to_io.get(role, defaults)
        sources = component.metadata.get("sources", [])
        source_count = len(sources) if isinstance(sources, list) else 0
        evidence_conf = 0.85 if source_count >= 2 else 0.68 if source_count == 1 else 0.55
        display_name = self._display_name_for_component(component)
        group = role if role in {"planner", "retriever", "memory", "tool", "mcp", "llm", "guardrail", "runtime_node"} else "runtime_node"

        return {
            "display_name": display_name,
            "technical_name": component.id,
            "role": role,
            "responsibility": component.summary,
            "inputs": inputs,
            "outputs": outputs,
            "protocols": protocols,
            "risk_hint": risk_hint,
            "group": group,
            "evidence_count": source_count,
            "explainability_confidence": round(evidence_conf, 2),
        }

    def _augment_with_relation_placeholders(
        self,
        components: list[RawComponent],
        relations: list[RawRelation],
    ) -> list[RawComponent]:
        component_map = {component.id: component for component in components}
        augmented = list(components)

        for relation in relations:
            for endpoint in (relation.source, relation.target):
                if endpoint in component_map:
                    continue

                placeholder = RawComponent(
                    id=endpoint,
                    name=endpoint.replace("node.", "").replace("_", " ").title(),
                    role="runtime_node",
                    summary="Provisional node synthesized from unresolved relation endpoint.",
                    source_type="normalizer_provisional",
                    source_location=endpoint,
                    tags=["provisional", "unresolved"],
                    metadata={
                        "weight": 0.85,
                        "status": "idle",
                        "synthetic": True,
                        "unresolved_reason": f"referenced by relation {relation.id}",
                    },
                )
                component_map[endpoint] = placeholder
                augmented.append(placeholder)

        return augmented

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

    def _build_edges(self, relations: list[RawRelation], node_ids: set[str]) -> list[Edge]:
        edges: list[Edge] = []
        for relation in relations:
            edge_kind = RELATION_TO_EDGE_KIND.get(relation.relation_type, EdgeKind.DEPENDENCY)
            has_missing_endpoint = relation.source not in node_ids or relation.target not in node_ids
            edge = Edge(
                id=relation.id,
                **{
                    "from": relation.source,
                    "to": relation.target,
                },
                kind=edge_kind,
                protocol=relation.protocol,
                status="declared",
                confidence=relation.confidence if not has_missing_endpoint else min(relation.confidence, 0.45),
                inferred_from=relation.inferred_from,
                metrics={"latency_hint_ms": relation.metadata.get("latency_hint_ms", 80)},
                metadata={
                    "relation_type": relation.relation_type,
                    "is_evidence": bool(relation.metadata.get("evidence_only", False)),
                    "missing_endpoint": has_missing_endpoint,
                },
            )
            edges.append(edge)
        return edges
