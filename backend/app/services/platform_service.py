from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.models.schemas import (
    BoundTrace,
    Edge,
    MetricSummary,
    Node,
    RegisterTargetRequest,
    SpanEvent,
    TargetDescriptor,
    TopologyGraph,
    TraceRecord,
)
from app.services.runtime_trace_resolver import RuntimeTraceResolver
from app.services.topology_binding import TopologyBindingService
from app.services.topology_discovery import TopologyDiscovery
from app.services.topology_normalizer import TopologyNormalizer
from app.sources.intelligent_topology_source import IntelligentTopologySource
from app.sources.mock_metrics_source import MockMetricsSource
from app.sources.mock_topology_source import MockTopologySource
from app.sources.mock_trace_source import MockTraceSource
from app.sources.repo_topology_source import RepositoryTopologySource
from app.sources.topology_source_protocol import TopologySignalSource


@dataclass
class PlatformContext:
    target: str
    label: str
    source_type: str
    repo_path: str
    topology: TopologyGraph
    runtime_resolver: RuntimeTraceResolver
    binding: TopologyBindingService
    metrics_source: MockMetricsSource
    observed_edges: dict[str, Edge]
    trace_records: dict[str, TraceRecord]
    bound_traces: dict[str, BoundTrace]
    trace_order: list[str]
    recent_flow_events: deque[SpanEvent]


