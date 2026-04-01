"use client";

import { prettyMs, prettyPct } from "@/lib/utils";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";
import { MetricsSummary } from "@/types/schema";

interface MetricsHeaderProps {
  metrics?: MetricsSummary;
  mode?: DashboardMode;
  diagnosticMode?: DiagnosticMode;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-line px-3 py-2 last:border-r-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="panel-title mt-1 text-sm text-slate-100">{value}</div>
    </div>
  );
}

const modeLabel: Record<DashboardMode, string> = {
  overview: "Overview",
  live: "Live",
  replay: "Replay",
  diagnostics: "Diagnostics",
  parser_analysis: "Parser Analysis",
  reports: "Reports",
};

export function MetricsHeader({ metrics, mode = "live", diagnosticMode = "realtime" }: MetricsHeaderProps) {
  const modeDetail = mode === "diagnostics" ? ` (${diagnosticMode})` : "";

  return (
    <header data-testid="metrics-header" className="border-b border-line bg-[#081323cc] backdrop-blur-sm">
      <div className="flex flex-wrap items-stretch">
        <Metric label="Mode" value={`${modeLabel[mode]}${modeDetail}`} />
        <Metric label="Total Traces" value={String(metrics?.total_traces ?? 0)} />
        <Metric label="Active Flows" value={String(metrics?.active_flows ?? 0)} />
        <Metric label="Avg Latency" value={prettyMs(metrics?.avg_latency_ms ?? 0)} />
        <Metric label="Error Rate" value={prettyPct(metrics?.error_rate ?? 0)} />
        <Metric label="Token Usage" value={String(metrics?.token_usage ?? 0)} />
        <Metric label="Estimated Cost" value={`$${(metrics?.estimated_cost ?? 0).toFixed(4)}`} />
      </div>
    </header>
  );
}
