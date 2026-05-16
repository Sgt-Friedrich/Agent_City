from __future__ import annotations

from dataclasses import dataclass

from app.models.schemas import RawComponent, RawRelation


@dataclass(frozen=True)
class ConfidenceScore:
    score: float
    grade: str
    unresolved_symbols: list[str]
    breakdown: dict[str, float]
    source_coverage: dict[str, bool]


class ConfidenceScoringService:
    """Computes transparent parser confidence and degradation reasons."""

    CORE_ROLES = {"runtime_node", "planner", "tool", "llm"}

    def score(
        self,
        components: list[RawComponent],
        relations: list[RawRelation],
        snippet_count: int,
        source_hints: list[str] | None = None,
    ) -> ConfidenceScore:
        role_set = {component.role for component in components}
        core_coverage = len(role_set.intersection(self.CORE_ROLES)) / len(self.CORE_ROLES)

        synthetic_count = sum(1 for component in components if component.metadata.get("synthetic"))
        component_count = max(len(components), 1)
        synthetic_ratio = synthetic_count / component_count

        relation_density = min(len(relations) / component_count, 1.2) / 1.2

        source_coverage = self._source_coverage(components=components, relations=relations, snippet_count=snippet_count)
        source_score = sum(1 for item in source_coverage.values() if item) / len(source_coverage)

        # Explainable sub-scores:
        # - code: code snippets + role coverage quality
        # - config: config evidence
        # - registry: decorators/registration/workflow/graph evidence
        # - runtime_consistency: relation density + synthetic node ratio
        code_score = min(1.0, 0.45 * core_coverage + (0.55 if snippet_count > 0 else 0.0))
        config_score = 1.0 if source_coverage["config"] else 0.0
        registry_score = 1.0 if source_coverage["registry"] else 0.0
        runtime_consistency = max(
            0.0,
            min(1.0, relation_density * 0.7 + (1.0 - synthetic_ratio) * 0.3),
        )
        breakdown = {
            "code": round(code_score, 3),
            "config": round(config_score, 3),
            "registry": round(registry_score, 3),
            "runtime_consistency": round(runtime_consistency, 3),
        }

        score = 0.08
        score += 0.32 * code_score
        score += 0.2 * config_score
        score += 0.2 * registry_score
        score += 0.2 * runtime_consistency
        score = max(0.08, min(0.96, round(score, 3)))

        unresolved: list[str] = []
        if core_coverage < 1.0:
            missing = sorted(self.CORE_ROLES.difference(role_set))
            unresolved.append(f"missing core roles: {', '.join(missing)}")
        if len(relations) == 0:
            unresolved.append("no static relations were discovered")
        if synthetic_ratio > 0.33:
            unresolved.append("high provisional node ratio due sparse static evidence")
        if not source_coverage["registry"]:
            unresolved.append("registry/factory evidence limited")
        if not source_coverage["config"]:
            unresolved.append("config-driven evidence limited")
        if source_hints:
            unresolved.extend(source_hints[:4])

        grade = self._grade(score=score, core_coverage=core_coverage, relations=len(relations))

        return ConfidenceScore(
            score=score,
            grade=grade,
            unresolved_symbols=sorted(set(unresolved)),
            breakdown=breakdown,
            source_coverage=source_coverage,
        )

    def _source_coverage(
        self,
        components: list[RawComponent],
        relations: list[RawRelation],
        snippet_count: int,
    ) -> dict[str, bool]:
        source_types = {component.source_type.lower() for component in components}

        config = any(
            any(token in source_type for token in ["config", "manifest", "toml", "yaml", "json", "cargo", "pom"]) 
            for source_type in source_types
        ) or any(
            bool(component.metadata.get("config_sources")) for component in components
        ) or any(
            relation.protocol == "config" for relation in relations
        ) or any(
            any(str(item).startswith("config:") for item in relation.inferred_from)
            for relation in relations
        )
        registry = any(
            any(token in source_type for token in ["registry", "workflow", "graph", "policy", "prompt", "tool", "mcp"]) 
            for source_type in source_types
        ) or any(
            any(token in inferred.lower() for token in ["semantic:", "import:", "register", "factory", "workflow"]) 
            for relation in relations
            for inferred in relation.inferred_from
        )
        code = snippet_count > 0 or any(
            component.source_location.lower().endswith((".py", ".ts", ".tsx", ".go", ".rs", ".java", ".cs"))
            for component in components
        )

        return {
            "config": config,
            "registry": registry,
            "code": code,
        }

    def _grade(self, score: float, core_coverage: float, relations: int) -> str:
        if score >= 0.82 and core_coverage >= 1.0 and relations >= 4:
            return "A"
        if score >= 0.68 and core_coverage >= 0.75 and relations >= 2:
            return "B"
        if score >= 0.5:
            return "C"
        return "D"
