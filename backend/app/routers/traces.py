from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["traces"])


@router.get("/traces")
def list_traces(
    limit: int = Query(default=50, ge=1, le=500),
    service: PlatformService = Depends(get_platform_service),
) -> dict:
    traces = service.list_traces(limit=limit)
    return {
        "items": [trace.model_dump(mode="json") for trace in traces],
        "count": len(traces),
    }


@router.get("/traces/{trace_id}")
def get_trace(trace_id: str, service: PlatformService = Depends(get_platform_service)) -> dict:
    bound = service.get_bound_trace(trace_id)
    if bound is None:
        raise HTTPException(status_code=404, detail=f"trace not found: {trace_id}")

    return {
        "trace": bound.trace.model_dump(mode="json"),
        "bindings": [item.model_dump(mode="json") for item in bound.bindings],
        "inferred_edges": [
            edge.model_dump(by_alias=True, mode="json") for edge in bound.inferred_edges
        ],
    }
