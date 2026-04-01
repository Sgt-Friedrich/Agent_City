from __future__ import annotations

from functools import lru_cache

from app.services.platform_service import PlatformService
from app.services.report_service import ReportService


@lru_cache
def get_platform_service() -> PlatformService:
    return PlatformService()


@lru_cache
def get_report_service() -> ReportService:
    return ReportService()
