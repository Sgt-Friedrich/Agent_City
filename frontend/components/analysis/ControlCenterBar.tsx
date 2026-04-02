"use client";

import { useMemo, useState } from "react";

import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ControlJobType } from "@/types/schema";

interface ControlCenterBarProps {
  onOpenImportWizard: () => void;
}

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

export function ControlCenterBar({ onOpenImportWizard }: ControlCenterBarProps) {
  const { t } = useI18n();
  const target = useDashboardStore((state) => state.target);
  const jobs = useDashboardStore((state) => state.jobs);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const [message, setMessage] = useState<string>("");
  const [busyType, setBusyType] = useState<ControlJobType | "cancel" | null>(null);

  const activeJob = useMemo(
    () => jobs.find((job) => job.status === "running" || job.status === "queued"),
    [jobs],
  );

  const runJob = async (type: ControlJobType, payload?: Record<string, unknown>) => {
    setBusyType(type);
    try {
      const response = await api.runJob({
        type,
        target,
        payload,
      });
      upsertControlJob(response.job);
      setMessage(`${t("jobs.actions.run")}: ${t(jobTypeLabel[type])}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("repositories.jobFailed"));
    } finally {
      setBusyType(null);
    }
  };

  const cancelCurrent = async () => {
    if (!activeJob) return;
    setBusyType("cancel");
    try {
      const response = await api.cancelJob(activeJob.id);
      upsertControlJob(response.job);
      setMessage(`${t("control.cancelCurrent")}: ${activeJob.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("jobs.cancelFailed"));
    } finally {
      setBusyType(null);
    }
  };

  return (
    <section className="border-b border-line bg-[#081422d6] px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-200">{t("control.title")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenImportWizard}
            className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
          >
            {t("control.startParse")}
          </button>
          <button
            type="button"
            onClick={cancelCurrent}
            disabled={!activeJob || busyType === "cancel"}
            className="rounded border border-line bg-[#14283d] px-2 py-1 text-[11px] text-slate-100 hover:border-rose-400 disabled:opacity-50"
          >
            {t("control.cancelCurrent")}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => runJob("live_simulation", { count: 6 })}
          disabled={busyType === "live_simulation"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-400 disabled:opacity-50"
        >
          {t("control.runLiveSimulation")}
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode("diagnostics");
            setDiagnosticMode("errors");
          }}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-amber-400"
        >
          {t("control.runDiagnostics")}
        </button>
        <button
          type="button"
          onClick={() => runJob("parser_regression")}
          disabled={busyType === "parser_regression"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400 disabled:opacity-50"
        >
          {t("control.runParserRegression")}
        </button>
        <button
          type="button"
          onClick={() => runJob("frontend_self_check")}
          disabled={busyType === "frontend_self_check"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400 disabled:opacity-50"
        >
          {t("control.runFrontendCheck")}
        </button>
        <button
          type="button"
          onClick={() => runJob("full_system_test")}
          disabled={busyType === "full_system_test"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400 disabled:opacity-50"
        >
          {t("control.runFullSystem")}
        </button>
        <button
          type="button"
          onClick={() => runJob("generate_report")}
          disabled={busyType === "generate_report"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-400 disabled:opacity-50"
        >
          {t("control.generateReport")}
        </button>
        <button
          type="button"
          onClick={() => runJob("cleanup_refs")}
          disabled={busyType === "cleanup_refs"}
          className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-amber-400 disabled:opacity-50"
        >
          {t("control.cleanupRefs")}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span>
          {t("header.target")}: {target}
        </span>
        <span>
          {t("control.activeJob")}: {activeJob?.id ?? t("common.none")}
        </span>
        {message ? <span className="text-emerald-300">{message}</span> : null}
      </div>
    </section>
  );
}
