from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_platform_service
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/api", tags=["nodes"])


@router.get("/nodes/{node_id}")
def get_node(node_id: str, service: PlatformService = Depends(get_platform_service)) -> dict:
    node = service.get_node(node_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"node not found: {node_id}")
    return node.model_dump(mode="json")
