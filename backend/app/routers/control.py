from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_control_plane_service
from app.models.schemas import JobRunRequest, UpdateSettingsRequest
from app.services.control_plane_service import ControlPlaneService

router = APIRouter(prefix="/api/control", tags=["control"])


@router.get("/repositories")
def list_repositories(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict:
    items = service.list_repositories()
    return {"items": [item.model_dump(mode="json") for item in items], "count": len(items)}


@router.delete("/repositories/{target_id}")
def remove_repository(
    target_id: str,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict:
    removed = service.remove_repository(target_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"repository not found or protected: {target_id}")
    return {"ok": True, "target_id": target_id}


@router.get("/jobs")
def list_jobs(
    limit: int = Query(default=120, ge=1, le=500),
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict:
    items = service.list_jobs(limit=limit)
    return {"items": [item.model_dump(mode="json") for item in items], "count": len(items)}


@router.post("/jobs")
def run_job(
    payload: JobRunRequest,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict:
    job = service.run_job(payload)
    return {"job": job.model_dump(mode="json")}


@router.post("/jobs/{job_id}/cancel")
def cancel_job(
    job_id: str,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict:
    job = service.cancel_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job not found: {job_id}")
    return {"job": job.model_dump(mode="json")}


@router.get("/settings")
def get_settings(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict:
    return {"settings": service.get_settings().model_dump(mode="json")}


@router.put("/settings")
def update_settings(
    payload: UpdateSettingsRequest,
    service: ControlPlaneService = Depends(get_control_plane_service),
) -> dict:
    settings = service.update_settings(payload)
    return {"settings": settings.model_dump(mode="json")}


@router.get("/runtime")
def runtime_status(service: ControlPlaneService = Depends(get_control_plane_service)) -> dict:
    status = service.get_runtime_status()
    return {"runtime": status.model_dump(mode="json")}

