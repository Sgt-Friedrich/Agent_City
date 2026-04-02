from __future__ import annotations

import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from app.models.schemas import (
    AppRuntimeStatus,
    JobRecord,
    JobRunRequest,
    JobStatus,
    JobType,
    ParseJobStatus,
    RegisterTargetRequest,
    RepositoryRecord,
    RepositoryStatus,
    UpdateSettingsRequest,
)
from app.services.platform_service import PlatformService
from app.services.report_service import ReportService
from app.services.settings_service import SettingsService


class ControlPlaneService:
    """Control-plane orchestration for repositories, jobs, reports and settings."""

    def __init__(
        self,
        platform_service: PlatformService,
        report_service: ReportService,
        settings_service: SettingsService,
    ) -> None:
        self._platform = platform_service
        self._reports = report_service
        self._settings = settings_service
        self._lock = RLock()
        self._jobs: dict[str, JobRecord] = {}
        self._job_order: list[str] = []
        self._cancel_requested: set[str] = set()
        self._executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="agent_city_jobs")
        self._project_root = Path(__file__).resolve().parents[3]

    # -----------------------------
    # repositories
    # -----------------------------
    def list_repositories(self) -> list[RepositoryRecord]:
        targets = self._platform.list_targets()
        parse_jobs = self._platform.list_parse_jobs(limit=200)
        parse_by_target: dict[str, list[Any]] = {}
        for job in parse_jobs:
            if job.target_id:
                parse_by_target.setdefault(job.target_id, []).append(job)

        records: list[RepositoryRecord] = []
        for target in targets:
            target_id = target["id"]
            parser_report = self._safe_parser_report(target_id)
            inferred = self._safe_diagnostics(target_id).get("inferred_edge_count", 0)
            recent_jobs = parse_by_target.get(target_id, [])
            last_done = next(
                (
                    item
                    for item in recent_jobs
                    if item.status in {ParseJobStatus.COMPLETED, ParseJobStatus.FAILED}
                ),
                None,
            )

            repo_name = Path(target.get("repo_path", "")).name or target["label"]
            status = RepositoryStatus.READY
            if any(item.status in {ParseJobStatus.QUEUED, ParseJobStatus.RUNNING} for item in recent_jobs):
                status = RepositoryStatus.PARSING
            elif last_done and last_done.status == ParseJobStatus.FAILED:
                status = RepositoryStatus.FAILED
            elif parser_report is None:
                status = RepositoryStatus.IDLE

            languages = self._guess_languages_from_path(target.get("repo_path", ""))
            domain = self._guess_domain(target.get("source_type", ""), parser_report or {})

            records.append(
                RepositoryRecord(
                    id=f"repo_{target_id}",
                    name=repo_name,
                    path=target.get("repo_path", ""),
                    target_id=target_id,
                    source_type=target.get("source_type", "unknown"),
                    languages=languages,
                    domain=domain,
                    parser_confidence=float((parser_report or {}).get("parser_confidence", 0.0)),
                    parser_grade=str((parser_report or {}).get("parser_grade", "N/A")),
                    unresolved_count=len((parser_report or {}).get("unresolved_symbols", [])),
                    inferred_edge_count=int(inferred),
                    node_count=int(target.get("node_count", 0)),
                    edge_count=int(target.get("edge_count", 0)),
                    status=status,
                    last_parsed_at=getattr(last_done, "ended_at", None),
                    metadata={
                        "label": target.get("label"),
                        "recent_parse_job_id": getattr(last_done, "id", None),
                    },
                )
            )

        return sorted(records, key=lambda item: (item.status.value, item.name))

    def remove_repository(self, target_id: str) -> bool:
        return self._platform.remove_target(target_id)

    # -----------------------------
    # jobs
    # -----------------------------
    def list_jobs(self, limit: int = 120) -> list[JobRecord]:
        with self._lock:
            ids = self._job_order[-limit:]
            return [self._jobs[job_id].model_copy(deep=True) for job_id in reversed(ids)]

    def run_job(self, request: JobRunRequest) -> JobRecord:
        job_id = f"job_{request.type.value}_{uuid.uuid4().hex[:10]}"
        job = JobRecord(
            id=job_id,
            type=request.type,
            target=request.target,
            status=JobStatus.QUEUED,
            progress=0,
            started_at=None,
            ended_at=None,
            log_summary="queued",
            detail_output="",
            metadata=request.payload,
        )
        with self._lock:
            self._jobs[job_id] = job
            self._job_order.append(job_id)

        self._executor.submit(self._execute_job, job_id, request)
        return job.model_copy(deep=True)

    def cancel_job(self, job_id: str) -> JobRecord | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            if job.status in {JobStatus.SUCCESS, JobStatus.FAILED, JobStatus.CANCELLED}:
                return job.model_copy(deep=True)
            self._cancel_requested.add(job_id)
            job.status = JobStatus.CANCELLED
            job.ended_at = datetime.now(timezone.utc)
            job.log_summary = "cancel requested"
            self._jobs[job_id] = job
            return job.model_copy(deep=True)

    # -----------------------------
    # settings/runtime
    # -----------------------------
    def get_settings(self):
        return self._settings.get()

    def update_settings(self, patch: UpdateSettingsRequest):
        return self._settings.update(patch)

    def get_runtime_status(self) -> AppRuntimeStatus:
        parse_jobs = self._platform.list_parse_jobs(limit=200)
        jobs = self.list_jobs(limit=200)
        active_jobs = [job for job in jobs if job.status in {JobStatus.QUEUED, JobStatus.RUNNING}]
        last_job = jobs[0].id if jobs else None
        repo_count = len(self.list_repositories())

        notes = []
        if active_jobs:
            notes.append(f"{len(active_jobs)} control jobs running")
        if any(job.status == JobStatus.FAILED for job in jobs[:10]):
            notes.append("recent control jobs include failures")
        if any(item.status == ParseJobStatus.FAILED for item in parse_jobs[:10]):
            notes.append("recent parse jobs include failures")

        return AppRuntimeStatus(
            generated_at=datetime.now(timezone.utc),
            backend_ready=True,
            target_count=len(self._platform.list_targets()),
            repository_count=repo_count,
            active_job_count=len(active_jobs),
            parse_job_count=len(parse_jobs),
            last_job_id=last_job,
            notes=notes,
        )

    # -----------------------------
    # internals
    # -----------------------------
    def _execute_job(self, job_id: str, request: JobRunRequest) -> None:
        self._update_job(
            job_id,
            status=JobStatus.RUNNING,
            progress=5,
            started_at=datetime.now(timezone.utc),
            log_summary="running",
        )

        try:
            if self._is_cancelled(job_id):
                return

            if request.type == JobType.PARSE_REPOSITORY:
                self._run_parse_repository(job_id, request)
            elif request.type == JobType.REPARSE_REPOSITORY:
                self._run_reparse_repository(job_id, request)
            elif request.type == JobType.PARSER_REGRESSION:
                self._run_shell_job(
                    job_id,
                    ["python", "scripts/run_parser_regression.py"],
                    "parser regression finished",
                )
            elif request.type == JobType.FRONTEND_SELF_CHECK:
                self._run_shell_job(
                    job_id,
                    ["npm", "--prefix", "frontend", "run", "e2e:app"],
                    "frontend self-check finished",
                )
            elif request.type == JobType.FULL_SYSTEM_TEST:
                self._run_shell_job(
                    job_id,
                    ["python", "scripts/run_full_system_tests.py"],
                    "full system test finished",
                )
            elif request.type == JobType.GENERATE_REPORT:
                self._run_generate_report(job_id, request)
            elif request.type == JobType.CLEANUP_REFS:
                self._run_cleanup(job_id, request)
            elif request.type == JobType.LIVE_SIMULATION:
                self._run_live_simulation(job_id, request)
            else:
                raise ValueError(f"unsupported job type: {request.type}")

            if not self._is_cancelled(job_id):
                self._update_job(
                    job_id,
                    status=JobStatus.SUCCESS,
                    progress=100,
                    ended_at=datetime.now(timezone.utc),
                )
        except Exception as exc:
            self._update_job(
                job_id,
                status=JobStatus.FAILED,
                progress=100,
                ended_at=datetime.now(timezone.utc),
                log_summary=str(exc),
                detail_output=str(exc),
            )

    def _run_parse_repository(self, job_id: str, request: JobRunRequest) -> None:
        repo_path = request.payload.get("repo_path")
        if not isinstance(repo_path, str) or not repo_path.strip():
            raise ValueError("payload.repo_path is required for parse_repository")

        label = request.payload.get("label")
        target_id = request.payload.get("target_id")

        def progress_cb(percent: int, step: str, message: str | None) -> None:
            self._update_job(
                job_id,
                progress=percent,
                log_summary=f"{step}: {message or ''}".strip(": "),
            )

        target = self._platform.register_repository_target(
            RegisterTargetRequest(
                repo_path=repo_path,
                label=label if isinstance(label, str) else None,
                target_id=target_id if isinstance(target_id, str) else None,
                force=bool(request.payload.get("force", False)),
            ),
            progress_cb=progress_cb,
        )

        self._update_job(
            job_id,
            progress=96,
            target=target["id"],
            log_summary=f"parsed target {target['id']}",
            detail_output=f"repository parsed: {target}",
        )

    def _run_reparse_repository(self, job_id: str, request: JobRunRequest) -> None:
        target_id = request.target or (request.payload.get("target_id") if isinstance(request.payload.get("target_id"), str) else None)
        if not target_id:
            raise ValueError("target is required for reparse_repository")

        targets = {item["id"]: item for item in self._platform.list_targets()}
        target = targets.get(target_id)
        if not target:
            raise ValueError(f"target not found: {target_id}")

        def progress_cb(percent: int, step: str, message: str | None) -> None:
            self._update_job(
                job_id,
                progress=percent,
                target=target_id,
                log_summary=f"{step}: {message or ''}".strip(": "),
            )

        result = self._platform.register_repository_target(
            RegisterTargetRequest(
                repo_path=target["repo_path"],
                label=target["label"],
                target_id=target_id,
                force=True,
            ),
            progress_cb=progress_cb,
        )
        self._update_job(
            job_id,
            target=target_id,
            progress=96,
            log_summary=f"re-parsed target {target_id}",
            detail_output=f"reparse result: {result}",
        )

    def _run_shell_job(self, job_id: str, command: list[str], success_message: str) -> None:
        self._update_job(job_id, progress=12, log_summary=f"running command: {' '.join(command)}")
        completed = subprocess.run(
            command,
            cwd=self._project_root,
            capture_output=True,
            text=True,
            timeout=40 * 60,
            shell=False,
        )
        output = (completed.stdout or "") + ("\n" + completed.stderr if completed.stderr else "")
        summary = output.strip().splitlines()[-1] if output.strip() else "command completed"

        if completed.returncode != 0:
            raise RuntimeError(
                f"command failed ({completed.returncode}): {' '.join(command)}\n{summary}"
            )

        self._update_job(
            job_id,
            progress=94,
            detail_output=output[-15000:],
            log_summary=success_message,
        )

    def _run_generate_report(self, job_id: str, request: JobRunRequest) -> None:
        target = request.target or "mock"
        self._update_job(job_id, progress=25, target=target, log_summary="exporting analysis report")
        report = self._platform.export_analysis_report(target=target)
        export_dir = Path(self._settings.get().export_dir or (self._project_root / "docs"))
        export_dir.mkdir(parents=True, exist_ok=True)
        path = export_dir / f"agent_city_analysis_{target}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.md"
        path.write_text(report.markdown, encoding="utf-8")
        self._update_job(
            job_id,
            progress=96,
            target=target,
            artifact_path=str(path),
            log_summary="analysis report generated",
            detail_output=str(path),
        )

    def _run_cleanup(self, job_id: str, request: JobRunRequest) -> None:
        threshold = request.payload.get("threshold_mb")
        if not isinstance(threshold, (int, float)):
            threshold = self._settings.get().cleanup_threshold_mb
        command = [
            "python",
            "scripts/cleanup_refs.py",
            "--root",
            ".",
            "--threshold-mb",
            str(float(threshold)),
            "--delete-unlisted",
        ]
        self._run_shell_job(job_id, command, "cleanup refs finished")

    def _run_live_simulation(self, job_id: str, request: JobRunRequest) -> None:
        target = request.target or "mock"
        count = int(request.payload.get("count", 6))
        count = max(1, min(count, 40))
        for index in range(count):
            if self._is_cancelled(job_id):
                return
            self._platform.generate_live_trace(target=target)
            self._update_job(
                job_id,
                target=target,
                progress=int(18 + ((index + 1) / count) * 72),
                log_summary=f"generated simulation trace {index + 1}/{count}",
            )
        self._update_job(job_id, target=target, detail_output=f"generated {count} traces")

    def _update_job(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        target: str | None = None,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
        log_summary: str | None = None,
        detail_output: str | None = None,
        artifact_path: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = max(0, min(100, progress))
            if target is not None:
                job.target = target
            if started_at is not None:
                job.started_at = started_at
            if ended_at is not None:
                job.ended_at = ended_at
            if log_summary is not None:
                job.log_summary = log_summary[:300]
            if detail_output is not None:
                job.detail_output = detail_output[-20000:]
            if artifact_path is not None:
                job.artifact_path = artifact_path
            self._jobs[job_id] = job

    def _is_cancelled(self, job_id: str) -> bool:
        with self._lock:
            return job_id in self._cancel_requested

    def _safe_parser_report(self, target_id: str) -> dict[str, Any] | None:
        try:
            return self._platform.get_parser_analysis_report(target_id).model_dump(mode="json")
        except Exception:
            return None

    def _safe_diagnostics(self, target_id: str) -> dict[str, Any]:
        try:
            return self._platform.get_diagnostics_summary(target_id).model_dump(mode="json")
        except Exception:
            return {}

    @staticmethod
    def _guess_languages_from_path(path_text: str) -> list[str]:
        path = Path(path_text)
        hints: list[str] = []
        if (path / "pyproject.toml").exists() or (path / "requirements.txt").exists():
            hints.append("Python")
        if (path / "package.json").exists() or (path / "tsconfig.json").exists():
            hints.append("TypeScript")
        if (path / "go.mod").exists():
            hints.append("Go")
        if (path / "Cargo.toml").exists():
            hints.append("Rust")
        if (path / "pom.xml").exists() or (path / "build.gradle").exists() or (path / "build.gradle.kts").exists():
            hints.append("Java/JVM")
        return hints or ["Unknown"]

    @staticmethod
    def _guess_domain(source_type: str, parser_report: dict[str, Any]) -> str:
        role_labels = [item.get("label", "") for item in parser_report.get("role_coverage", [])]
        role_blob = " ".join(role_labels).lower()
        source = (source_type or "").lower()
        if "cargo" in source or "repo_scan" in source:
            return "coding_agent"
        if "retriever" in role_blob or "memory" in role_blob:
            return "rag_orchestration"
        if "tool" in role_blob or "mcp" in role_blob:
            return "tool_heavy_agent"
        return "general_agent"

