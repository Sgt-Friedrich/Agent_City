"use client";

import { useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";
import { prettyMs, prettyPct } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { MetricsSummary } from "@/types/schema";

interface MetricsHeaderProps {
  metrics?: MetricsSummary;
  mode?: DashboardMode;
  diagnosticMode?: DiagnosticMode;
}

function trendPoints(seed: string, base: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const points: number[] = [];
  for (let i = 0; i < 14; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    points.push(Math.max(6, Math.round((hash % 48) * 0.5 + base)));
  }
  return points;
}

function Metric({
  label,
  value,
  spark,
  onClick,
}: {
  label: string;
  value: string;
  spark: number[];
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="border-r border-line px-3 py-2 text-left last:border-r-0 hover:bg-[#0c1f34]"
      onClick={onClick}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="panel-title mt-1 text-sm text-slate-100">{value}</div>
      <div className="mt-1 flex items-end gap-[2px]">
        {spark.map((height, index) => (
          <span
            key={`${label}-${index}`}
            className="inline-block w-[3px] rounded-sm bg-cyan-400/70"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    </button>
  );
}

const modeLabel: Record<DashboardMode, string> = {
  overview: "Overview",
  live: "Live",
  replay: "Replay",
  diagnostics: "Diagnostics",
  parser_analysis: "Parser Analysis",
  repositories: "Repositories",
  jobs: "Jobs",
  reports: "Reports",
  settings: "Settings",
};

export function MetricsHeader({ metrics, mode = "live", diagnosticMode = "realtime" }: MetricsHeaderProps) {
  const { t } = useI18n();
  const [range, setRange] = useState<"5m" | "1h" | "session" | "trace">("5m");

  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const selectedTraceId = useDashboardStore((state) => state.selectedTraceId);

  const displayModeLabel = (() => {
    if (mode === "overview") return t("nav.overview");
    if (mode === "live") return t("nav.live");
    if (mode === "replay") return t("nav.replay");
    if (mode === "diagnostics") return t("nav.diagnostics");
    if (mode === "parser_analysis") return t("nav.parser");
    if (mode === "repositories") return t("nav.repositories");
    if (mode === "jobs") return t("nav.jobs");
    if (mode === "reports") return t("nav.reports");
    return t("nav.settings");
  })();
  const diagnosticLabel =
    diagnosticMode === "heatmap"
      ? t("filter.mode.heatmap")
      : diagnosticMode === "errors"
        ? t("filter.mode.errors")
        : t("filter.mode.realtime");
  const modeDetail = mode === "diagnostics" ? ` (${diagnosticLabel})` : "";
  const traceRangeLabel = selectedTraceId ? selectedTraceId.slice(-6) : t("common.none");

  const rangeButtons: Array<{ id: "5m" | "1h" | "session" | "trace"; label: string }> = [
    { id: "5m", label: "5m" },
    { id: "1h", label: "1h" },
    { id: "session", label: t("metrics.range.session") },
    { id: "trace", label: `${t("metrics.range.trace")}:${traceRangeLabel}` },
  ];

  return (
    <header data-testid="metrics-header" className="border-b border-line bg-[#081323cc] backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-line/70 px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        <span>{t("metrics.window")}</span>
        <div className="flex items-center gap-1">
          {rangeButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded border px-1.5 py-0.5 ${
                range === item.id
                  ? "border-cyan-400 bg-[#15324d] text-slate-100"
                  : "border-line bg-[#0b1728] text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-stretch">
        <Metric
          label={t("metrics.mode")}
          value={`${displayModeLabel || modeLabel[mode]}${modeDetail}`}
          spark={trendPoints(`mode-${range}`, 10)}
          onClick={() => setViewMode("overview")}
        />
        <Metric
          label={t("metrics.totalTraces")}
          value={String(metrics?.total_traces ?? 0)}
          spark={trendPoints(`traces-${range}`, 7)}
          onClick={() => setViewMode("live")}
        />
        <Metric
          label={t("metrics.activeFlows")}
          value={String(metrics?.active_flows ?? 0)}
          spark={trendPoints(`flows-${range}`, 8)}
          onClick={() => setViewMode("live")}
        />
        <Metric
          label={t("metrics.avgLatency")}
          value={prettyMs(metrics?.avg_latency_ms ?? 0)}
          spark={trendPoints(`latency-${range}`, 9)}
          onClick={() => {
            setViewMode("diagnostics");
            setDiagnosticMode("heatmap");
          }}
        />
        <Metric
          label={t("metrics.errorRate")}
          value={prettyPct(metrics?.error_rate ?? 0)}
          spark={trendPoints(`error-${range}`, 6)}
          onClick={() => {
            setViewMode("diagnostics");
            setDiagnosticMode("errors");
          }}
        />
        <Metric
          label={t("metrics.tokenUsage")}
          value={String(metrics?.token_usage ?? 0)}
          spark={trendPoints(`token-${range}`, 6)}
          onClick={() => setViewMode("reports")}
        />
        <Metric
          label={t("metrics.estimatedCost")}
          value={`$${(metrics?.estimated_cost ?? 0).toFixed(4)}`}
          spark={trendPoints(`cost-${range}`, 6)}
          onClick={() => setViewMode("reports")}
        />
      </div>
    </header>
  );
}
