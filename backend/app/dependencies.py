from __future__ import annotations

from functools import lru_cache

from app.services.control_plane_service import ControlPlaneService
from app.services.platform_service import PlatformService
from app.services.report_service import ReportService
from app.services.settings_service import SettingsService


@lru_cache
def get_platform_service() -> PlatformService:
    return PlatformService()


@lru_cache
def get_report_service() -> ReportService:
    return ReportService()


@lru_cache
def get_settings_service() -> SettingsService:
    return SettingsService()


@lru_cache
def get_control_plane_service() -> ControlPlaneService:
    return ControlPlaneService(
        platform_service=get_platform_service(),
        report_service=get_report_service(),
        settings_service=get_settings_service(),
    )
