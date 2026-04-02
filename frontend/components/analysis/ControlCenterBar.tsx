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
  const parseJobs = useDashboardStore((state) => state.parseJobs);
  const repositories = useDashboardStore((state) => state.repositories);
  const topology = useDashboardStore((state) => state.topology);
  const diagnosticsSummary = useDashboardStore((state) => state.diagnosticsSummary);
  const parserAnalysis = useDashboardStore((state) => state.parserAnalysis);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const [message, setMessage] = useState<string>("");
  const [busyType, setBusyType] = useState<ControlJobType | "cancel" | null>(null);

  const activeJob = useMemo(
    () => jobs.find((job) => job.status === "running" || job.status === "queued"),
    [jobs],
  );
  const importedCount = useMemo(
    () => repositories.filter((repo) => repo.source_type !== "mock").length,
    [repositories],
  );
  const parseComplete = useMemo(
    () => parseJobs.some((job) => job.status === "completed"),
    [parseJobs],
  );
  const topologyReady = (topology?.nodes.length ?? 0) > 0;
  const diagnosticsReady = Boolean(
    diagnosticsSummary &&
      ((diagnosticsSummary.error_event_count ?? 0) > 0 ||
        (diagnosticsSummary.active_trace_count ?? 0) > 0 ||
        diagnosticsSummary.slow_nodes.length > 0),
  );
  const parserReady = (parserAnalysis?.parser_confidence ?? 0) > 0;
  const reportsReady = jobs.some((job) => job.type === "generate_report" && job.status === "success");

  const workflowSteps: Array<{
    id: string;
    done: boolean;
    label: string;
    actionLabel: string;
    action: () => void;
  }> = [
    {
      id: "import",
      done: importedCount > 0,
      label: t("workflow.step.import"),
      actionLabel: t("workflow.action.import"),
      action: onOpenImportWizard,
    },
    {
      id: "parse",
      done: parseComplete,
      label: t("workflow.step.parse"),
      actionLabel: t("workflow.action.parse"),
      action: () => setViewMode("repositories"),
    },
    {
      id: "topology",
      done: topologyReady,
      label: t("workflow.step.topology"),
      actionLabel: t("workflow.action.topology"),
      action: () => setViewMode("overview"),
    },
    {
      id: "diagnostics",
      done: diagnosticsReady,
      label: t("workflow.step.diagnostics"),
      actionLabel: t("workflow.action.diagnostics"),
      action: () => {
        setViewMode("diagnostics");
        setDiagnosticMode("errors");
        setDiagnosticFocus("errors");
        setSearchQuery("status:error");
      },
    },
    {
      id: "parser",
      done: parserReady,
      label: t("workflow.step.parser"),
      actionLabel: t("workflow.action.parser"),
      action: () => setViewMode("parser_analysis"),
    },
    {
      id: "report",
      done: reportsReady,
      label: t("workflow.step.report"),
      actionLabel: t("workflow.action.report"),
      action: () => setViewMode("reports"),
    },
  ];
  const completedSteps = workflowSteps.filter((step) => step.done).length;
  const workflowProgress = Math.round((completedSteps / workflowSteps.length) * 100);
  const nextStep = workflowSteps.find((step) => !step.done) ?? workflowSteps[workflowSteps.length - 1];

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
        <span>
          {t("workflow.progress")}: {workflowProgress}%
        </span>
        {message ? <span className="text-emerald-300">{message}</span> : null}
      </div>

      <div className="mt-2 rounded border border-line bg-[#0a1727] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title text-[11px] uppercase tracking-wide text-slate-300">{t("workflow.title")}</div>
          <button
            type="button"
            className="rounded border border-line bg-[#12314e] px-2 py-1 text-[10px] text-slate-100 hover:border-sky-400"
            onClick={nextStep.action}
          >
            {t("workflow.nextAction")}: {nextStep.actionLabel}
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-[#0a1420]">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.max(7, workflowProgress)}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 xl:grid-cols-6">
          {workflowSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={step.action}
              className={`rounded border px-2 py-1 text-left text-[10px] ${
                step.done
                  ? "border-emerald-500/40 bg-[#112b22] text-emerald-200"
                  : nextStep.id === step.id
                    ? "border-sky-400 bg-[#153250] text-slate-100"
                    : "border-line bg-[#0f2136] text-slate-400 hover:border-slate-400"
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
