from __future__ import annotations

from collections import OrderedDict

from app.models.schemas import DiscoveryResult, RawComponent, RawRelation
from app.services.confidence_scoring import ConfidenceScoringService
from app.sources.topology_source_protocol import TopologySignalSource


class TopologyDiscovery:
    """Builds candidate architecture graph from multiple static signals."""

    def __init__(self, source: TopologySignalSource):
        self._source = source
        self._confidence = ConfidenceScoringService()

    def discover(self) -> DiscoveryResult:
        components: OrderedDict[str, RawComponent] = OrderedDict()
        relations: OrderedDict[str, RawRelation] = OrderedDict()

        for component in self._discover_from_agent_configs():
            components[component.id] = component

        for relation in self._discover_from_workflow_graph():
            relations[relation.id] = relation

        snippet_count = self._augment_with_python_registration_hints(components, relations)

        component_list = list(components.values())
        relation_list = list(relations.values())

        source_hint_fn = getattr(self._source, "unresolved_hints", None)
        source_hints = source_hint_fn() if callable(source_hint_fn) else []

        score = self._confidence.score(
            components=component_list,
            relations=relation_list,
            snippet_count=snippet_count,
            source_hints=source_hints,
        )

        return DiscoveryResult(
            components=component_list,
            relations=relation_list,
            parser_confidence=score.score,
            parser_grade=score.grade,
            unresolved_symbols=score.unresolved_symbols,
            source_coverage=score.source_coverage,
        )

    def _discover_from_agent_configs(self) -> list[RawComponent]:
        return [RawComponent.model_validate(item) for item in self._source.config_components()]

    def _discover_from_workflow_graph(self) -> list[RawRelation]:
        return [RawRelation.model_validate(item) for item in self._source.workflow_relations()]

    def _augment_with_python_registration_hints(
        self,
        components: OrderedDict[str, RawComponent],
        relations: OrderedDict[str, RawRelation],
    ) -> int:
        """Attach provenance evidence from decorators/factories in code snippets."""

        snippets = self._source.python_registration_snippets()
        entry_component_id = self._find_entry_component_id(components)

        for snippet in snippets:
            component_id = snippet["component_id"]
            component = components.get(component_id)
            if component is None:
                continue

            component.tags.append("python-registered")
            component.metadata.setdefault("python_symbols", []).append(snippet["symbol"])
            component.metadata.setdefault("sources", []).append(snippet["source_location"])

            evidence_relation_id = f"edge.evidence.{component_id}"
            if evidence_relation_id in relations:
                continue

            relations[evidence_relation_id] = RawRelation(
                id=evidence_relation_id,
                source=entry_component_id,
                target=component_id,
                relation_type="dependency",
                protocol="internal/http+json",
                confidence=0.55,
                inferred_from=[snippet["source_location"], snippet["symbol"]],
                metadata={"evidence_only": True},
            )

        return len(snippets)

    def _find_entry_component_id(self, components: OrderedDict[str, RawComponent]) -> str:
        for component in components.values():
            tags = {tag.lower() for tag in component.tags}
            name = component.name.lower()
            if "entry" in tags or "chat" in name or "cli" in name:
                return component.id

        for component in components.values():
            if component.role in {"runtime_node", "session", "event_bus"}:
                return component.id

        first = next(iter(components.values()), None)
        return first.id if first else "node.entry"
