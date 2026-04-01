from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from app.models.schemas import (
    AnalysisReportExport,
    BoundTrace,
    CoveragePoint,
    DiagnosticsSummary,
    Edge,
    EdgeDiagnosticItem,
    MetricSummary,
    Node,
    NodeDiagnosticItem,
    ParseJob,
    ParserAnalysisIssue,
    ParserAnalysisReport,
    ParseJobStatus,
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

ProgressCallback = Callable[[int, str, str | None], None]


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


@dataclass
class ParseJobState:
    id: str
    source: str
    repo_path: str
    repo_name: str
    status: ParseJobStatus
    progress: int
    step: str
    message: str | None
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    target_id: str | None = None
    error: str | None = None

    def to_model(self) -> ParseJob:
        return ParseJob(
            id=self.id,
            source=self.source,
            repo_path=self.repo_path,
            repo_name=self.repo_name,
            target_id=self.target_id,
            status=self.status,
            progress=max(0, min(100, self.progress)),
            step=self.step,
            message=self.message,
            error=self.error,
            created_at=self.created_at,
            started_at=self.started_at,
            ended_at=self.ended_at,
        )


class PlatformService:
    """Application service coordinating static and runtime architecture views."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._contexts: dict[str, PlatformContext] = {}
        self._parse_jobs: dict[str, ParseJobState] = {}
        self._parse_job_order: list[str] = []

        self._project_root = Path(__file__).resolve().parents[3]
        self._workspace_root = Path(__file__).resolve().parents[4]
        # Keep drop-in parsing under this project root so users can copy directories
        # into `refs/agent_drop` directly after startup.
        self._ingest_root = self._project_root / "refs" / "agent_drop"
        self._ingest_root.mkdir(parents=True, exist_ok=True)

        self._init_contexts()

    def list_targets(self) -> list[dict[str, Any]]:
        with self._lock:
            contexts = list(self._contexts.values())
        return [self._to_target_descriptor(context).model_dump(mode="json") for context in contexts]

    def register_repository_target(
        self,
        request: RegisterTargetRequest,
        progress_cb: ProgressCallback | None = None,
    ) -> dict[str, Any]:
        repo_path = Path(request.repo_path).expanduser().resolve()
        if progress_cb:
            progress_cb(5, "validate", "validating repository path")

        if not repo_path.exists() or not repo_path.is_dir():
            raise ValueError(f"invalid repository path: {request.repo_path}")

        with self._lock:
            existing_target = self._find_target_by_repo_path_unlocked(str(repo_path))
            if existing_target and not request.force:
                if progress_cb:
                    progress_cb(100, "completed", "repository already registered")
                return self._to_target_descriptor(self._contexts[existing_target]).model_dump(mode="json")

            target_id = self._sanitize_target_id(
                request.target_id or repo_path.name,
                allow_existing=request.force,
            )
            if target_id in self._contexts and not request.force:
                raise ValueError(f"target already exists: {target_id}")

        if progress_cb:
            progress_cb(12, "source", "detecting source type")

        source_type, source = self._source_for_path(repo_path)
        label = request.label or f"Auto: {repo_path.name}"

        context = self._create_context(
            target=target_id,
            label=label,
            source_type=source_type,
            repo_path=str(repo_path),
            source=source,
            progress_cb=progress_cb,
        )

        with self._lock:
            final_target = target_id
            if final_target in self._contexts and not request.force:
                final_target = self._sanitize_target_id(final_target, allow_existing=False)
                context.target = final_target
                context.runtime_resolver.configure(topology=context.topology, target_name=final_target)

            self._contexts[final_target] = context

        if progress_cb:
            progress_cb(100, "completed", f"topology ready for target {final_target}")

        return self._to_target_descriptor(context).model_dump(mode="json")

    def get_topology(self, target: str = "mock") -> TopologyGraph:
        with self._lock:
            context = self._get_context_unlocked(target)
            topology = context.topology.model_copy(deep=True)
            observed_edges = list(context.observed_edges.values())

        topology.edges.extend(observed_edges)
        return topology

    def list_traces(self, target: str = "mock", limit: int = 50) -> list[TraceRecord]:
        with self._lock:
            context = self._get_context_unlocked(target)
            selected_ids = context.trace_order[-limit:]
            return [context.trace_records[trace_id] for trace_id in reversed(selected_ids)]

    def get_bound_trace(self, trace_id: str, target: str = "mock") -> BoundTrace | None:
        with self._lock:
            context = self._get_context_unlocked(target)
            return context.bound_traces.get(trace_id)

    def get_trace(self, trace_id: str, target: str = "mock") -> TraceRecord | None:
        with self._lock:
            context = self._get_context_unlocked(target)
            return context.trace_records.get(trace_id)

    def get_node(self, node_id: str, target: str = "mock") -> Node | None:
        topology = self.get_topology(target)
        for node in topology.nodes:
            if node.id == node_id:
                return node
        return None

    def get_metrics_summary(self, target: str = "mock") -> MetricSummary:
        with self._lock:
            context = self._get_context_unlocked(target)
            now = datetime.now(timezone.utc)
            active_flow_count = sum(
                1
                for event in context.recent_flow_events
                if now - event.timestamp <= timedelta(seconds=18)
            )
            traces = list(context.trace_records.values())

        return context.metrics_source.summary(traces=traces, active_flow_count=active_flow_count)

    def generate_live_trace(self, target: str = "mock", scenario_id: str | None = None) -> BoundTrace:
        with self._lock:
            context = self._get_context_unlocked(target)

            trace = context.runtime_resolver.generate_trace(scenario_id=scenario_id)
            topology = context.topology.model_copy(deep=True)
            topology.edges.extend(context.observed_edges.values())
            bound = context.binding.bind_trace(topology, trace)

            self._register_bound_trace_unlocked(context, bound)
            self._refresh_node_metrics(context)

        return bound

    def get_ingest_directory(self) -> str:
        return str(self._ingest_root)

    def list_parse_jobs(self, limit: int = 40) -> list[ParseJob]:
        with self._lock:
            ids = self._parse_job_order[-limit:]
            jobs = [self._parse_jobs[job_id].to_model() for job_id in reversed(ids)]
        return jobs

    def scan_ingest_directory(self) -> list[ParseJob]:
        candidates = self._discover_ingest_candidates()
        started_jobs: list[ParseJob] = []

        for repo_path in candidates:
            job = self._create_parse_job(repo_path, source="auto_ingest")
            started_jobs.append(job.to_model())
            self._run_parse_job(job.id)

        return started_jobs

    def get_diagnostics_summary(self, target: str = "mock") -> DiagnosticsSummary:
        with self._lock:
            if target not in self._contexts:
                raise ValueError(f"unknown target: {target}")
            context = self._get_context_unlocked(target)
            events = list(context.recent_flow_events)
            nodes = list(context.topology.nodes)
            declared_edges = list(context.topology.edges)
            observed_edges = list(context.observed_edges.values())
            trace_records = dict(context.trace_records)

        node_map = {node.id: node for node in nodes}
        node_event_stats: dict[str, dict[str, Any]] = {
            node.id: {
                "events": 0,
                "errors": 0,
                "latency_sum": 0.0,
                "trace_ids": set(),
                "inbound": 0,
                "outbound": 0,
            }
            for node in nodes
        }
        edge_event_stats: dict[tuple[str, str], dict[str, Any]] = {}

        error_event_count = 0
        retry_event_count = 0
        fallback_event_count = 0
        active_trace_ids: set[str] = set()

        for event in events:
            active_trace_ids.add(event.trace_id)
            if event.status == "error":
                error_event_count += 1
            if event.retry_count > 0:
                retry_event_count += 1
            if event.fallback_from:
                fallback_event_count += 1

            from_stats = node_event_stats.get(event.from_node)
            if from_stats is not None:
                from_stats["events"] += 1
                from_stats["latency_sum"] += float(event.latency_ms)
                from_stats["trace_ids"].add(event.trace_id)
                from_stats["outbound"] += 1
                if event.status == "error" or event.retry_count > 0 or event.fallback_from:
                    from_stats["errors"] += 1

            if event.to_node:
                to_stats = node_event_stats.get(event.to_node)
                if to_stats is not None:
                    to_stats["events"] += 1
                    to_stats["latency_sum"] += float(event.latency_ms)
                    to_stats["trace_ids"].add(event.trace_id)
                    to_stats["inbound"] += 1
                    if event.status == "error" or event.retry_count > 0 or event.fallback_from:
                        to_stats["errors"] += 1

                pair = (event.from_node, event.to_node)
                pair_stats = edge_event_stats.setdefault(
                    pair,
                    {
                        "count": 0,
                        "latency_sum": 0.0,
                        "errors": 0,
                        "retries": 0,
                        "fallbacks": 0,
                    },
                )
                pair_stats["count"] += 1
                pair_stats["latency_sum"] += float(event.latency_ms)
                if event.status == "error":
                    pair_stats["errors"] += 1
                if event.retry_count > 0:
                    pair_stats["retries"] += 1
                if event.fallback_from:
                    pair_stats["fallbacks"] += 1

        slow_nodes: list[NodeDiagnosticItem] = []
        error_nodes: list[NodeDiagnosticItem] = []
        congested_nodes: list[NodeDiagnosticItem] = []

        for node in nodes:
            stats = node_event_stats.get(node.id, {})
            event_count = int(stats.get("events", 0))
            latency_sum = float(stats.get("latency_sum", 0.0))
            avg_event_latency = latency_sum / event_count if event_count > 0 else 0.0
            metrics = node.metrics
            qps = float(metrics.qps if metrics else 0.0)
            p95 = float(metrics.p95_ms if metrics else 0.0)
            error_rate = float(metrics.error_rate if metrics else 0.0)
            queue_depth = int(metrics.queue_depth if metrics else 0)
            active_count = int(metrics.active_count if metrics else 0)
            trace_ids = sorted(set(stats.get("trace_ids", set())))[:6]

            slow_score = p95 + avg_event_latency
            err_score = (error_rate * 1000.0) + float(stats.get("errors", 0)) * 10.0
            congest_score = queue_depth * 20.0 + active_count * 4.0

            base_item = NodeDiagnosticItem(
                node_id=node.id,
                name=node.name,
                status=node.status,
                district_id=node.district_id,
                qps=qps,
                p95_ms=p95,
                error_rate=error_rate,
                queue_depth=queue_depth,
                active_count=active_count,
                score=0.0,
                reason="",
                recent_trace_ids=trace_ids,
            )

            if slow_score >= 450:
                slow_nodes.append(
                    base_item.model_copy(
                        update={
                            "score": round(slow_score, 2),
                            "reason": f"high latency (p95={p95:.1f}ms, runtime_avg={avg_event_latency:.1f}ms)",
                        }
                    )
                )
            if node.status == "error" or error_rate >= 0.04 or err_score >= 40:
                error_nodes.append(
                    base_item.model_copy(
                        update={
                            "score": round(err_score, 2),
                            "reason": f"error pressure (error_rate={error_rate:.3f}, events={stats.get('errors', 0)})",
                        }
                    )
                )
            if queue_depth >= 6 or congest_score >= 80:
                congested_nodes.append(
                    base_item.model_copy(
                        update={
                            "score": round(congest_score, 2),
                            "reason": f"queue congestion (queue={queue_depth}, active={active_count})",
                        }
                    )
                )

        slow_nodes.sort(key=lambda item: item.score, reverse=True)
        error_nodes.sort(key=lambda item: item.score, reverse=True)
        congested_nodes.sort(key=lambda item: item.score, reverse=True)

        edge_map = {
            (edge.from_node, edge.to_node): edge for edge in [*declared_edges, *observed_edges]
        }
        unstable_edges: list[EdgeDiagnosticItem] = []

        for pair, stats in edge_event_stats.items():
            edge = edge_map.get(pair)
            avg_latency = stats["latency_sum"] / max(1, stats["count"])
            instability = (
                stats["errors"] * 30
                + stats["retries"] * 25
                + stats["fallbacks"] * 25
                + avg_latency / 25
            )
            if instability < 55:
                continue

            unstable_edges.append(
                EdgeDiagnosticItem(
                    edge_id=edge.id if edge else f"edge.runtime.{pair[0]}.{pair[1]}",
                    from_node=pair[0],
                    to_node=pair[1],
                    kind=edge.kind.value if edge else "observed",
                    protocol=edge.protocol if edge else "internal/http+json",
                    status=edge.status if edge else "observed",
                    observed_count=int(stats["count"]),
                    error_count=int(stats["errors"]),
                    retry_count=int(stats["retries"]),
                    fallback_count=int(stats["fallbacks"]),
                    avg_latency_ms=round(avg_latency, 2),
                    score=round(instability, 2),
                    reason="high retry/fallback/error activity on runtime edge",
                )
            )

        unstable_edges.sort(key=lambda item: item.score, reverse=True)

        inferred_edges = [
            edge
            for edge in observed_edges
            if edge.status == "observed" or edge.id.startswith("edge.inferred.")
        ]
        notes = []
        if not unstable_edges:
            notes.append("No unstable edges exceed alert threshold in current runtime window.")
        if not error_nodes:
            notes.append("No error-dominant nodes detected in current runtime window.")
        if not events:
            notes.append("Diagnostics currently based on static metrics only; no live events captured yet.")

        return DiagnosticsSummary(
            generated_at=datetime.now(timezone.utc),
            target=target,
            active_trace_count=len(active_trace_ids),
            total_nodes=len(nodes),
            total_edges=len(declared_edges) + len(observed_edges),
            inferred_edge_count=len(inferred_edges),
            retry_event_count=retry_event_count,
            fallback_event_count=fallback_event_count,
            error_event_count=error_event_count,
            slow_nodes=slow_nodes[:10],
            error_nodes=error_nodes[:10],
            congested_nodes=congested_nodes[:10],
            unstable_edges=unstable_edges[:12],
            notes=notes,
        )

    def get_parser_analysis_report(self, target: str = "mock") -> ParserAnalysisReport:
        with self._lock:
            if target not in self._contexts:
                raise ValueError(f"unknown target: {target}")
            context = self._contexts[target]
            topology = context.topology.model_copy(deep=True)
            observed_edges = list(context.observed_edges.values())
            recent_jobs = [
                job.to_model()
                for job in reversed([self._parse_jobs[job_id] for job_id in self._parse_job_order[-30:]])
                if (job.target_id == target or Path(job.repo_path).resolve() == Path(context.repo_path).resolve())
            ]

        parser_conf = float(topology.metadata.get("parser_confidence", 0.5) or 0.5)
        parser_grade = str(topology.metadata.get("parser_grade", "C"))
        source_coverage = dict(topology.metadata.get("source_coverage", {}))
        unresolved_symbols = list(topology.metadata.get("unresolved_symbols", []))

        role_counts: dict[str, int] = {}
        district_counts: dict[str, int] = {}
        provisional_count = 0
        for node in topology.nodes:
            role = str(node.metadata.get("role", node.type.value))
            role_counts[role] = role_counts.get(role, 0) + 1
            district_counts[node.district_id] = district_counts.get(node.district_id, 0) + 1
            if node.metadata.get("synthetic"):
                provisional_count += 1

        declared_edge_count = len(topology.edges)
        observed_edge_count = len(observed_edges)
        inferred_edges = [
            edge
            for edge in observed_edges
            if edge.id.startswith("edge.inferred.") or edge.status == "observed"
        ]
        low_confidence_edges = [
            edge for edge in [*topology.edges, *observed_edges] if edge.confidence < 0.66
        ]

        issues: list[ParserAnalysisIssue] = []
        if parser_conf < 0.72:
            issues.append(
                ParserAnalysisIssue(
                    severity="high",
                    category="confidence",
                    title="Parser confidence is below production threshold",
                    detail=f"Confidence={parser_conf:.3f}, grade={parser_grade}",
                    suggestion="Inspect unresolved symbols and add language-specific registry/decorator rules.",
                )
            )
        if unresolved_symbols:
            issues.append(
                ParserAnalysisIssue(
                    severity="medium",
                    category="coverage",
                    title="Unresolved symbols detected",
                    detail="; ".join(unresolved_symbols[:6]),
                    suggestion="Add parser helpers for unresolved patterns and preserve as provisional nodes.",
                )
            )
        missing_sources = [key for key, value in source_coverage.items() if not value]
        if missing_sources:
            issues.append(
                ParserAnalysisIssue(
                    severity="medium",
                    category="source-coverage",
                    title="Parsing sources are incomplete",
                    detail=f"Missing evidence from: {', '.join(missing_sources)}",
                    suggestion="Expand discovery to include config/registry/examples in detected language.",
                )
            )
        if provisional_count > 0:
            issues.append(
                ParserAnalysisIssue(
                    severity="low",
                    category="graceful-degradation",
                    title="Provisional topology nodes present",
                    detail=f"{provisional_count} provisional nodes were synthesized from unresolved relations.",
                    suggestion="Map these provisional endpoints to concrete modules once signatures are known.",
                )
            )
        if len(inferred_edges) > 0:
            issues.append(
                ParserAnalysisIssue(
                    severity="low",
                    category="runtime-diff",
                    title="Runtime inferred edges differ from static graph",
                    detail=f"{len(inferred_edges)} runtime-only inferred edges observed.",
                    suggestion="Review runtime-only links and promote stable ones into declared topology rules.",
                )
            )

        return ParserAnalysisReport(
            generated_at=datetime.now(timezone.utc),
            target=target,
            parser_confidence=round(parser_conf, 3),
            parser_grade=parser_grade,
            source_coverage=source_coverage,
            unresolved_symbols=unresolved_symbols,
            provisional_node_count=provisional_count,
            declared_edge_count=declared_edge_count,
            observed_edge_count=observed_edge_count,
            inferred_edge_count=len(inferred_edges),
            role_coverage=[
                CoveragePoint(label=role, count=count)
                for role, count in sorted(role_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
            district_coverage=[
                CoveragePoint(label=district, count=count)
                for district, count in sorted(district_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
            low_confidence_edges=low_confidence_edges[:20],
            recent_parse_jobs=recent_jobs[:10],
            issues=issues,
        )

    def export_analysis_report(self, target: str = "mock") -> AnalysisReportExport:
        diagnostics = self.get_diagnostics_summary(target=target)
        parser_report = self.get_parser_analysis_report(target=target)

        lines = [
            f"# Agent_City Analysis Report ({target})",
            "",
            f"- Generated at: {datetime.now(timezone.utc).isoformat()}",
            f"- Parser confidence: {parser_report.parser_confidence:.3f} ({parser_report.parser_grade})",
            f"- Active traces: {diagnostics.active_trace_count}",
            f"- Total nodes/edges: {diagnostics.total_nodes}/{diagnostics.total_edges}",
            "",
            "## Parser Issues",
        ]
        if parser_report.issues:
            for issue in parser_report.issues:
                lines.extend(
                    [
                        f"- [{issue.severity.upper()}] {issue.title}",
                        f"  - category: {issue.category}",
                        f"  - detail: {issue.detail}",
                        f"  - suggestion: {issue.suggestion}",
                    ]
                )
        else:
            lines.append("- No parser issues were flagged.")

        lines.extend(["", "## Diagnostics Highlights"])
        if diagnostics.error_nodes:
            lines.append("- Error nodes:")
            for item in diagnostics.error_nodes[:5]:
                lines.append(
                    f"  - {item.name} ({item.node_id}) | score={item.score:.2f} | {item.reason}"
                )
        else:
            lines.append("- No critical error nodes.")

        if diagnostics.unstable_edges:
            lines.append("- Unstable edges:")
            for edge in diagnostics.unstable_edges[:6]:
                lines.append(
                    f"  - {edge.from_node} -> {edge.to_node} | retries={edge.retry_count} "
                    f"fallbacks={edge.fallback_count} errors={edge.error_count} avg={edge.avg_latency_ms:.1f}ms"
                )
        else:
            lines.append("- No unstable edges above threshold.")

        lines.extend(["", "## Suggested Next Actions"])
        if parser_report.parser_confidence < 0.8:
            lines.append("- Increase parser confidence by adding framework-specific language rules.")
        if diagnostics.retry_event_count > 0 or diagnostics.fallback_event_count > 0:
            lines.append("- Investigate retry/fallback hotspots and harden tool/mcp execution policy.")
        if diagnostics.congested_nodes:
            lines.append("- Reduce queue depth for congested nodes via batching, concurrency limit, or caching.")
        if len(lines) > 0 and lines[-1] == "## Suggested Next Actions":
            lines.append("- Current system health is stable; continue monitoring runtime drift.")

        return AnalysisReportExport(
            target=target,
            generated_at=datetime.now(timezone.utc),
            markdown="\n".join(lines) + "\n",
        )

    def _get_context_unlocked(self, target: str) -> PlatformContext:
        if target in self._contexts:
            return self._contexts[target]
        if "mock" in self._contexts:
            return self._contexts["mock"]
        return next(iter(self._contexts.values()))

    def _find_target_by_repo_path_unlocked(self, repo_path: str) -> str | None:
        normalized = str(Path(repo_path).resolve())
        for target_id, context in self._contexts.items():
            if str(Path(context.repo_path).resolve()) == normalized:
                return target_id
        return None

    def _init_contexts(self) -> None:
        self._contexts["mock"] = self._create_context(
            target="mock",
            label="Mock Architecture",
            source_type="mock",
            repo_path=str(self._project_root),
            source=MockTopologySource(),
            progress_cb=None,
        )

        claude_path = self._workspace_root / "claude-code-src-main"
        if claude_path.exists():
            self._contexts["claude"] = self._create_context(
                target="claude",
                label="Claude Code Source",
                source_type="repo_scan",
                repo_path=str(claude_path),
                source=RepositoryTopologySource(claude_path, target_hint="claude"),
                progress_cb=None,
            )

        codex_path = self._workspace_root / "codex-main"
        if codex_path.exists():
            self._contexts["codex"] = self._create_context(
                target="codex",
                label="Codex Source",
                source_type="cargo_workspace",
                repo_path=str(codex_path),
                source=RepositoryTopologySource(codex_path, target_hint="codex"),
                progress_cb=None,
            )

        if len(self._contexts) == 1:
            self._contexts["project"] = self._create_context(
                target="project",
                label="Current Project (Intelligent)",
                source_type="intelligent_repo_scan",
                repo_path=str(self._project_root),
                source=IntelligentTopologySource(self._project_root, target_hint="project"),
                progress_cb=None,
            )

    def _create_context(
        self,
        target: str,
        label: str,
        source_type: str,
        repo_path: str,
        source: TopologySignalSource,
        progress_cb: ProgressCallback | None,
    ) -> PlatformContext:
        if progress_cb:
            progress_cb(22, "discovery", "discovering topology signals")

        discovery = TopologyDiscovery(source)
        discovery_result = discovery.discover()

        if progress_cb:
            progress_cb(48, "normalization", "normalizing topology into city schema")

        normalizer = TopologyNormalizer()
        topology = normalizer.normalize(discovery_result)

        if progress_cb:
            progress_cb(68, "runtime", "building runtime resolver and binding")

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

        if progress_cb:
            progress_cb(84, "seeding", "seeding runtime traces and metrics")

        self._refresh_node_metrics(context)
        self._seed_initial_traces(context, 14)

        if progress_cb:
            progress_cb(95, "finalizing", "finalizing topology context")

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
            self._register_bound_trace_unlocked(context, bound)

    def _register_bound_trace_unlocked(self, context: PlatformContext, bound: BoundTrace) -> None:
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

    def _discover_ingest_candidates(self) -> list[Path]:
        if not self._ingest_root.exists():
            return []

        with self._lock:
            known_paths = {str(Path(context.repo_path).resolve()) for context in self._contexts.values()}
            known_paths.update(
                str(Path(job.repo_path).resolve())
                for job in self._parse_jobs.values()
            )

        candidates: list[Path] = []
        for entry in sorted(self._ingest_root.iterdir(), key=lambda item: item.name.lower()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue

            resolved = str(entry.resolve())
            if resolved in known_paths:
                continue

            candidates.append(entry.resolve())

        return candidates

    def _create_parse_job(self, repo_path: Path, source: str) -> ParseJobState:
        now = datetime.now(timezone.utc)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", repo_path.name.lower()).strip("_") or "repo"
        job_id = f"parse_{safe_name}_{now.strftime('%Y%m%d%H%M%S%f')}"

        job = ParseJobState(
            id=job_id,
            source=source,
            repo_path=str(repo_path),
            repo_name=repo_path.name,
            status=ParseJobStatus.QUEUED,
            progress=0,
            step="queued",
            message="repository detected and queued",
            created_at=now,
        )

        with self._lock:
            self._parse_jobs[job_id] = job
            self._parse_job_order.append(job_id)

        return job

    def _run_parse_job(self, job_id: str) -> None:
        with self._lock:
            job = self._parse_jobs.get(job_id)
            if job is None:
                return
            repo_path = Path(job.repo_path).resolve()
            repo_name = job.repo_name

        existing_target: str | None
        with self._lock:
            existing_target = self._find_target_by_repo_path_unlocked(str(repo_path))

        if existing_target:
            self._update_parse_job(
                job_id,
                status=ParseJobStatus.COMPLETED,
                progress=100,
                step="completed",
                message="repository already available as target",
                target_id=existing_target,
                started_at=datetime.now(timezone.utc),
                ended_at=datetime.now(timezone.utc),
            )
            return

        self._update_parse_job(
            job_id,
            status=ParseJobStatus.RUNNING,
            progress=6,
            step="starting",
            message="starting topology parsing",
            started_at=datetime.now(timezone.utc),
        )

        def progress(percent: int, step: str, message: str | None) -> None:
            self._update_parse_job(
                job_id,
                progress=percent,
                step=step,
                message=message,
            )

        request = RegisterTargetRequest(
            repo_path=str(repo_path),
            target_id=None,
            label=f"Auto: {repo_name}",
            force=False,
        )

        try:
            target = self.register_repository_target(request, progress_cb=progress)
            self._update_parse_job(
                job_id,
                status=ParseJobStatus.COMPLETED,
                progress=100,
                step="completed",
                message=f"parsed successfully: {target['label']}",
                target_id=target["id"],
                ended_at=datetime.now(timezone.utc),
                error=None,
            )
        except Exception as exc:
            self._update_parse_job(
                job_id,
                status=ParseJobStatus.FAILED,
                progress=100,
                step="failed",
                message="parsing failed",
                error=str(exc),
                ended_at=datetime.now(timezone.utc),
            )

    def _update_parse_job(
        self,
        job_id: str,
        *,
        status: ParseJobStatus | None = None,
        progress: int | None = None,
        step: str | None = None,
        message: str | None = None,
        error: str | None = None,
        target_id: str | None = None,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
    ) -> None:
        with self._lock:
            job = self._parse_jobs.get(job_id)
            if job is None:
                return

            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = max(0, min(100, progress))
            if step is not None:
                job.step = step
            if message is not None:
                job.message = message
            if error is not None:
                job.error = error
            if target_id is not None:
                job.target_id = target_id
            if started_at is not None:
                job.started_at = started_at
            if ended_at is not None:
                job.ended_at = ended_at

            if status is ParseJobStatus.FAILED and not job.error:
                job.error = "unknown parser error"
