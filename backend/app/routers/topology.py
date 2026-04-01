from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["topology"])


@router.get("/topology")
def get_topology(service: PlatformService = Depends(get_platform_service)) -> dict:
    topology = service.get_topology()
    return topology.model_dump(by_alias=True, mode="json")