class PlatformService:
    """Application service coordinating static and runtime architecture views."""

    def __init__(self) -> None:
        self._contexts: dict[str, PlatformContext] = {}
        self._init_contexts()

    def list_targets(self) -> list[dict[str, Any]]:
        return [
            self._to_target_descriptor(context).model_dump(mode="json")
            for context in self._contexts.values()
        ]

    def register_repository_target(self, request: RegisterTargetRequest) -> dict[str, Any]:
        repo_path = Path(request.repo_path).expanduser().resolve()
        if not repo_path.exists() or not repo_path.is_dir():
            raise ValueError(f"invalid repository path: {request.repo_path}")

        target_id = self._sanitize_target_id(
            request.target_id or repo_path.name,
            allow_existing=request.force,
        )
        if target_id in self._contexts and not request.force:
            raise ValueError(f"target already exists: {target_id}")

        source_type, source = self._source_for_path(repo_path)
        label = request.label or f"Auto: {repo_path.name}"

        context = self._create_context(
            target=target_id,
            label=label,
            source_type=source_type,
            repo_path=str(repo_path),
            source=source,
        )

        self._contexts[target_id] = context
        return self._to_target_descriptor(context).model_dump(mode="json")

    def get_topology(self, target: str = "mock") -> TopologyGraph:
        context = self._get_context(target)
        topology = context.topology.model_copy(deep=True)
        topology.edges.extend(context.observed_edges.values())
        return topology

    def list_traces(self, target: str = "mock", limit: int = 50) -> list[TraceRecord]:
        context = self._get_context(target)
        selected_ids = context.trace_order[-limit:]
        return [context.trace_records[trace_id] for trace_id in reversed(selected_ids)]

    def get_bound_trace(self, trace_id: str, target: str = "mock") -> BoundTrace | None:
        context = self._get_context(target)
        return context.bound_traces.get(trace_id)

    def get_trace(self, trace_id: str, target: str = "mock") -> TraceRecord | None:
        context = self._get_context(target)
        return context.trace_records.get(trace_id)

    def get_node(self, node_id: str, target: str = "mock") -> Node | None:
        topology = self.get_topology(target)
        for node in topology.nodes:
            if node.id == node_id:
                return node
        return None

    def get_metrics_summary(self, target: str = "mock") -> MetricSummary:
        context = self._get_context(target)
        now = datetime.now(timezone.utc)
        active_flow_count = sum(
            1
            for event in context.recent_flow_events
            if now - event.timestamp <= timedelta(seconds=18)
        )
        traces = list(context.trace_records.values())
        return context.metrics_source.summary(traces=traces, active_flow_count=active_flow_count)

    def generate_live_trace(self, target: str = "mock", scenario_id: str | None = None) -> BoundTrace:
        context = self._get_context(target)
        trace = context.runtime_resolver.generate_trace(scenario_id=scenario_id)
        bound = context.binding.bind_trace(self.get_topology(target), trace)
        self._register_bound_trace(context, bound)
        self._refresh_node_metrics(context)
        return bound

    def _get_context(self, target: str) -> PlatformContext:
        if target in self._contexts:
            return self._contexts[target]
        if "mock" in self._contexts:
            return self._contexts["mock"]
        return next(iter(self._contexts.values()))

    def _init_contexts(self) -> None:
        project_root = Path(__file__).resolve().parents[3]
        workspace_root = Path(__file__).resolve().parents[4]

        self._contexts["mock"] = self._create_context(
            target="mock",
            label="Mock Architecture",
            source_type="mock",
            repo_path=str(project_root),
            source=MockTopologySource(),
        )

        claude_path = workspace_root / "claude-code-src-main"
        if claude_path.exists():
            self._contexts["claude"] = self._create_context(
                target="claude",
                label="Claude Code Source",
                source_type="repo_scan",
                repo_path=str(claude_path),
                source=RepositoryTopologySource(claude_path, target_hint="claude"),
            )

        codex_path = workspace_root / "codex-main"
        if codex_path.exists():
            self._contexts["codex"] = self._create_context(
                target="codex",
                label="Codex Source",
                source_type="cargo_workspace",
                repo_path=str(codex_path),
                source=RepositoryTopologySource(codex_path, target_hint="codex"),
            )

        if len(self._contexts) == 1:
            self._contexts["project"] = self._create_context(
                target="project",
                label="Current Project (Intelligent)",
                source_type="intelligent_repo_scan",
                repo_path=str(project_root),
                source=IntelligentTopologySource(project_root, target_hint="project"),
            )

    def _create_context(
        self,
        target: str,
        label: str,
        source_type: str,
        repo_path: str,
        source: TopologySignalSource,
    ) -> PlatformContext:
        discovery = TopologyDiscovery(source)
        normalizer = TopologyNormalizer()
        topology = normalizer.normalize(discovery.discover())

        runtime_resolver = RuntimeTraceResolver(MockTraceSource())
        runtime_resolver.configure(topology=topology, target_name=target)

        context = PlatformContext(
            target=target,
            label=label,
            source_type=source_type,
            repo_path=repo_path,
            topology=topology,
            runtime_resolver=runtime_resolver,
            binding=TopologyBindingService(),
            metrics_source=MockMetricsSource(),
            observed_edges={},
            trace_records={},
            bound_traces={},
            trace_order=[],
            recent_flow_events=deque(maxlen=1600),
        )

        self._refresh_node_metrics(context)
        self._seed_initial_traces(context, 14)
        return context

    def _source_for_path(self, repo_path: Path) -> tuple[str, TopologySignalSource]:
        repo_source = RepositoryTopologySource(repo_path, target_hint="auto")
        if repo_source.repo_kind == "claude":
            return ("repo_scan", repo_source)
        if repo_source.repo_kind == "codex":
            return ("cargo_workspace", repo_source)
        return (
            "intelligent_repo_scan",
            IntelligentTopologySource(repo_path, target_hint="auto"),
        )

    def _sanitize_target_id(self, raw_target: str, allow_existing: bool = False) -> str:
        sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", raw_target.strip().lower()).strip("_")
        if not sanitized:
            sanitized = "target"

        if allow_existing:
            return sanitized

        if sanitized not in self._contexts:
            return sanitized

        suffix = 2
        candidate = f"{sanitized}_{suffix}"
        while candidate in self._contexts:
            suffix += 1
            candidate = f"{sanitized}_{suffix}"
        return candidate

    def _to_target_descriptor(self, context: PlatformContext) -> TargetDescriptor:
        return TargetDescriptor(
            id=context.target,
            label=context.label,
            source_type=context.source_type,
            repo_path=context.repo_path,
            node_count=len(context.topology.nodes),
            edge_count=len(context.topology.edges) + len(context.observed_edges),
        )

    def _seed_initial_traces(self, context: PlatformContext, count: int) -> None:
        topology = context.topology.model_copy(deep=True)
        topology.edges.extend(context.observed_edges.values())
        for trace in context.runtime_resolver.generate_batch(count):
            bound = context.binding.bind_trace(topology, trace)
            self._register_bound_trace(context, bound)

    def _register_bound_trace(self, context: PlatformContext, bound: BoundTrace) -> None:
        trace_id = bound.trace.envelope.trace_id
        if trace_id not in context.trace_records:
            context.trace_order.append(trace_id)

        context.trace_records[trace_id] = bound.trace
        context.bound_traces[trace_id] = bound

        for inferred in bound.inferred_edges:
            context.observed_edges[inferred.id] = inferred

        for span in bound.trace.spans:
            context.recent_flow_events.append(span)

    def _refresh_node_metrics(self, context: PlatformContext) -> None:
        snapshots = context.metrics_source.snapshot_for_nodes(context.topology.nodes)
        for node in context.topology.nodes:
            node.metrics = snapshots.get(node.id)
