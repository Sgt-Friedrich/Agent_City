from __future__ import annotations

from collections import OrderedDict

from app.models.schemas import DiscoveryResult, RawComponent, RawRelation
from app.sources.topology_source_protocol import TopologySignalSource


class TopologyDiscovery:
    """Builds candidate architecture graph from multiple static signals."""

    def __init__(self, source: TopologySignalSource):
        self._source = source

    def discover(self) -> DiscoveryResult:
        components: OrderedDict[str, RawComponent] = OrderedDict()
        relations: OrderedDict[str, RawRelation] = OrderedDict()

        for component in self._discover_from_agent_configs():
            components[component.id] = component

        for relation in self._discover_from_workflow_graph():
            relations[relation.id] = relation

        self._augment_with_python_registration_hints(components, relations)

        return DiscoveryResult(
            components=list(components.values()),
            relations=list(relations.values()),
        )

    def _discover_from_agent_configs(self) -> list[RawComponent]:
        return [RawComponent.model_validate(item) for item in self._source.config_components()]

    def _discover_from_workflow_graph(self) -> list[RawRelation]:
        return [RawRelation.model_validate(item) for item in self._source.workflow_relations()]

    def _augment_with_python_registration_hints(
        self,
        components: OrderedDict[str, RawComponent],
        relations: OrderedDict[str, RawRelation],
    ) -> None:
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
