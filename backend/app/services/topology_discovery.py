from __future__ import annotations

import re
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
        unresolved_symbols = self._normalize_unresolved(score.unresolved_symbols)

        return DiscoveryResult(
            components=component_list,
            relations=relation_list,
            parser_confidence=score.score,
            parser_grade=score.grade,
            unresolved_symbols=unresolved_symbols,
            confidence_breakdown=score.breakdown,
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

    _UNRESOLVED_NOISE_PATTERNS = (
        re.compile(r"^\s*#"),
        re.compile(r"^\s*//"),
        re.compile(r"^\s*\*"),
        re.compile(r"^\s*\"[^\"]{20,}\"$"),
    )
    _UNRESOLVED_REASON_PREFIXES = (
        "dynamic_runtime:",
        "missing_config:",
        "parser_rule_missing:",
        "ambiguous_symbol:",
    )

    def _normalize_unresolved(self, unresolved: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in unresolved:
            raw = item.strip()
            if not raw:
                continue
            if any(pattern.search(raw) for pattern in self._UNRESOLVED_NOISE_PATTERNS):
                continue
            existing_reason, payload = self._split_reason_prefix(raw)
            reason = existing_reason or self._classify_unresolved_reason(payload)
            sanitized = payload.replace("\t", " ").replace("\n", " ")
            if self._looks_like_prose_noise(sanitized):
                continue
            if len(sanitized) > 180:
                sanitized = sanitized[:177] + "..."
            normalized.append(f"{reason}:{sanitized}")

        deduped = list(OrderedDict.fromkeys(normalized))
        return deduped[:40]

    def _classify_unresolved_reason(self, value: str) -> str:
        lower = value.lower()
        if any(
            token in lower
            for token in ("importlib", "getattr(", "setattr(", "eval(", "exec(", "dynamic", "plugin")
        ):
            return "dynamic_runtime"
        if any(token in lower for token in (".yaml", ".yml", ".toml", ".json", "config", "env", "manifest")):
            return "missing_config"
        if any(token in lower for token in ("symbol", "missing core roles", "no static relations")):
            return "parser_rule_missing"
        return "ambiguous_symbol"

    def _split_reason_prefix(self, value: str) -> tuple[str | None, str]:
        lower = value.lower()
        for prefix in self._UNRESOLVED_REASON_PREFIXES:
            if lower.startswith(prefix):
                return prefix[:-1], value[len(prefix):].strip()
        return None, value

    def _looks_like_prose_noise(self, value: str) -> bool:
        compact = " ".join(value.split())
        if len(compact) < 40:
            return False

        has_code_tokens = bool(re.search(r"[(){}\[\]=]|->|::|/|\\|[A-Za-z_]+\.[A-Za-z_]+", compact))
        words = compact.split(" ")
        if len(words) <= 6:
            return False

        if not has_code_tokens:
            return True

        explicit_code_markers = bool(
            re.search(r"\b(def|class|import|return|await|async)\b|=|->|::|[A-Za-z_]+\.[A-Za-z_]+", compact)
        )
        return not explicit_code_markers
