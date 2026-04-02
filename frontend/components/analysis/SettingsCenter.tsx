"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";
import { AppSettings } from "@/types/schema";

type FormState = AppSettings;

type SettingsValidationErrors = Partial<
  Record<
    "workspace_dir" | "data_dir" | "export_dir" | "cleanup_threshold_mb" | "codex_activity_poll_sec" | "logging",
    string
  >
>;

const ABSOLUTE_PATH_RE = /^(?:[a-zA-Z]:[\\/]|\/)/;

function isAbsoluteLikePath(value: string): boolean {
  return ABSOLUTE_PATH_RE.test(value.trim());
}

interface SettingsCenterProps {
  onClose?: () => void;
}

export function SettingsCenter({ onClose }: SettingsCenterProps) {
  const { t, locale, setLocale, localeOptions } = useI18n();
  const appSettings = useDashboardStore((state) => state.appSettings);
  const runtime = useDashboardStore((state) => state.runtimeStatus);
  const setAppSettings = useDashboardStore((state) => state.setAppSettings);
  const [form, setForm] = useState<FormState | undefined>(appSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<SettingsValidationErrors>({});

  useEffect(() => {
    if (appSettings) {
      if (!dirty || !form) {
        setForm(appSettings);
      }
    }
  }, [appSettings, dirty, form]);

  if (!form) {
    return (
      <section className="h-full overflow-y-auto p-3 text-xs text-slate-400" data-testid="settings-center">
        {t("app.loading")}
      </section>
    );
  }

  const save = async () => {
    const nextErrors: SettingsValidationErrors = {};
    if (!isAbsoluteLikePath(form.workspace_dir)) {
      nextErrors.workspace_dir = `${t("settings.workspaceDir")} ${t("settings.error.absolutePath")}`;
    }
    if (!isAbsoluteLikePath(form.data_dir)) {
      nextErrors.data_dir = `${t("settings.dataDir")} ${t("settings.error.absolutePath")}`;
    }
    if (!isAbsoluteLikePath(form.export_dir)) {
      nextErrors.export_dir = `${t("settings.exportDir")} ${t("settings.error.absolutePath")}`;
    }
    if (form.cleanup_threshold_mb < 50 || form.cleanup_threshold_mb > 5000) {
      nextErrors.cleanup_threshold_mb = t("settings.error.threshold");
    }
    if (form.codex_activity_poll_sec < 0.5 || form.codex_activity_poll_sec > 30) {
      nextErrors.codex_activity_poll_sec = t("settings.error.codexPoll");
    }
    const loggingLevel = String(form.logging.level ?? "info");
    if (!["debug", "info", "warn", "error"].includes(loggingLevel)) {
      nextErrors.logging = t("settings.error.logging");
    }

    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage(t("settings.validationFailed"));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await api.updateSettings(form);
      setAppSettings(response.settings);
      setForm(response.settings);
      setDirty(false);
      setLocale(response.settings.language);
      setMessage(t("settings.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const liveFlowModeLabelMap: Record<FormState["live_flow_mode"], string> = {
    always_simulated: t("settings.liveFlowMode.always_simulated"),
    manual: t("settings.liveFlowMode.manual"),
    codex_real_only: t("settings.liveFlowMode.codex_real_only"),
  };

  const patchForm = (patch: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
    setMessage("");
  };

  return (
    <section className="h-full overflow-y-auto p-3 scrollbar-thin" data-testid="settings-center">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("settings.title")}</div>
            <div className="mt-1 text-[11px] text-slate-400">{t("settings.languageHint")}</div>
          </div>
          {onClose ? (
            <button
              type="button"
              className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          ) : null}
        </div>
        {message ? <div className="mt-1 text-[11px] text-emerald-300">{message}</div> : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded border border-line bg-[#0a1626] p-3">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("settings.language")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {localeOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                className={`rounded border px-3 py-1 text-xs ${
                  form.language === option.code
                    ? "border-sky-400 bg-[#17354f] text-slate-100"
                    : "border-line bg-[#102136] text-slate-300 hover:border-sky-300"
                }`}
                onClick={() => {
                  patchForm({ language: option.code });
                  setLocale(option.code);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {t("settings.currentLocale")}: {locale}
          </div>
        </section>

        <section className="rounded border border-line bg-[#0a1626] p-3">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("settings.runtime")}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div>
              {t("settings.runtimeBackendReady")}: {runtime?.backend_ready ? t("common.yes") : t("common.no")}
            </div>
            <div>{t("settings.runtimeRepositories")}: {runtime?.repository_count ?? 0}</div>
            <div>{t("settings.runtimeTargets")}: {runtime?.target_count ?? 0}</div>
            <div>{t("settings.runtimeActiveJobs")}: {runtime?.active_job_count ?? 0}</div>
            <div>{t("settings.runtimeParseJobs")}: {runtime?.parse_job_count ?? 0}</div>
            <div>{t("settings.runtimeLastJob")}: {runtime?.last_job_id ?? t("common.na")}</div>
          </div>
        </section>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded border border-line bg-[#0a1626] p-3">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">
            {t("settings.liveFlowMode")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{t("settings.liveFlowModeHint")}</div>
          <select
            className="mt-2 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.live_flow_mode}
            onChange={(event) =>
              patchForm({
                live_flow_mode: event.target.value as FormState["live_flow_mode"],
              })
            }
          >
            <option value="always_simulated">{t("settings.liveFlowMode.always_simulated")}</option>
            <option value="manual">{t("settings.liveFlowMode.manual")}</option>
            <option value="codex_real_only">{t("settings.liveFlowMode.codex_real_only")}</option>
          </select>
          <div className="mt-2 text-[11px] text-slate-400">
            {liveFlowModeLabelMap[form.live_flow_mode]}
          </div>
        </section>

        <label className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-300">
          {t("settings.codexPollSec")}
          <input
            type="number"
            step="0.1"
            className="mt-1 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.codex_activity_poll_sec}
            onChange={(event) => patchForm({ codex_activity_poll_sec: Number(event.target.value) || 1.8 })}
          />
          <div className="mt-1 text-[10px] text-slate-500">{t("settings.codexPollSecHint")}</div>
          {validationErrors.codex_activity_poll_sec ? (
            <div className="mt-1 text-[10px] text-rose-300">{validationErrors.codex_activity_poll_sec}</div>
          ) : null}
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <label className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-300">
          {t("settings.workspaceDir")}
          <input
            className="mt-1 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.workspace_dir}
            onChange={(event) => patchForm({ workspace_dir: event.target.value })}
          />
          {validationErrors.workspace_dir ? (
            <div className="mt-1 text-[10px] text-rose-300">{validationErrors.workspace_dir}</div>
          ) : null}
        </label>
        <label className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-300">
          {t("settings.dataDir")}
          <input
            className="mt-1 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.data_dir}
            onChange={(event) => patchForm({ data_dir: event.target.value })}
          />
          {validationErrors.data_dir ? (
            <div className="mt-1 text-[10px] text-rose-300">{validationErrors.data_dir}</div>
          ) : null}
        </label>
        <label className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-300">
          {t("settings.exportDir")}
          <input
            className="mt-1 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.export_dir}
            onChange={(event) => patchForm({ export_dir: event.target.value })}
          />
          {validationErrors.export_dir ? (
            <div className="mt-1 text-[10px] text-rose-300">{validationErrors.export_dir}</div>
          ) : null}
        </label>
        <label className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-300">
          {t("settings.cleanupThreshold")}
          <input
            type="number"
            className="mt-1 w-full rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
            value={form.cleanup_threshold_mb}
            onChange={(event) => patchForm({ cleanup_threshold_mb: Number(event.target.value) || 200 })}
          />
          {validationErrors.cleanup_threshold_mb ? (
            <div className="mt-1 text-[10px] text-rose-300">{validationErrors.cleanup_threshold_mb}</div>
          ) : null}
        </label>
      </div>

      <div className="mt-3 rounded border border-line bg-[#0a1626] p-3">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("settings.telemetryLogging")}</div>
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 xl:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.telemetry.enabled)}
              onChange={(event) =>
                patchForm({ telemetry: { ...form.telemetry, enabled: event.target.checked } })
              }
            />
            {t("settings.telemetryEnabled")}
          </label>
          <label className="flex items-center gap-2">
            {t("settings.loggingLevel")}
            <select
              className="rounded border border-line bg-[#091524] px-2 py-1 text-xs text-slate-100"
              value={String(form.logging.level ?? "info")}
              onChange={(event) => patchForm({ logging: { ...form.logging, level: event.target.value } })}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
        </div>
        {validationErrors.logging ? (
          <div className="mt-2 text-[10px] text-rose-300">{validationErrors.logging}</div>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (appSettings) {
              setForm(appSettings);
              setDirty(false);
              setValidationErrors({});
              setMessage(t("settings.restored"));
            }
          }}
          className="mr-2 rounded border border-line bg-[#0f2136] px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
        >
          {t("settings.restore")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded border border-line bg-[#173851] px-3 py-1.5 text-xs text-slate-100 hover:border-sky-400 disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("settings.saveSettings")}
        </button>
      </div>
    </section>
  );
}
