"use client";

import { useMemo } from "react";

import { useI18n } from "@/hooks/useI18n";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";
import { useDashboardStore } from "@/store/useDashboardStore";

interface WorkspaceModeBannerProps {
  mode: DashboardMode;
  diagnosticMode: DiagnosticMode;
}

interface ModeDescriptor {
  title: string;
  objective: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}

export function WorkspaceModeBanner({ mode, diagnosticMode }: WorkspaceModeBannerProps) {
  const { t } = useI18n();
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);

  const descriptor = useMemo<ModeDescriptor>(() => {
    if (mode === "overview") {
      return {
        title: t("modeBanner.overview.title"),
        objective: t("modeBanner.overview.objective"),
        primaryActionLabel: t("modeBanner.overview.action"),
        onPrimaryAction: () => {
          setViewMode("live");
          setSearchQuery("");
        },
      };
    }
    if (mode === "live") {
      return {
        title: t("modeBanner.live.title"),
        objective: t("modeBanner.live.objective"),
        primaryActionLabel: t("modeBanner.live.action"),
        onPrimaryAction: () => {
          setViewMode("diagnostics");
          setDiagnosticMode("errors");
          setDiagnosticFocus("errors");
          setSearchQuery("status:error");
        },
      };
    }
    if (mode === "replay") {
      return {
        title: t("modeBanner.replay.title"),
        objective: t("modeBanner.replay.objective"),
        primaryActionLabel: t("modeBanner.replay.action"),
        onPrimaryAction: () => {
          setViewMode("diagnostics");
          setDiagnosticMode("errors");
          setDiagnosticFocus("errors");
          setSearchQuery("status:error");
        },
      };
    }
    if (mode === "diagnostics") {
      return {
        title: `${t("modeBanner.diagnostics.title")} / ${diagnosticMode}`,
        objective: t("modeBanner.diagnostics.objective"),
        primaryActionLabel: t("modeBanner.diagnostics.action"),
        onPrimaryAction: () => {
          setViewMode("replay");
        },
      };
    }
    if (mode === "parser_analysis") {
      return {
        title: t("modeBanner.parser.title"),
        objective: t("modeBanner.parser.objective"),
        primaryActionLabel: t("modeBanner.parser.action"),
        onPrimaryAction: () => {
          setViewMode("repositories");
        },
      };
    }
    if (mode === "repositories") {
      return {
        title: t("modeBanner.repositories.title"),
        objective: t("modeBanner.repositories.objective"),
        primaryActionLabel: t("modeBanner.repositories.action"),
        onPrimaryAction: () => {
          setViewMode("parser_analysis");
        },
      };
    }
    if (mode === "jobs") {
      return {
        title: t("modeBanner.jobs.title"),
        objective: t("modeBanner.jobs.objective"),
        primaryActionLabel: t("modeBanner.jobs.action"),
        onPrimaryAction: () => {
          setViewMode("reports");
        },
      };
    }
    if (mode === "reports") {
      return {
        title: t("modeBanner.reports.title"),
        objective: t("modeBanner.reports.objective"),
        primaryActionLabel: t("modeBanner.reports.action"),
        onPrimaryAction: () => {
          setViewMode("overview");
        },
      };
    }
    return {
      title: t("modeBanner.settings.title"),
      objective: t("modeBanner.settings.objective"),
      primaryActionLabel: t("modeBanner.settings.action"),
      onPrimaryAction: () => {
        setViewMode("overview");
      },
    };
  }, [
    diagnosticMode,
    mode,
    setDiagnosticFocus,
    setDiagnosticMode,
    setSearchQuery,
    setViewMode,
    t,
  ]);

  return (
    <div className="border-b border-line bg-[#07121ed9] px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="panel-title text-xs uppercase tracking-wide text-cyan-200">{descriptor.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{descriptor.objective}</div>
        </div>
        <button
          type="button"
          className="rounded border border-line bg-[#0f263d] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
          onClick={descriptor.onPrimaryAction}
        >
          {descriptor.primaryActionLabel}
        </button>
      </div>
    </div>
  );
}

