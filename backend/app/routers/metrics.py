from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics/summary")
def get_summary(service: PlatformService = Depends(get_platform_service)) -> dict:
    summary = service.get_metrics_summary()
    return summary.model_dump(mode="json")
