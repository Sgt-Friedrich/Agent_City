from __future__ import annotations

import json
from pathlib import Path
from threading import RLock

from app.models.schemas import AppSettings, UpdateSettingsRequest


class SettingsService:
    """Persist and serve desktop app settings for control plane."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._project_root = Path(__file__).resolve().parents[3]
        self._settings_path = self._project_root / "backend" / "app_settings.json"
        self._settings = self._load()

    @property
    def settings_path(self) -> Path:
        return self._settings_path

    def get(self) -> AppSettings:
        with self._lock:
            return self._settings.model_copy(deep=True)

    def update(self, patch: UpdateSettingsRequest) -> AppSettings:
        with self._lock:
            current = self._settings.model_dump()
            patch_data = patch.model_dump(exclude_none=True)
            for key, value in patch_data.items():
                current[key] = value
            self._settings = AppSettings.model_validate(current)
            self._save(self._settings)
            return self._settings.model_copy(deep=True)

    def _load(self) -> AppSettings:
        if not self._settings_path.exists():
            default = AppSettings(
                workspace_dir=str(self._project_root.resolve()),
                data_dir=str((self._project_root / "backend" / "sample_data").resolve()),
                export_dir=str((self._project_root / "docs").resolve()),
            )
            self._save(default)
            return default

        try:
            raw = json.loads(self._settings_path.read_text(encoding="utf-8"))
            return AppSettings.model_validate(raw)
        except Exception:
            fallback = AppSettings(
                workspace_dir=str(self._project_root.resolve()),
                data_dir=str((self._project_root / "backend" / "sample_data").resolve()),
                export_dir=str((self._project_root / "docs").resolve()),
            )
            self._save(fallback)
            return fallback

    def _save(self, settings: AppSettings) -> None:
        self._settings_path.parent.mkdir(parents=True, exist_ok=True)
        self._settings_path.write_text(
            json.dumps(settings.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

