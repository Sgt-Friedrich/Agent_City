"use client";

import { useMemo } from "react";

import { useI18n } from "@/hooks/useI18n";
import { useDashboardStore } from "@/store/useDashboardStore";

export function ControlInspector() {
  const { t, formatDateTime } = useI18n();
  const target = useDashboardStore((state) => state.target);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const repositories = useDashboardStore((state) => state.repositories);
  const jobs = useDashboardStore((state) => state.jobs);
  const runtimeStatus = useDashboardStore((state) => state.runtimeStatus);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "running" || job.status === "queued"),
    [jobs],
  );

  const latestJob = jobs[0];
  const importedCount = repositories.filter((repo) => repo.source_type !== "mock").length;

  return (
    <section
      data-testid="control-inspector"
      className="h-full overflow-y-auto border-l border-line bg-[#081320cc] p-3 text-xs text-slate-300"
    >
      <div className="panel-title text-sm uppercase tracking-wide text-slate-200">
        {t("inspector.controlTitle")}
      </div>

      <div className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.summary")}</div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
          <div>{t("inspector.currentTarget")}: {target}</div>
          <div>{t("metrics.mode")}: {viewMode}</div>
          <div>{t("inspector.totalRepositories")}: {importedCount}</div>
          <div>{t("inspector.totalJobs")}: {jobs.length}</div>
          <div>{t("inspector.activeJobs")}: {activeJobs.length}</div>
          <div>{t("settings.runtimeBackendReady")}: {runtimeStatus?.backend_ready ? t("common.yes") : t("common.no")}</div>
        </div>
      </div>

      <div className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.context")}</div>
        {latestJob ? (
          <div className="mt-1 text-[11px] text-slate-400">
            <div>{t("inspector.latestJob")}: {latestJob.id}</div>
            <div>{t("jobs.status.running")}/{t("jobs.status.queued")}: {activeJobs.length}</div>
            <div>{t("jobs.target")}: {latestJob.target ?? t("common.na")}</div>
            <div>{t("jobs.progress")}: {latestJob.progress}%</div>
            <div>{t("jobs.start")}: {formatDateTime(latestJob.started_at)}</div>
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-slate-500">{t("jobs.empty")}</div>
        )}
      </div>

      <div className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.actions")}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setViewMode("repositories")}
            className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
          >
            {t("nav.repositories")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("jobs")}
            className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
          >
            {t("nav.jobs")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("reports")}
            className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400"
          >
            {t("nav.reports")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("settings")}
            className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
          >
            {t("nav.settings")}
          </button>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">{t("inspector.hint")}</div>
    </section>
  );
}
