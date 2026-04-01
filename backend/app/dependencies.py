from __future__ import annotations

from functools import lru_cache

from app.services.platform_service import PlatformService


@lru_cache
def get_platform_service() -> PlatformService:
    return PlatformService()
