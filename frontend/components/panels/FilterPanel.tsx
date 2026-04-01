"use client";

import { useMemo } from "react";

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
  const topology = useDashboardStore((state) => state.topology);
  const traces = useDashboardStore((state) => state.traces);
  const filters = useDashboardStore((state) => state.filters);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);
  const searchQuery = useDashboardStore((state) => state.searchQuery);
  const setDistrictFilter = useDashboardStore((state) => state.setDistrictFilter);
  const setNodeTypeFilter = useDashboardStore((state) => state.setNodeTypeFilter);
  const setSpanKindFilter = useDashboardStore((state) => state.setSpanKindFilter);
  const setStatusFilter = useDashboardStore((state) => state.setStatusFilter);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const resetFilters = useDashboardStore((state) => state.resetFilters);

  const nodeTypes = useMemo<NodeType[]>(() => {
    if (!topology) return [];
    return Array.from(new Set(topology.nodes.map((node) => node.type))).sort();
  }, [topology]);

  const diagnosticModes: Array<{ id: DiagnosticMode; label: string }> = [
    { id: "realtime", label: "real-time" },
    { id: "heatmap", label: "heatmap" },
    { id: "errors", label: "errors" },
  ];
  const workbenchViews: Array<{ id: DashboardMode; label: string }> = [
    { id: "overview", label: "overview" },
    { id: "live", label: "live" },
    { id: "diagnostics", label: "diagnostics" },
    { id: "parser_analysis", label: "parser analysis" },
    { id: "reports", label: "reports" },
  ];

  return (
    <aside data-testid="filter-panel" className="h-full max-h-[34vh] overflow-y-auto border-r border-line bg-[#081320cc] p-3 scrollbar-thin lg:max-h-none">
      <div className="flex items-center justify-between">
        <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">Filters</h2>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => resetFilters()}
        >
          reset
        </button>
      </div>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Workbench Views</h3>
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
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Diagnostic Mode</h3>
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
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Search</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="node / trace / protocol..."
          className="w-full rounded border border-line bg-[#091425] px-2 py-1 text-xs text-slate-200 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-400"
        />
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">District</h3>
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
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Node Type</h3>
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
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Status</h3>
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
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Span Kind</h3>
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
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Trace</h3>
        <select
          className="w-full border border-line bg-[#0a1828] p-1 text-xs text-slate-200"
          value={filters.traceId ?? ""}
          onChange={(event) => setTraceFilter(event.target.value || undefined)}
        >
          <option value="">All Traces</option>
          {traces.map((trace) => (
            <option key={trace.envelope.trace_id} value={trace.envelope.trace_id}>
              {trace.envelope.trace_id}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-4 space-y-2 rounded border border-line bg-[#0a1829] p-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">Flow Legend</h3>
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
