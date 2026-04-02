from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_platform_service
from app.models.schemas import PreviewTargetRequest, RegisterTargetRequest
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["topology"])


@router.get("/targets")
def list_targets(service: PlatformService = Depends(get_platform_service)) -> dict:
    return {"items": service.list_targets()}


@router.post("/targets/register")
def register_target(
    payload: RegisterTargetRequest,
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    try:
        target = service.register_repository_target(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"target": target}


@router.post("/targets/preview")
def preview_target(
    payload: PreviewTargetRequest,
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    try:
        preview = service.preview_repository_target(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"preview": preview.model_dump(mode="json")}


@router.get("/topology")
def get_topology(
    target: str = Query(default="mock"),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    topology = service.get_topology(target=target)
    payload = topology.model_dump(by_alias=True, mode="json")
    payload["target"] = target
    return payload
