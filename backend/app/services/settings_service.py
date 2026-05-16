from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Any

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
            validated_payload = self._validate_payload(current)
            self._settings = AppSettings.model_validate(validated_payload)
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
            loaded = AppSettings.model_validate(raw)
            validated_payload = self._validate_payload(loaded.model_dump(mode="json"))
            normalized = AppSettings.model_validate(validated_payload)
            if normalized != loaded:
                self._save(normalized)
            return normalized
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

    def _validate_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        errors: list[str] = []
        normalized = dict(payload)

        def _normalize_abs_dir(key: str, *, must_exist: bool, create: bool = False) -> None:
            raw = str(normalized.get(key, "")).strip()
            if not raw:
                errors.append(f"{key}: value is required")
                return

            path = Path(raw).expanduser()
            if not path.is_absolute():
                errors.append(f"{key}: absolute path is required")
                return

            if must_exist and not path.exists():
                errors.append(f"{key}: path does not exist -> {path}")
                return

            if create:
                try:
                    path.mkdir(parents=True, exist_ok=True)
                except Exception as exc:
                    errors.append(f"{key}: failed to create directory -> {exc}")
                    return

            normalized[key] = str(path.resolve())

        _normalize_abs_dir("workspace_dir", must_exist=True, create=False)
        _normalize_abs_dir("data_dir", must_exist=True, create=False)
        _normalize_abs_dir("export_dir", must_exist=False, create=True)

        threshold_raw = normalized.get("cleanup_threshold_mb", 200.0)
        try:
            threshold = float(threshold_raw)
            if threshold < 50 or threshold > 5000:
                errors.append("cleanup_threshold_mb: must be between 50 and 5000")
            normalized["cleanup_threshold_mb"] = threshold
        except Exception:
            errors.append("cleanup_threshold_mb: invalid numeric value")

        live_mode_raw = normalized.get("live_flow_mode", "codex_real_only")
        if isinstance(live_mode_raw, str):
            live_mode = live_mode_raw.strip()
        elif hasattr(live_mode_raw, "value"):
            live_mode = str(getattr(live_mode_raw, "value")).strip()
        else:
            live_mode = str(live_mode_raw).strip()
        if live_mode not in {"always_simulated", "manual", "codex_real_only"}:
            errors.append("live_flow_mode: must be one of always_simulated/manual/codex_real_only")
        else:
            normalized["live_flow_mode"] = live_mode

        poll_raw = normalized.get("codex_activity_poll_sec", 1.8)
        try:
            poll_sec = float(poll_raw)
            if poll_sec < 0.5 or poll_sec > 30:
                errors.append("codex_activity_poll_sec: must be between 0.5 and 30")
            normalized["codex_activity_poll_sec"] = poll_sec
        except Exception:
            errors.append("codex_activity_poll_sec: invalid numeric value")

        logging_cfg = normalized.get("logging") or {}
        if isinstance(logging_cfg, dict):
            level = str(logging_cfg.get("level", "info")).lower()
            if level not in {"debug", "info", "warn", "error"}:
                errors.append("logging.level: must be one of debug/info/warn/error")
            else:
                logging_cfg["level"] = level
            normalized["logging"] = logging_cfg
        else:
            errors.append("logging: invalid object")

        parser_options = normalized.get("parser_options") or {}
        if isinstance(parser_options, dict):
            strict_mode = parser_options.get("strict_mode")
            if strict_mode is not None and not isinstance(strict_mode, bool):
                errors.append("parser_options.strict_mode: must be boolean")
        else:
            errors.append("parser_options: invalid object")

        telemetry_cfg = normalized.get("telemetry") or {}
        if isinstance(telemetry_cfg, dict):
            enabled = telemetry_cfg.get("enabled")
            if enabled is not None and not isinstance(enabled, bool):
                errors.append("telemetry.enabled: must be boolean")
        else:
            errors.append("telemetry: invalid object")

        if errors:
            raise ValueError("settings validation failed: " + "; ".join(errors))

        return normalized
