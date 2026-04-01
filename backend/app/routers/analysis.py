from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/diagnostics")
def get_diagnostics(
    target: str = Query(default="mock"),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    try:
        summary = service.get_diagnostics_summary(target=target)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return summary.model_dump(by_alias=True, mode="json")


@router.get("/parser")
def get_parser_analysis(
    target: str = Query(default="mock"),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    try:
        report = service.get_parser_analysis_report(target=target)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return report.model_dump(by_alias=True, mode="json")


@router.get("/report")
def export_report(
    target: str = Query(default="mock"),
    fmt: str = Query(default="markdown"),
    service: PlatformService = Depends(get_platform_service),
):
    try:
        report = service.export_analysis_report(target=target)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if fmt == "json":
        return report.model_dump(by_alias=True, mode="json")
    if fmt != "markdown":
        raise HTTPException(status_code=400, detail=f"unsupported format: {fmt}")

    return PlainTextResponse(report.markdown, media_type="text/markdown; charset=utf-8")
