from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["parsing"])


@router.get("/parse-jobs")
def list_parse_jobs(
    limit: int = Query(default=40, ge=1, le=200),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    jobs = service.list_parse_jobs(limit=limit)
    return {
        "items": [job.model_dump(mode="json") for job in jobs],
        "drop_directory": service.get_ingest_directory(),
    }


@router.post("/parse-jobs/scan")
def scan_parse_jobs(service: PlatformService = Depends(get_platform_service)) -> dict:
    jobs = service.scan_ingest_directory()
    return {
        "started": [job.model_dump(mode="json") for job in jobs],
        "count": len(jobs),
        "drop_directory": service.get_ingest_directory(),
    }
