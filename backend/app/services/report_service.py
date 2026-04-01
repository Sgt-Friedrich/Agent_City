from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import ReportArtifact, ReportContent


@dataclass(frozen=True)
class ReportSpec:
    id: str
    title: str
    category: str
    file_name: str


class ReportService:
    """Catalog and read report artifacts under the local docs workspace."""

    def __init__(self) -> None:
        self._project_root = Path(__file__).resolve().parents[3]
        self._docs_root = self._project_root / "docs"

        self._catalog: tuple[ReportSpec, ...] = (
            ReportSpec(
                id="architecture",
                title="System Architecture",
                category="architecture",
                file_name="architecture.md",
            ),
            ReportSpec(
                id="product-ux",
                title="Product UX Design",
                category="ux",
                file_name="product-ux.md",
            ),
            ReportSpec(
                id="app-workbench-design",
                title="App Workbench Design",
                category="ux",
                file_name="app-workbench-design.md",
            ),
            ReportSpec(
                id="parser-test-plan",
                title="Parser Test Plan",
                category="parser",
                file_name="parser-test-plan.md",
            ),
            ReportSpec(
                id="parser-test-results",
                title="Parser Test Results",
                category="parser",
                file_name="parser-test-results.md",
            ),
            ReportSpec(
                id="parser-capability-summary",
                title="Parser Capability Summary",
                category="parser",
                file_name="parser-capability-summary.md",
            ),
            ReportSpec(
                id="parser-regression-summary",
                title="Parser Regression Summary",
                category="parser",
                file_name="parser-regression-summary.md",
            ),
            ReportSpec(
                id="parser-fix-report",
                title="Parser Fix Report",
                category="parser",
                file_name="parser-fix-report.md",
            ),
            ReportSpec(
                id="parser-fix-report-template",
                title="Parser Fix Report Template",
                category="parser",
                file_name="parser-fix-report-template.md",
            ),
            ReportSpec(
                id="frontend-debug-playbook",
                title="App UI Debug Playbook",
                category="frontend",
                file_name="frontend-debug-playbook.md",
            ),
            ReportSpec(
                id="frontend-fix-report",
                title="App UI Fix Report",
                category="frontend",
                file_name="frontend-fix-report.md",
            ),
            ReportSpec(
                id="frontend-fix-report-template",
                title="App UI Fix Report Template",
                category="frontend",
                file_name="frontend-fix-report-template.md",
            ),
            ReportSpec(
                id="frontend-e2e-test-report",
                title="App UI Automation Test Report",
                category="frontend",
                file_name="frontend-e2e-test-report.md",
            ),
            ReportSpec(
                id="full-system-test-report",
                title="Full System Test Report",
                category="system",
                file_name="full-system-test-report.md",
            ),
            ReportSpec(
                id="reference-notes",
                title="Reference Notes and Cleanup Log",
                category="operations",
                file_name="reference-notes.md",
            ),
        )

    @property
    def docs_root(self) -> Path:
        return self._docs_root

    def list_reports(self, category: str | None = None) -> list[ReportArtifact]:
        artifacts: list[ReportArtifact] = []
        for spec in self._catalog:
            if category and spec.category != category:
                continue
            path = self._docs_root / spec.file_name
            if not path.exists() or not path.is_file():
                continue
            stat = path.stat()
            artifacts.append(
                ReportArtifact(
                    id=spec.id,
                    title=spec.title,
                    category=spec.category,
                    file_name=spec.file_name,
                    absolute_path=str(path.resolve()),
                    size_bytes=stat.st_size,
                    updated_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
                )
            )
        return sorted(artifacts, key=lambda artifact: (artifact.category, artifact.title))

    def read_report(self, report_id: str) -> ReportContent | None:
        artifact = next((item for item in self.list_reports() if item.id == report_id), None)
        if artifact is None:
            return None

        content = Path(artifact.absolute_path).read_text(encoding="utf-8")
        return ReportContent(artifact=artifact, content=content)
