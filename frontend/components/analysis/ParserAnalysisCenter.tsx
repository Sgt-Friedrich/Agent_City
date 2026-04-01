"use client";

import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { Edge } from "@/types/schema";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function resolveEdgeEndpoint(edge: Edge, side: "from" | "to"): string {
  const legacy = side === "from" ? "from_node" : "to_node";
  const value = (edge as Edge & { from_node?: string; to_node?: string })[side] ?? (edge as Edge & { from_node?: string; to_node?: string })[legacy];
  return typeof value === "string" && value.length > 0 ? value : "unknown";
}

function shortName(nodeId: string): string {
  return nodeId.split(".").at(-1) ?? nodeId;
}

export function ParserAnalysisCenter() {
  const [exporting, setExporting] = useState(false);

  const target = useDashboardStore((state) => state.target);
  const report = useDashboardStore((state) => state.parserAnalysis);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const sourceCoverage = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.source_coverage);
  }, [report]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const markdown = await api.getAnalysisReportMarkdown(target);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `agent_city_analysis_${target}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!report) {
    return (
      <section data-testid="parser-analysis-center" className="h-full overflow-y-auto p-3 text-xs text-slate-400">
        Parser analysis loading...
      </section>
    );
  }

  return (
    <section data-testid="parser-analysis-center" className="h-full overflow-y-auto p-3 scrollbar-thin">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="flex items-center justify-between">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">Parser Analysis Center</div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400 disabled:opacity-60"
          >
            {exporting ? "exporting..." : "export report"}
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
          <div>confidence: {report.parser_confidence.toFixed(3)}</div>
          <div>grade: {report.parser_grade}</div>
          <div>declared edges: {report.declared_edge_count}</div>
          <div>observed edges: {report.observed_edge_count}</div>
          <div>inferred edges: {report.inferred_edge_count}</div>
          <div>provisional nodes: {report.provisional_node_count}</div>
        </div>
      </div>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Source Coverage</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          {sourceCoverage.map(([key, value]) => (
            <div
              key={key}
              className={`rounded border px-2 py-1 ${
                value
                  ? "border-emerald-500/40 bg-[#0f2a25] text-emerald-200"
                  : "border-rose-500/40 bg-[#2a1418] text-rose-200"
              }`}
            >
              {key}: {value ? "ok" : "missing"}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Issues</div>
        <div className="mt-2 space-y-2 text-[11px]">
          {report.issues.length === 0 && <div className="text-slate-500">No parser issues flagged.</div>}
          {report.issues.map((issue) => (
            <div key={`${issue.category}-${issue.title}`} className="rounded border border-line bg-[#101f34] p-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-100">{issue.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    issue.severity === "high"
                      ? "bg-rose-500/20 text-rose-200"
                      : issue.severity === "medium"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-sky-500/20 text-sky-200"
                  }`}
                >
                  {issue.severity}
                </span>
              </div>
              <div className="mt-1 text-slate-400">{issue.detail}</div>
              <div className="mt-1 text-slate-300">suggestion: {issue.suggestion}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Role Coverage</div>
          <div className="mt-2 space-y-1 text-[11px]">
            {report.role_coverage.map((point) => (
              <div key={point.label}>
                <div className="flex items-center justify-between text-slate-300">
                  <span>{point.label}</span>
                  <span>{point.count}</span>
                </div>
                <div className="h-1.5 rounded bg-[#12263e]">
                  <div
                    className="h-full rounded bg-gradient-to-r from-cyan-500 to-sky-300"
                    style={{ width: `${Math.min(100, point.count * 7.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">District Coverage</div>
          <div className="mt-2 space-y-1 text-[11px]">
            {report.district_coverage.map((point) => (
              <div key={point.label}>
                <div className="flex items-center justify-between text-slate-300">
                  <span>{point.label}</span>
                  <span>{point.count}</span>
                </div>
                <div className="h-1.5 rounded bg-[#12263e]">
                  <div
                    className="h-full rounded bg-gradient-to-r from-emerald-500 to-cyan-300"
                    style={{ width: `${Math.min(100, point.count * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Low Confidence Edges</div>
        <div className="mt-2 space-y-1 text-[11px]">
          {report.low_confidence_edges.length === 0 && <div className="text-slate-500">No low-confidence edge.</div>}
          {report.low_confidence_edges.slice(0, 12).map((edge) => {
            const fromNode = resolveEdgeEndpoint(edge, "from");
            const toNode = resolveEdgeEndpoint(edge, "to");
            return (
              <button
                key={edge.id}
                type="button"
                className="w-full rounded border border-line bg-[#101f34] px-2 py-1 text-left text-slate-300 hover:border-sky-400"
                onClick={() => {
                  setSelectedNode(fromNode);
                  setViewMode("diagnostics");
                }}
              >
                <div className="flex items-center justify-between">
                  <span>{shortName(fromNode)} -&gt; {shortName(toNode)}</span>
                  <span className="text-slate-400">{pct(edge.confidence)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Recent Parse Jobs</div>
        <div className="mt-2 space-y-1 text-[11px]">
          {report.recent_parse_jobs.length === 0 && <div className="text-slate-500">No parse jobs yet.</div>}
          {report.recent_parse_jobs.map((job) => (
            <div key={job.id} className="rounded border border-line bg-[#101f34] px-2 py-1 text-slate-300">
              <div className="flex items-center justify-between">
                <span>{job.repo_name}</span>
                <span className="text-slate-400">{job.status}</span>
              </div>
              <div className="text-slate-500">
                {shortId(job.id)} | {job.progress}% | {job.step}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Unresolved Symbols</div>
        <div className="mt-2 space-y-1 text-[11px] text-slate-400">
          {report.unresolved_symbols.length === 0 && <div>None</div>}
          {report.unresolved_symbols.map((item, index) => (
            <div key={`${item}-${index}`}>- {item}</div>
          ))}
        </div>
      </section>
    </section>
  );
}
