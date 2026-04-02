"use client";

import { useMemo } from "react";

import { useI18n } from "@/hooks/useI18n";
import { DashboardMode, DiagnosticMode, flowLegend } from "@/lib/visualTheme";
import { useDashboardStore } from "@/store/useDashboardStore";
import { NodeType, SpanKind } from "@/types/schema";

const spanKindOptions: SpanKind[] = [
  "AGENT",
  "CHAIN",
  "LLM",
  "TOOL",
  "RETRIEVER",
  "RERANKER",
  "MEMORY",
  "MCP",
  "GUARDRAIL",
  "EVALUATOR",
];

const statusOptions = ["healthy", "warning", "error", "idle", "success", "partial"];

function toggle<T>(current: T[], value: T): T[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  return [...current, value];
}

export function FilterPanel() {
  const { t } = useI18n();
  const topology = useDashboardStore((state) => state.topology);
  const traces = useDashboardStore((state) => state.traces);
  const filters = useDashboardStore((state) => state.filters);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);
  const diagnosticFocus = useDashboardStore((state) => state.diagnosticFocus);
  const searchQuery = useDashboardStore((state) => state.searchQuery);
  const parseJobs = useDashboardStore((state) => state.parseJobs);
  const diagnostics = useDashboardStore((state) => state.diagnosticsSummary);
  const parserAnalysis = useDashboardStore((state) => state.parserAnalysis);
  const setDistrictFilter = useDashboardStore((state) => state.setDistrictFilter);
  const setNodeTypeFilter = useDashboardStore((state) => state.setNodeTypeFilter);
  const setSpanKindFilter = useDashboardStore((state) => state.setSpanKindFilter);
  const setStatusFilter = useDashboardStore((state) => state.setStatusFilter);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const resetFilters = useDashboardStore((state) => state.resetFilters);

  const nodeTypes = useMemo<NodeType[]>(() => {
    if (!topology) return [];
    return Array.from(new Set(topology.nodes.map((node) => node.type))).sort();
  }, [topology]);

  const diagnosticModes: Array<{ id: DiagnosticMode; label: string }> = [
    { id: "realtime", label: t("filter.mode.realtime") },
    { id: "heatmap", label: t("filter.mode.heatmap") },
    { id: "errors", label: t("filter.mode.errors") },
  ];
  const diagnosticFocusModes: Array<{ id: "all" | "errors" | "slow" | "congestion" | "retry_fallback"; label: string }> = [
    { id: "all", label: "all" },
    { id: "errors", label: "errors" },
    { id: "slow", label: "slow" },
    { id: "congestion", label: "congestion" },
    { id: "retry_fallback", label: "retry/fallback" },
  ];
  const workbenchViews: Array<{ id: DashboardMode; label: string }> = [
    { id: "overview", label: t("nav.overview") },
    { id: "live", label: t("nav.live") },
    { id: "replay", label: t("nav.replay") },
    { id: "diagnostics", label: t("nav.diagnostics") },
    { id: "parser_analysis", label: t("nav.parser") },
    { id: "repositories", label: t("nav.repositories") },
    { id: "jobs", label: t("nav.jobs") },
    { id: "reports", label: t("nav.reports") },
    { id: "settings", label: t("nav.settings") },
  ];

  const latestCompletedImport = useMemo(
    () => parseJobs.find((job) => job.status === "completed" && job.target_id),
    [parseJobs],
  );
  const hotTrace = traces[0];
  const hasErrorChains = (diagnostics?.error_event_count ?? 0) > 0;
  const hasRetryFallback =
    (diagnostics?.retry_event_count ?? 0) > 0 || (diagnostics?.fallback_event_count ?? 0) > 0;

  return (
    <aside data-testid="filter-panel" className="h-full max-h-[34vh] overflow-y-auto border-r border-line bg-[#081320cc] p-3 scrollbar-thin lg:max-h-none">
      <div className="flex items-center justify-between">
        <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">{t("control.title")}</h2>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => resetFilters()}
        >
          {t("common.reset")}
        </button>
      </div>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.quickEntry")}</h3>
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            className="rounded border border-line bg-[#0b1a2e] px-2 py-1 text-left text-[11px] text-slate-300 hover:border-cyan-400"
            onClick={() => {
              if (!hotTrace) return;
              setSelectedTrace(hotTrace.envelope.trace_id);
              setTraceFilter(hotTrace.envelope.trace_id);
              setViewMode("live");
            }}
          >
            {t("filter.quick.activeTrace")}{" "}
            {hotTrace ? `(${hotTrace.envelope.trace_id.slice(-6)})` : `(${t("common.none")})`}
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 text-left text-[11px] ${
              hasErrorChains
                ? "border-rose-500/50 bg-[#2b161a] text-rose-100 hover:border-rose-400"
                : "border-line bg-[#0b1a2e] text-slate-500"
            }`}
            onClick={() => {
              setViewMode("diagnostics");
              setDiagnosticMode("errors");
              setDiagnosticFocus("errors");
              setStatusFilter(["error"]);
            }}
          >
            {t("filter.quick.errorChains")}{" "}
            {hasErrorChains ? `(${diagnostics?.error_event_count})` : `(${t("common.none")})`}
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 text-left text-[11px] ${
              hasRetryFallback
                ? "border-amber-500/50 bg-[#2b2315] text-amber-100 hover:border-amber-400"
                : "border-line bg-[#0b1a2e] text-slate-500"
            }`}
            onClick={() => {
              setViewMode("diagnostics");
              setDiagnosticMode("errors");
              setDiagnosticFocus("retry_fallback");
              setSearchQuery("has:retry,fallback");
            }}
          >
            {t("filter.quick.fallbackRetry")}{" "}
            {hasRetryFallback ? `(${t("filter.quick.active")})` : `(${t("common.none")})`}
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 text-left text-[11px] ${
              (parserAnalysis?.parser_confidence ?? 1) < 0.75
                ? "border-amber-500/50 bg-[#2b2315] text-amber-100 hover:border-amber-400"
                : "border-line bg-[#0b1a2e] text-slate-300 hover:border-sky-400"
            }`}
            onClick={() => setViewMode("parser_analysis")}
          >
            {t("filter.quick.lowConfidence")} ({(parserAnalysis?.parser_confidence ?? 0).toFixed(3)})
          </button>
          <button
            type="button"
            className="rounded border border-line bg-[#0b1a2e] px-2 py-1 text-left text-[11px] text-slate-300 hover:border-emerald-400"
            onClick={() => {
              if (!latestCompletedImport?.target_id) return;
              setTarget(latestCompletedImport.target_id);
              setViewMode("overview");
            }}
          >
            {t("filter.quick.recentImport")}{" "}
            {latestCompletedImport?.repo_name ? `(${latestCompletedImport.repo_name})` : `(${t("common.none")})`}
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.workbenchViews")}</h3>
        <div className="grid grid-cols-1 gap-1">
          {workbenchViews.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewMode(item.id)}
              className={`rounded border px-2 py-1 text-left text-[11px] uppercase tracking-wide ${
                viewMode === item.id
                  ? "border-sky-400 bg-[#123251] text-slate-100"
                  : "border-line bg-[#0b1a2e] text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.diagnosticMode")}</h3>
        <div className="grid grid-cols-3 gap-1">
          {diagnosticModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                diagnosticMode === mode.id
                  ? "border-sky-400 bg-[#123251] text-slate-100"
                  : "border-line bg-[#0b1a2e] text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setDiagnosticMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {diagnosticFocusModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${
                diagnosticFocus === mode.id
                  ? "border-amber-400 bg-[#32230e] text-amber-100"
                  : "border-line bg-[#0b1a2e] text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => {
                setViewMode("diagnostics");
                setDiagnosticFocus(mode.id);
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.search")}</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("filter.searchPlaceholder")}
          className="w-full rounded border border-line bg-[#091425] px-2 py-1 text-xs text-slate-200 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-400"
        />
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
          {[
            "type:tool",
            "district:llm",
            "status:error",
            "has:retry",
            "latency>700",
            "qps>10",
            "protocol:mcp",
            "trace:trace_",
          ].map((example) => (
            <button
              key={example}
              type="button"
              className="rounded border border-line bg-[#0b1728] px-1.5 py-0.5 hover:border-sky-400 hover:text-slate-300"
              onClick={() => setSearchQuery(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.district")}</h3>
        {topology?.districts.map((district) => {
          const checked = filters.districtIds.includes(district.id);
          return (
            <label key={district.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setDistrictFilter(toggle(filters.districtIds, district.id))}
              />
              <span>{district.name}</span>
            </label>
          );
        })}
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.nodeType")}</h3>
        {nodeTypes.map((type) => {
          const checked = filters.nodeTypes.includes(type);
          return (
            <label key={type} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setNodeTypeFilter(toggle(filters.nodeTypes, type))}
              />
              <span>{type}</span>
            </label>
          );
        })}
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.status")}</h3>
        {statusOptions.map((status) => (
          <label key={status} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={filters.statuses.includes(status)}
              onChange={() => setStatusFilter(toggle(filters.statuses, status))}
            />
            <span>{status}</span>
          </label>
        ))}
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.spanKind")}</h3>
        {spanKindOptions.map((spanKind) => (
          <label key={spanKind} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={filters.spanKinds.includes(spanKind)}
              onChange={() => setSpanKindFilter(toggle(filters.spanKinds, spanKind))}
            />
            <span>{spanKind}</span>
          </label>
        ))}
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.trace")}</h3>
        <select
          className="w-full border border-line bg-[#0a1828] p-1 text-xs text-slate-200"
          value={filters.traceId ?? ""}
          onChange={(event) => setTraceFilter(event.target.value || undefined)}
        >
          <option value="">{t("filter.allTraces")}</option>
          {traces.map((trace) => (
            <option key={trace.envelope.trace_id} value={trace.envelope.trace_id}>
              {trace.envelope.trace_id}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">{t("filter.flowLegend")}</h3>
        <div className="grid grid-cols-1 gap-1">
          {flowLegend.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{item.label}</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
