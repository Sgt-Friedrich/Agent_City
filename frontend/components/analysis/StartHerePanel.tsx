"use client";

import { useMemo } from "react";

import { useI18n } from "@/hooks/useI18n";
import { useDashboardStore } from "@/store/useDashboardStore";

interface StartHerePanelProps {
  onOpenImportWizard: () => void;
}

interface StepState {
  id: string;
  label: string;
  done: boolean;
  actionLabel: string;
  action: () => void;
}

export function StartHerePanel({ onOpenImportWizard }: StartHerePanelProps) {
  const { t } = useI18n();
  const repositories = useDashboardStore((state) => state.repositories);
  const parseJobs = useDashboardStore((state) => state.parseJobs);
  const traces = useDashboardStore((state) => state.traces);
  const parserReport = useDashboardStore((state) => state.parserAnalysis);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const importedCount = useMemo(
    () => repositories.filter((repo) => repo.source_type !== "mock").length,
    [repositories],
  );
  const hasRepo = importedCount > 0;
  const hasParse = parseJobs.some((job) => job.status === "completed");
  const parserHealthy = (parserReport?.parser_confidence ?? 0) >= 0.72;
  const hasTrace = traces.length > 0;
  const progressSteps = useMemo<StepState[]>(
    () => [
      {
        id: "import",
        label: t("start.step.import"),
        done: hasRepo,
        actionLabel: t("start.action.import"),
        action: onOpenImportWizard,
      },
      {
        id: "parse",
        label: t("start.step.parse"),
        done: hasParse,
        actionLabel: t("start.action.repositories"),
        action: () => setViewMode("repositories"),
      },
      {
        id: "inspect",
        label: t("start.step.inspect"),
        done: parserHealthy,
        actionLabel: t("start.action.parser"),
        action: () => setViewMode("parser_analysis"),
      },
      {
        id: "diagnose",
        label: t("start.step.diagnose"),
        done: hasTrace,
        actionLabel: t("start.action.diagnostics"),
        action: () => setViewMode("diagnostics"),
      },
      {
        id: "report",
        label: t("start.step.report"),
        done: false,
        actionLabel: t("start.action.reports"),
        action: () => setViewMode("reports"),
      },
    ],
    [hasParse, hasRepo, hasTrace, onOpenImportWizard, parserHealthy, setViewMode, t],
  );

  const doneCount = progressSteps.filter((step) => step.done).length;
  const progress = Math.round((doneCount / progressSteps.length) * 100);
  const nextStep = progressSteps.find((step) => !step.done) ?? progressSteps[progressSteps.length - 1];

  return (
    <section className="absolute inset-x-6 top-6 z-20 rounded border border-line bg-[#071325eb] p-4 shadow-glow">
      <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("start.title")}</div>
      <div className="mt-1 text-xs text-slate-300">{t("start.subtitle")}</div>
      <div className="mt-1 text-[11px] text-slate-400">
        {t("inspector.totalRepositories")}: {importedCount} | {t("start.progressLabel")}: {progress}%
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded bg-[#0b1b2f]">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.max(8, progress)}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-300 md:grid-cols-5">
        {progressSteps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={step.action}
            className={`rounded border px-2 py-1 text-left ${
              step.done
                ? "border-emerald-500/40 bg-[#113325] text-emerald-200"
                : nextStep.id === step.id
                  ? "border-sky-400 bg-[#14314f] text-slate-100"
                  : "border-line bg-[#102036] text-slate-400 hover:border-slate-400"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wide">{index + 1}</div>
            <div className="mt-0.5">{step.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="rounded border border-line bg-[#0f2136] px-2 py-1 text-[11px] text-slate-300">
          {t("start.nextAction")}: {nextStep.label}
        </div>
        <button
          type="button"
          onClick={nextStep.action}
          className="rounded border border-line bg-[#123252] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
        >
          {nextStep.actionLabel}
        </button>
      </div>
    </section>
  );
}
