"use client";

import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { shortId } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useDashboardStore } from "@/store/useDashboardStore";
import { Edge, ParserAnalysisIssue } from "@/types/schema";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function resolveEdgeEndpoint(edge: Edge, side: "from" | "to"): string {
  const legacy = side === "from" ? "from_node" : "to_node";
  const value = (edge as Edge & { from_node?: string; to_node?: string })[side]
    ?? (edge as Edge & { from_node?: string; to_node?: string })[legacy];
  return typeof value === "string" && value.length > 0 ? value : "unknown";
}

function shortName(nodeId: string): string {
  return nodeId.split(".").at(-1) ?? nodeId;
}

function issueSeverityRank(issue: ParserAnalysisIssue): number {
  if (issue.severity === "high") return 3;
  if (issue.severity === "medium") return 2;
  return 1;
}

function severityClass(level: string): string {
  if (level === "high") return "bg-rose-500/20 text-rose-200";
  if (level === "medium") return "bg-amber-500/20 text-amber-200";
  return "bg-sky-500/20 text-sky-200";
}

export function ParserAnalysisCenter() {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [running, setRunning] = useState<"reparse" | "regression" | "report" | null>(null);
  const [message, setMessage] = useState("");

  const target = useDashboardStore((state) => state.target);
  const report = useDashboardStore((state) => state.parserAnalysis);
  const repositories = useDashboardStore((state) => state.repositories);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
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
    ? currentRepo.parser_confidence * 0.6
      + (1 - Math.min(1, currentRepo.unresolved_count / 30)) * 0.2
      + (1 - Math.min(1, currentRepo.inferred_edge_count / 40)) * 0.2
    : 0;
  const scoreLabel = repoScore >= 0.85 ? "A" : repoScore >= 0.72 ? "B" : repoScore >= 0.55 ? "C" : "D";

  const prioritizedIssues = useMemo(
    () => [...(report?.issues ?? [])].sort((a, b) => issueSeverityRank(b) - issueSeverityRank(a)).slice(0, 8),
    [report?.issues],
  );

  const summaryItems = useMemo(() => {
    if (!report) {
      return [] as Array<{ level: "high" | "medium" | "low"; text: string }>;
    }

    const items: Array<{ level: "high" | "medium" | "low"; text: string }> = [];
    if (report.parser_confidence < 0.7) {
      items.push({
        level: "high",
        text: `${t("parser.summary.confidence")} ${report.parser_confidence.toFixed(3)} < 0.70`,
      });
    }
    if (report.unresolved_symbols.length > 18) {
      items.push({
        level: "high",
        text: `${t("parser.summary.unresolved")} ${report.unresolved_symbols.length} > 18`,
      });
    }
    if (report.inferred_edge_count > report.declared_edge_count) {
      items.push({
        level: "medium",
        text: t("parser.summary.inferredDominates"),
      });
    }
    if (report.issues.length > 0 && !items.length) {
      items.push({
        level: "low",
        text: t("parser.summary.actionRecommended"),
      });
    }
    if (!items.length) {
      items.push({
        level: "low",
        text: t("parser.summary.stable"),
      });
    }
    return items.slice(0, 3);
  }, [
    report?.declared_edge_count,
    report?.inferred_edge_count,
    report?.issues.length,
    report?.parser_confidence,
    report?.unresolved_symbols.length,
    t,
  ]);

  const recommendedActions = useMemo(
    () => [
      {
        id: "action-reparse",
        label: t("parser.action.reparse"),
        run: () => runControlJob("reparse"),
      },
      {
        id: "action-regression",
        label: t("parser.action.regression"),
        run: () => runControlJob("regression"),
      },
      {
        id: "action-open-errors",
        label: t("parser.action.openDiagnostics"),
        run: () => {
          setViewMode("diagnostics");
          setDiagnosticFocus("errors");
          setSearchQuery("status:error");
        },
      },
      {
        id: "action-open-repositories",
        label: t("parser.action.openRepositories"),
        run: () => setViewMode("repositories"),
      },
    ],
    [setDiagnosticFocus, setSearchQuery, setViewMode, t],
  );

  async function runControlJob(kind: "reparse" | "regression" | "report") {
    setRunning(kind);
    try {
      if (kind === "reparse") {
        const response = await api.runJob({
          type: "reparse_repository",
          target,
          payload: { target_id: target },
        });
        upsertControlJob(response.job);
        setMessage(`${t("parser.action.reparse")} #${shortId(response.job.id)}`);
      } else if (kind === "regression") {
        const response = await api.runJob({
          type: "parser_regression",
          target,
          payload: {},
        });
        upsertControlJob(response.job);
        setMessage(`${t("parser.action.regression")} #${shortId(response.job.id)}`);
      } else {
        const response = await api.runJob({
          type: "generate_report",
          target,
          payload: {},
        });
        upsertControlJob(response.job);
        setMessage(`${t("parser.action.report")} #${shortId(response.job.id)}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("repositories.jobFailed"));
    } finally {
      setRunning(null);
    }
  }

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
      setMessage(t("parser.exported"));
    } finally {
      setExporting(false);
    }
  };

  if (!report) {
    return (
      <section data-testid="parser-analysis-center" className="h-full overflow-y-auto p-3 text-xs text-slate-400">
        {t("parser.loading")}
      </section>
    );
  }

  return (
    <section data-testid="parser-analysis-center" className="h-full overflow-y-auto p-3 scrollbar-thin">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">
            {t("parser.centerTitle")}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => runControlJob("reparse")}
              disabled={running === "reparse"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400 disabled:opacity-60"
            >
              {running === "reparse" ? t("parser.queueing") : t("parser.action.reparse")}
            </button>
            <button
              type="button"
              onClick={() => runControlJob("regression")}
              disabled={running === "regression"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400 disabled:opacity-60"
            >
              {running === "regression" ? t("parser.queueing") : t("parser.action.regression")}
            </button>
            <button
              type="button"
              onClick={() => runControlJob("report")}
              disabled={running === "report"}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400 disabled:opacity-60"
            >
              {running === "report" ? t("parser.queueing") : t("parser.action.report")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded border border-line bg-[#123a2f] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400 disabled:opacity-60"
            >
              {exporting ? t("reports.exporting") : t("parser.action.export")}
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 xl:grid-cols-4">
          <div>{t("parser.summary.target")}: {target}</div>
          <div>{t("parser.summary.confidence")}: {report.parser_confidence.toFixed(3)} ({report.parser_grade})</div>
          <div>{t("parser.summary.quality")}: {repoScore.toFixed(3)} ({scoreLabel})</div>
          <div>{t("parser.summary.unresolved")}: {report.unresolved_symbols.length}</div>
        </div>
        {message ? <div className="mt-2 text-[11px] text-emerald-300">{message}</div> : null}
      </div>

      <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.executive")}</div>
          <div className="mt-2 space-y-1 text-[11px]">
            {summaryItems.map((item, index) => (
              <div key={`${item.text}-${index}`} className="rounded border border-line bg-[#101f34] p-2 text-slate-300">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.level)}`}>
                  {item.level === "high"
                    ? t("parser.actionability.high")
                    : item.level === "medium"
                      ? t("parser.actionability.medium")
                      : t("parser.actionability.low")}
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.recommendedActions")}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {recommendedActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.run}
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.projectMatrix")}</div>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[11px] text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">{t("parser.table.repository")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.target")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.confidence")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.unresolved")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.inferred")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.status")}</th>
                <th className="px-2 py-1 text-left">{t("parser.table.actions")}</th>
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
                      {t("parser.table.open")}
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
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.issues")}</div>
          <div className="mt-2 space-y-2 text-[11px]">
            {prioritizedIssues.length === 0 && <div className="text-slate-500">{t("parser.issue.none")}</div>}
            {prioritizedIssues.map((issue) => (
              <button
                key={`${issue.category}-${issue.title}`}
                type="button"
                className="w-full rounded border border-line bg-[#101f34] p-2 text-left hover:border-sky-400"
                onClick={() => {
                  setViewMode("diagnostics");
                  setDiagnosticFocus("errors");
                  setSearchQuery(`category:${issue.category}`);
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-100">{issue.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${severityClass(issue.severity)}`}>
                    {issue.severity}
                  </span>
                </div>
                <div className="mt-1 text-slate-400">{issue.detail}</div>
                <div className="mt-1 text-slate-300">{issue.suggestion}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.unresolvedCategory")}</div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-300">
            {unresolvedCategory.length === 0 && <div className="text-slate-500">{t("parser.unresolved.none")}</div>}
            {unresolvedCategory.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded border border-line bg-[#101f34] px-2 py-1">
                <span>{label}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.sourceCoverage")}</div>
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
                {key}: {value ? t("parser.coverage.ok") : t("parser.coverage.missing")}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.unresolvedSymbols")}</div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-400">
            {report.unresolved_symbols.length === 0 && <div>{t("parser.unresolved.none")}</div>}
            {report.unresolved_symbols.slice(0, 24).map((item, index) => (
              <div key={`${item}-${index}`}>- {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.lowConfidenceEdges")}</div>
          <div className="mt-2 space-y-1 text-[11px]">
            {report.low_confidence_edges.length === 0 && <div className="text-slate-500">{t("parser.lowConfidence.none")}</div>}
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
                    setDiagnosticFocus("retry_fallback");
                    setSearchQuery(`node:${fromNode}`);
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
        </div>

        <div className="rounded border border-line bg-[#0a1626] p-2">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("parser.section.recentParseJobs")}</div>
          <div className="mt-2 space-y-1 text-[11px]">
            {report.recent_parse_jobs.length === 0 && <div className="text-slate-500">{t("parser.parseJobs.none")}</div>}
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
        </div>
      </section>
    </section>
  );
}
