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

function severityColor(level: string): string {
  if (level === "high") return "bg-rose-500/20 text-rose-200";
  if (level === "medium") return "bg-amber-500/20 text-amber-200";
  return "bg-sky-500/20 text-sky-200";
}

export function ParserAnalysisCenter() {
  const [exporting, setExporting] = useState(false);
  const [running, setRunning] = useState<"reparse" | "regression" | "report" | null>(null);
  const [message, setMessage] = useState("");

  const target = useDashboardStore((state) => state.target);
  const report = useDashboardStore((state) => state.parserAnalysis);
  const repositories = useDashboardStore((state) => state.repositories);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);

  const sourceCoverage = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.source_coverage);
  }, [report]);

  const unresolvedCategory = useMemo(() => {
    if (!report) return [];
    const map = new Map<string, number>();
    for (const symbol of report.unresolved_symbols) {
      const key = symbol.includes(":") ? symbol.split(":")[0] : "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [report]);

  const currentRepo = repositories.find((repo) => repo.target_id === target);
  const repoScore = currentRepo
    ? currentRepo.parser_confidence * 0.6 +
      (1 - Math.min(1, currentRepo.unresolved_count / 30)) * 0.2 +
      (1 - Math.min(1, currentRepo.inferred_edge_count / 40)) * 0.2
    : 0;
  const scoreLabel = repoScore >= 0.85 ? "A" : repoScore >= 0.72 ? "B" : repoScore >= 0.55 ? "C" : "D";

  const runControlJob = async (kind: "reparse" | "regression" | "report") => {
    setRunning(kind);
    try {
      if (kind === "reparse") {
        const response = await api.runJob({
          type: "reparse_repository",
          target,
          payload: { target_id: target },
        });
        upsertControlJob(response.job);
        setMessage(`re-parse queued: ${shortId(response.job.id)}`);
      } else if (kind === "regression") {
        const response = await api.runJob({
          type: "parser_regression",
          target,
          payload: {},
        });
        upsertControlJob(response.job);
        setMessage(`regression queued: ${shortId(response.job.id)}`);
      } else {
        const response = await api.runJob({
          type: "generate_report",
          target,
          payload: {},
        });
        upsertControlJob(response.job);
        setMessage(`report job queued: ${shortId(response.job.id)}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "job request failed");
    } finally {
      setRunning(null);
    }
  };

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
      setMessage("analysis report exported");
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">Parser Analysis Center</div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => runControlJob("reparse")}
              disabled={running === "reparse"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400 disabled:opacity-60"
            >
              {running === "reparse" ? "queueing..." : "re-parse"}
            </button>
            <button
              type="button"
              onClick={() => runControlJob("regression")}
              disabled={running === "regression"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400 disabled:opacity-60"
            >
              {running === "regression" ? "queueing..." : "run regression"}
            </button>
            <button
              type="button"
              onClick={() => runControlJob("report")}
              disabled={running === "report"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400 disabled:opacity-60"
            >
              {running === "report" ? "queueing..." : "generate report"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded border border-line bg-[#123a2f] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400 disabled:opacity-60"
            >
              {exporting ? "exporting..." : "export markdown"}
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 xl:grid-cols-4">
          <div>target: {target}</div>
          <div>confidence: {report.parser_confidence.toFixed(3)} ({report.parser_grade})</div>
          <div>quality score: {repoScore.toFixed(3)} ({scoreLabel})</div>
          <div>unresolved: {report.unresolved_symbols.length}</div>
        </div>
        {message ? <div className="mt-2 text-[11px] text-emerald-300">{message}</div> : null}
      </div>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Project Matrix</div>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[11px] text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">repository</th>
                <th className="px-2 py-1 text-left">target</th>
                <th className="px-2 py-1 text-left">confidence</th>
                <th className="px-2 py-1 text-left">unresolved</th>
                <th className="px-2 py-1 text-left">inferred</th>
                <th className="px-2 py-1 text-left">status</th>
                <th className="px-2 py-1 text-left">actions</th>
              </tr>
            </thead>
            <tbody>
              {repositories.map((repo) => (
                <tr key={repo.id} className="border-t border-line/70">
                  <td className="px-2 py-1">{repo.name}</td>
                  <td className="px-2 py-1 font-mono">{shortId(repo.target_id)}</td>
                  <td className="px-2 py-1">{repo.parser_confidence.toFixed(3)} ({repo.parser_grade})</td>
                  <td className="px-2 py-1">{repo.unresolved_count}</td>
                  <td className="px-2 py-1">{repo.inferred_edge_count}</td>
                  <td className="px-2 py-1">{repo.status}</td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] hover:border-sky-400"
                      onClick={() => setTarget(repo.target_id)}
                    >
                      open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Source Coverage</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] xl:grid-cols-3">
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
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Unresolved Categories</div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-300">
            {unresolvedCategory.length === 0 && <div className="text-slate-500">No unresolved symbol.</div>}
            {unresolvedCategory.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded border border-line bg-[#101f34] px-2 py-1">
                <span>{label}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
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
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${severityColor(issue.severity)}`}>
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
          {report.low_confidence_edges.slice(0, 16).map((edge) => {
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
