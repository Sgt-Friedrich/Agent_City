from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from app.models.schemas import (
    BoundTrace,
    Edge,
    MetricSummary,
    Node,
    ParseJob,
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
