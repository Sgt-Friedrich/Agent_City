"use client";

import type { ReactNode } from "react";

import { prettyMs, prettyPct, shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";

function Block({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-line bg-[#0a1626] p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="panel-title text-xs uppercase tracking-wide text-slate-200">{title}</h3>
        <span className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] text-sky-200">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function DiagnosticsCenter() {
  const diagnostics = useDashboardStore((state) => state.diagnosticsSummary);
  const diagnosticFocus = useDashboardStore((state) => state.diagnosticFocus);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const recentTraceHandles = Array.from(
    new Set(diagnostics?.error_nodes.flatMap((node) => node.recent_trace_ids) ?? []),
  ).slice(0, 10);

  if (!diagnostics) {
    return (
      <section className="h-full overflow-y-auto p-3 text-xs text-slate-400">
        Diagnostics data loading...
      </section>
    );
  }

  const focusCards: Array<{
    id: "all" | "errors" | "slow" | "congestion" | "retry_fallback";
    label: string;
    count: number;
    dsl: string;
  }> = [
    {
      id: "all",
      label: "all",
      count: diagnostics.active_trace_count,
      dsl: "",
    },
    {
      id: "errors",
      label: "errors",
      count: diagnostics.error_event_count,
      dsl: "status:error has:error",
    },
    {
      id: "slow",
      label: "slow",
      count: diagnostics.slow_nodes.length,
      dsl: "latency>700",
    },
    {
      id: "congestion",
      label: "congestion",
      count: diagnostics.congested_nodes.length,
      dsl: "has:error qps>5",
    },
    {
      id: "retry_fallback",
      label: "retry/fallback",
      count: diagnostics.retry_event_count + diagnostics.fallback_event_count,
      dsl: "has:retry,fallback",
    },
  ];

  return (
    <section data-testid="diagnostics-center" className="h-full overflow-y-auto p-3 scrollbar-thin">
      <div className="rounded border border-line bg-[#091626] p-2 text-xs text-slate-300">
        <div className="panel-title text-sm uppercase tracking-wide text-slate-100">Diagnostics Center</div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
          <div>active traces: {diagnostics.active_trace_count}</div>
          <div>inferred edges: {diagnostics.inferred_edge_count}</div>
          <div>retry events: {diagnostics.retry_event_count}</div>
          <div>fallback events: {diagnostics.fallback_event_count}</div>
          <div>error events: {diagnostics.error_event_count}</div>
          <div>nodes/edges: {diagnostics.total_nodes}/{diagnostics.total_edges}</div>
        </div>
      </div>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Diagnostic Focus</div>
        <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-5">
          {focusCards.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded border px-2 py-1 text-left ${
                diagnosticFocus === item.id
                  ? "border-amber-400 bg-[#2f2512] text-amber-100"
                  : "border-line bg-[#0f1f33] text-slate-300 hover:border-sky-400"
              }`}
              onClick={() => {
                setViewMode("diagnostics");
                setDiagnosticFocus(item.id);
                setSearchQuery(item.dsl);
              }}
            >
              <div className="text-[10px] uppercase tracking-wide">{item.label}</div>
              <div className="mt-1 text-sm">{item.count}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <Block title="Slow Nodes" count={diagnostics.slow_nodes.length}>
          {diagnostics.slow_nodes.length === 0 && (
            <div className="text-[11px] text-slate-500">No node exceeds latency threshold.</div>
          )}
          {diagnostics.slow_nodes.map((item) => (
            <button
              key={item.node_id}
              type="button"
              onClick={() => {
                setSelectedNode(item.node_id);
                setViewMode("diagnostics");
                setDiagnosticFocus("slow");
                setSearchQuery(`node:${item.node_id}`);
              }}
              className="w-full rounded border border-line bg-[#0c1a2d] px-2 py-1 text-left hover:border-sky-500"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-200">{item.name}</span>
                <span className="text-[10px] text-amber-300">{prettyMs(item.p95_ms)}</span>
              </div>
              <div className="text-[10px] text-slate-400">{item.reason}</div>
            </button>
          ))}
        </Block>

        <Block title="Error Nodes" count={diagnostics.error_nodes.length}>
          {diagnostics.error_nodes.length === 0 && (
            <div className="text-[11px] text-slate-500">No node currently marked as error-dominant.</div>
          )}
          {diagnostics.error_nodes.map((item) => (
            <button
              key={item.node_id}
              type="button"
              onClick={() => {
                setSelectedNode(item.node_id);
                setViewMode("diagnostics");
                setDiagnosticFocus("errors");
                setSearchQuery(`status:error node:${item.node_id}`);
              }}
              className="w-full rounded border border-rose-500/40 bg-[#2a1418] px-2 py-1 text-left hover:border-rose-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-rose-100">{item.name}</span>
                <span className="text-[10px] text-rose-300">{prettyPct(item.error_rate)}</span>
              </div>
              <div className="text-[10px] text-slate-300">
                queue {item.queue_depth} | active {item.active_count}
              </div>
            </button>
          ))}
        </Block>

        <Block title="Congested Nodes" count={diagnostics.congested_nodes.length}>
          {diagnostics.congested_nodes.length === 0 && (
            <div className="text-[11px] text-slate-500">No congestion hotspot detected.</div>
          )}
          {diagnostics.congested_nodes.map((item) => (
            <button
              key={item.node_id}
              type="button"
              onClick={() => {
                setSelectedNode(item.node_id);
                setViewMode("diagnostics");
                setDiagnosticFocus("congestion");
                setSearchQuery(`node:${item.node_id}`);
              }}
              className="w-full rounded border border-line bg-[#152438] px-2 py-1 text-left hover:border-yellow-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-200">{item.name}</span>
                <span className="text-[10px] text-yellow-300">queue {item.queue_depth}</span>
              </div>
              <div className="text-[10px] text-slate-400">{item.reason}</div>
            </button>
          ))}
        </Block>

        <Block title="Unstable Edges" count={diagnostics.unstable_edges.length}>
          {diagnostics.unstable_edges.length === 0 && (
            <div className="text-[11px] text-slate-500">No unstable edge exceeds threshold.</div>
          )}
          {diagnostics.unstable_edges.map((edge) => (
            <button
              key={edge.edge_id}
              type="button"
              onClick={() => {
                const traceId = diagnostics.slow_nodes.find((node) => node.node_id === edge.from_node)?.recent_trace_ids[0];
                setTraceFilter(traceId);
                setViewMode("diagnostics");
                setDiagnosticFocus("retry_fallback");
                setSearchQuery(`has:retry,fallback node:${edge.from_node}`);
              }}
              className="w-full rounded border border-line bg-[#0c1a2d] px-2 py-1 text-left hover:border-cyan-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-200">
                  {edge.from_node.split(".").at(-1)} -&gt; {edge.to_node.split(".").at(-1)}
                </span>
                <span className="text-[10px] text-cyan-300">{prettyMs(edge.avg_latency_ms)}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                err {edge.error_count} | retry {edge.retry_count} | fallback {edge.fallback_count}
              </div>
            </button>
          ))}
        </Block>
      </div>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Notes</div>
        <div className="mt-1 space-y-1 text-[11px] text-slate-400">
          {diagnostics.notes.map((note, index) => (
            <div key={`${note}-${index}`}>- {note}</div>
          ))}
          {diagnostics.notes.length === 0 && <div>No diagnostic note.</div>}
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#091626] p-2 text-[11px] text-slate-400">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Recent Trace Handles</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {recentTraceHandles.map((traceId) => (
            <button
              key={traceId}
              type="button"
              onClick={() => {
                setTraceFilter(traceId);
                setViewMode("replay");
              }}
              className="rounded border border-line bg-[#10253b] px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-sky-400"
            >
              {shortId(traceId)}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
