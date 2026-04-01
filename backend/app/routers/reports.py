from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_report_service
from app.services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
def list_reports(
    category: str | None = Query(default=None),
    service: ReportService = Depends(get_report_service),
) -> dict:
    return {
        "items": [item.model_dump(mode="json") for item in service.list_reports(category=category)],
        "docs_root": str(service.docs_root.resolve()),
    }


@router.get("/{report_id}")
def get_report_content(
    report_id: str,
    service: ReportService = Depends(get_report_service),
) -> dict:
    report = service.read_report(report_id=report_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"report not found: {report_id}")

    return report.model_dump(mode="json")
