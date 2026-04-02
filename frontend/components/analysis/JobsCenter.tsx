"use client";

import { useMemo, useState } from "react";

import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { openDesktopPath } from "@/lib/desktopBridge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ControlJobType, JobRecord } from "@/types/schema";

function statusStyle(status: JobRecord["status"]): string {
  if (status === "success") return "border-emerald-500/40 bg-[#112a21] text-emerald-200";
  if (status === "running") return "border-sky-500/40 bg-[#12263b] text-sky-200";
  if (status === "failed") return "border-rose-500/40 bg-[#2b1419] text-rose-200";
  if (status === "cancelled") return "border-amber-500/40 bg-[#2b2416] text-amber-200";
  return "border-line bg-[#102033] text-slate-300";
}

const quickJobs: Array<{ type: ControlJobType; targetRequired?: boolean }> = [
  { type: "parser_regression" },
  { type: "frontend_self_check" },
  { type: "full_system_test" },
  { type: "generate_report", targetRequired: true },
  { type: "cleanup_refs" },
  { type: "live_simulation", targetRequired: true },
];

const jobTypeLabel: Record<ControlJobType, MessageKey> = {
  parse_repository: "job.type.parse_repository",
  reparse_repository: "job.type.reparse_repository",
  parser_regression: "job.type.parser_regression",
  frontend_self_check: "job.type.frontend_self_check",
  full_system_test: "job.type.full_system_test",
  generate_report: "job.type.generate_report",
  cleanup_refs: "job.type.cleanup_refs",
  live_simulation: "job.type.live_simulation",
};

const statusLabel: Record<JobRecord["status"], MessageKey> = {
  queued: "jobs.status.queued",
  running: "jobs.status.running",
  success: "jobs.status.success",
  failed: "jobs.status.failed",
  cancelled: "jobs.status.cancelled",
};

export function JobsCenter() {
  const { t, formatDateTime } = useI18n();
  const target = useDashboardStore((state) => state.target);
  const jobs = useDashboardStore((state) => state.jobs);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const active = useMemo(
    () => jobs.find((job) => job.status === "running" || job.status === "queued"),
    [jobs],
  );

  const runJob = async (type: ControlJobType) => {
    setBusy(type);
    try {
      const response = await api.runJob({
        type,
        target: target,
        payload: type === "live_simulation" ? { count: 8 } : {},
      });
      upsertControlJob(response.job);
      setMessage(`${t("jobs.actions.run")}: ${t(jobTypeLabel[type])}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("jobs.runFailed"));
    } finally {
      setBusy(null);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const response = await api.cancelJob(jobId);
      upsertControlJob(response.job);
      setMessage(`${t("jobs.actions.cancel")}: ${jobId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("jobs.cancelFailed"));
    }
  };

  const openArtifact = async (job: JobRecord) => {
    if (!job.artifact_path) return;
    const result = await openDesktopPath(job.artifact_path);
    if (!result.ok) {
      setMessage(result.message ?? t("jobs.openArtifactFailed"));
    }
  };

  return (
    <section className="h-full overflow-y-auto p-3 scrollbar-thin" data-testid="jobs-center">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("jobs.title")}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>
            {t("jobs.target")}: {target}
          </span>
          <span>
            {t("jobs.active")}: {active?.id ?? t("common.none")}
          </span>
          <span>
            {t("jobs.count")}: {jobs.length}
          </span>
        </div>
        {message ? <div className="mt-1 text-[11px] text-emerald-300">{message}</div> : null}
      </div>

      <div className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("control.title")}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {quickJobs.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => runJob(item.type)}
              disabled={busy === item.type || (item.targetRequired && !target)}
              className="rounded border border-line bg-[#10253d] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400 disabled:opacity-50"
            >
              {t(jobTypeLabel[item.type])}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {jobs.length === 0 && (
          <div className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-500">
            {t("jobs.empty")}
          </div>
        )}
        {jobs.map((job) => (
          <article key={job.id} className="rounded border border-line bg-[#0a1626] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="panel-title text-sm text-slate-100">{t(jobTypeLabel[job.type])}</div>
                <div className="mt-1 text-[11px] text-slate-400">id: {job.id}</div>
              </div>
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${statusStyle(job.status)}`}>
                {t(statusLabel[job.status])}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 lg:grid-cols-4">
              <div>
                {t("jobs.target")}: {job.target ?? t("common.na")}
              </div>
              <div>
                {t("jobs.progress")}: {job.progress}%
              </div>
              <div>
                {t("jobs.start")}: {formatDateTime(job.started_at)}
              </div>
              <div>
                {t("jobs.end")}: {formatDateTime(job.ended_at)}
              </div>
            </div>
            <div className="mt-2 rounded border border-line bg-[#0f1f32] px-2 py-1 text-[11px] text-slate-300">
              {job.log_summary || t("jobs.noSummary")}
            </div>
            {job.detail_output ? (
              <pre className="mt-2 max-h-32 overflow-auto rounded border border-line bg-[#07121f] p-2 text-[10px] text-slate-400">
                {job.detail_output}
              </pre>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1">
              {(job.status === "queued" || job.status === "running") && (
                <button
                  type="button"
                  onClick={() => cancelJob(job.id)}
                  className="rounded border border-amber-500/40 bg-[#2b2416] px-2 py-1 text-[11px] text-amber-200 hover:border-amber-300"
                >
                  {t("jobs.actions.cancel")}
                </button>
              )}
              {job.artifact_path && (
                <button
                  type="button"
                  onClick={() => openArtifact(job)}
                  className="rounded border border-line bg-[#10253d] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400"
                >
                  {t("jobs.actions.openArtifact")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
