"use client";

import { useMemo } from "react";

import { useI18n } from "@/hooks/useI18n";
import { useDashboardStore } from "@/store/useDashboardStore";

interface StartHerePanelProps {
  onOpenImportWizard: () => void;
}

export function StartHerePanel({ onOpenImportWizard }: StartHerePanelProps) {
  const { t } = useI18n();
  const repositories = useDashboardStore((state) => state.repositories);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const importedCount = useMemo(
    () => repositories.filter((repo) => repo.source_type !== "mock").length,
    [repositories],
  );

  const steps = [
    t("start.step.import"),
    t("start.step.parse"),
    t("start.step.inspect"),
    t("start.step.diagnose"),
    t("start.step.report"),
  ];

  return (
    <section className="absolute inset-x-6 top-6 z-20 rounded border border-line bg-[#071325eb] p-4 shadow-glow">
      <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("start.title")}</div>
      <div className="mt-1 text-xs text-slate-300">{t("start.subtitle")}</div>
      <div className="mt-1 text-[11px] text-slate-400">
        {t("inspector.totalRepositories")}: {importedCount}
      </div>
      {importedCount === 0 ? (
        <div className="mt-1 text-[11px] text-amber-300">{t("start.noRepo")}</div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-300 md:grid-cols-5">
        {steps.map((step, index) => (
          <div key={step} className="rounded border border-line bg-[#102036] px-2 py-1">
            {index + 1}. {step}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenImportWizard}
          className="rounded border border-line bg-[#123252] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
        >
          {t("start.action.import")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("repositories")}
          className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
        >
          {t("start.action.repositories")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("parser_analysis")}
          className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
        >
          {t("start.action.parser")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("overview")}
          className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
        >
          {t("start.action.overview")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("diagnostics")}
          className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-amber-400"
        >
          {t("start.action.diagnostics")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("reports")}
          className="rounded border border-line bg-[#102239] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400"
        >
          {t("start.action.reports")}
        </button>
      </div>
    </section>
  );
}
