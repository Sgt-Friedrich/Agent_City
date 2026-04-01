from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics/summary")
def get_summary(
    target: str = Query(default="mock"),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    summary = service.get_metrics_summary(target=target)
    payload = summary.model_dump(mode="json")
    payload["target"] = target
    return payload
