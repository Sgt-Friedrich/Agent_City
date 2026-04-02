"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { openReportsDirectory, saveDesktopTextReport } from "@/lib/desktopBridge";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ReportArtifact } from "@/types/schema";

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeArtifact(artifact: ReportArtifact): ReportArtifact {
  return {
    ...artifact,
    related_trace_ids: Array.isArray((artifact as Partial<ReportArtifact>).related_trace_ids)
      ? artifact.related_trace_ids
      : [],
    related_node_ids: Array.isArray((artifact as Partial<ReportArtifact>).related_node_ids)
      ? artifact.related_node_ids
      : [],
    related_job_ids: Array.isArray((artifact as Partial<ReportArtifact>).related_job_ids)
      ? artifact.related_job_ids
      : [],
  };
}

async function saveReportContent(defaultFileName: string, content: string): Promise<{ ok: boolean; path?: string }> {
  const desktopResult = await saveDesktopTextReport({
    defaultFileName,
    content,
  });

  if (desktopResult.ok) {
    return { ok: true, path: desktopResult.path };
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultFileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export function ReportsCenter() {
  const { t, formatDateTime } = useI18n();
  const target = useDashboardStore((state) => state.target);
  const desktopStatus = useDashboardStore((state) => state.desktopStatus);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);

  const [reports, setReports] = useState<ReportArtifact[]>([]);
  const [docsRoot, setDocsRoot] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<string>();
  const [reportContent, setReportContent] = useState<string>("");
  const [reportSearch, setReportSearch] = useState<string>("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId),
    [reports, selectedReportId],
  );
  const filteredReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      item.file_name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query),
    );
  }, [reportSearch, reports]);

  const deepLinks = useMemo(() => {
    const contentTraces = Array.from(
      new Set(reportContent.match(/trace_[a-z0-9]+/gi) ?? []),
    ).slice(0, 8);
    const contentNodes = Array.from(
      new Set(reportContent.match(/node(?:[._][a-z0-9_]+)+/gi) ?? []),
    ).slice(0, 8);
    const contentJobs = Array.from(
      new Set(reportContent.match(/job_[a-z0-9_]+/gi) ?? []),
    ).slice(0, 6);
    const traces = Array.from(
      new Set([...(selectedReport?.related_trace_ids ?? []), ...contentTraces]),
    ).slice(0, 8);
    const nodes = Array.from(
      new Set([...(selectedReport?.related_node_ids ?? []), ...contentNodes]),
    ).slice(0, 8);
    const jobs = Array.from(
      new Set([...(selectedReport?.related_job_ids ?? []), ...contentJobs]),
    ).slice(0, 8);
    return { traces, nodes, jobs };
  }, [reportContent, selectedReport?.related_job_ids, selectedReport?.related_node_ids, selectedReport?.related_trace_ids]);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setMessage("");

    api
      .getReports()
      .then((payload) => {
        if (cancelled) return;
        setReports(payload.items.map((artifact) => normalizeArtifact(artifact)));
        setDocsRoot(payload.docs_root);
        if (!selectedReportId && payload.items.length > 0) {
          setSelectedReportId(payload.items[0].id);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : t("reports.noArtifact"));
          setReports([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingList(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target, selectedReportId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedReportId) {
      setReportContent("");
      return;
    }

    setLoadingContent(true);
    api
      .getReportContent(selectedReportId)
      .then((payload) => {
        if (!cancelled) {
          setReportContent(payload.content);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReportContent("");
          setMessage(error instanceof Error ? error.message : t("reports.loadingContent"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedReportId]);

  const exportCurrentAnalysis = async () => {
    try {
      setExporting(true);
      setMessage("");
      const markdown = await api.getAnalysisReportMarkdown(target);
      const result = await saveReportContent(`agent_city_analysis_${target}.md`, markdown);
      if (result.ok) {
        setMessage(result.path ? `${t("common.export")}: ${result.path}` : t("common.export"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.export"));
    } finally {
      setExporting(false);
    }
  };

  const saveCurrentDocument = async () => {
    if (!selectedReport) return;
    const result = await saveReportContent(selectedReport.file_name, reportContent);
    if (result.ok) {
      setMessage(result.path ? `${t("reports.saved")}: ${result.path}` : t("common.export"));
    }
  };

  const openDocsDirectory = async () => {
    const result = await openReportsDirectory();
    if (!result.ok) {
      setMessage(result.message ?? `${t("reports.docsHint")}: ${docsRoot}`);
    }
  };

  const openTraceReplay = (traceId: string) => {
    const params = new URLSearchParams({ traceId, target });
    window.location.href = `/replay?${params.toString()}`;
  };

  const jumpByReportCategory = () => {
    if (!selectedReport) return;
    if (selectedReport.category === "parser") {
      setViewMode("parser_analysis");
      return;
    }
    if (selectedReport.category === "frontend" || selectedReport.category === "system") {
      setViewMode("jobs");
      return;
    }
    if (selectedReport.category === "architecture" || selectedReport.category === "operations") {
      setViewMode("overview");
    }
  };

  return (
    <section data-testid="reports-center" className="flex h-full min-h-0 flex-col overflow-hidden p-3">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("reports.title")}</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-sky-400"
              onClick={openDocsDirectory}
            >
              {t("reports.openDocsDirectory")}
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={exportCurrentAnalysis}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-emerald-400 disabled:opacity-60"
            >
              {exporting ? t("reports.exporting") : t("reports.exportAnalysis")}
            </button>
            <button
              type="button"
              onClick={saveCurrentDocument}
              disabled={!selectedReport}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-sky-400 disabled:opacity-50"
            >
              {t("reports.exportSelected")}
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-400 xl:grid-cols-3">
          <div>{t("reports.meta.target")}: {target}</div>
          <div>{t("reports.meta.shell")}: {desktopStatus?.shellMode ?? t("header.browserMode")}</div>
          <div>{t("reports.meta.docsRoot")}: {docsRoot || t("common.na")}</div>
        </div>

        {message && <div className="mt-2 text-xs text-emerald-300">{message}</div>}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[340px_1fr]">
        <section className="min-h-0 overflow-y-auto rounded border border-line bg-[#0a1626] p-2 scrollbar-thin">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("reports.artifacts")}</div>
          <input
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder={t("reports.searchPlaceholder")}
            className="mt-2 w-full rounded border border-line bg-[#0f1f32] px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
          />
          {loadingList && <div className="mt-2 text-[11px] text-slate-500">{t("reports.loadingCatalog")}</div>}
          {!loadingList && filteredReports.length === 0 && (
            <div className="mt-2 text-[11px] text-slate-500">{t("reports.noArtifact")}</div>
          )}
          <div className="mt-2 space-y-1">
            {filteredReports.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`w-full rounded border px-2 py-1 text-left text-[11px] ${
                  selectedReportId === artifact.id
                    ? "border-sky-400 bg-[#12304d] text-slate-100"
                    : "border-line bg-[#0e1d31] text-slate-300 hover:border-sky-300"
                }`}
                onClick={() => setSelectedReportId(artifact.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{artifact.title}</span>
                  <span className="rounded border border-line px-1 py-0.5 text-[10px] text-slate-400">
                    {artifact.category}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {artifact.file_name} | {prettySize(artifact.size_bytes)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {t("reports.meta.links")}: T{artifact.related_trace_ids?.length ?? 0} / N{artifact.related_node_ids?.length ?? 0} / J{artifact.related_job_ids?.length ?? 0}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded border border-line bg-[#0a1626]">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] text-slate-400">
            <div>
              {selectedReport ? `${selectedReport.title} (${selectedReport.file_name})` : t("reports.noSelected")}
            </div>
            {selectedReport && (
              <div>
                updated: {formatDateTime(selectedReport.updated_at)} | id: {shortId(selectedReport.id)}
              </div>
            )}
          </div>

          <div className="h-[calc(100%-37px)] overflow-y-auto p-3 scrollbar-thin">
            {loadingContent && <div className="text-[11px] text-slate-500">{t("reports.loadingContent")}</div>}
            {!loadingContent && !selectedReport && <div className="text-[11px] text-slate-500">{t("reports.noSelected")}</div>}
            {!loadingContent && selectedReport && (
              <div className="mb-3 rounded border border-line bg-[#0f2136] p-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={jumpByReportCategory}
                    className="rounded border border-line bg-[#12314d] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
                  >
                    {t("reports.openRelatedWorkspace")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("jobs");
                      setSearchQuery("generate_report");
                    }}
                    className="rounded border border-line bg-[#10302a] px-2 py-1 text-[11px] text-slate-100 hover:border-emerald-400"
                  >
                    {t("reports.openGeneratorJobs")}
                  </button>
                  <span className="text-slate-400">{t("reports.category")}: {selectedReport.category}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {deepLinks.traces.map((traceId) => (
                    <button
                      key={traceId}
                      type="button"
                      onClick={() => {
                        setTraceFilter(traceId);
                        setSelectedTrace(traceId);
                        setViewMode("replay");
                      }}
                      className="rounded border border-line bg-[#0b192c] px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-cyan-400"
                    >
                      {t("reports.link.trace")}: {shortId(traceId)}
                    </button>
                  ))}
                  {deepLinks.nodes.map((nodeId) => (
                    <button
                      key={nodeId}
                      type="button"
                      onClick={() => {
                        setSelectedNode(nodeId);
                        setViewMode("diagnostics");
                        setSearchQuery(`node:${nodeId}`);
                      }}
                      className="rounded border border-line bg-[#0b192c] px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-amber-400"
                    >
                      {t("reports.link.node")}: {nodeId.split(".").at(-1)}
                    </button>
                  ))}
                  {deepLinks.jobs.map((jobId) => (
                    <button
                      key={jobId}
                      type="button"
                      onClick={() => {
                        setViewMode("jobs");
                        setSearchQuery(jobId);
                      }}
                      className="rounded border border-line bg-[#0b192c] px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-emerald-400"
                    >
                      {t("reports.link.job")}: {shortId(jobId)}
                    </button>
                  ))}
                  {deepLinks.traces.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openTraceReplay(deepLinks.traces[0])}
                      className="rounded border border-line bg-[#173a2d] px-1.5 py-0.5 text-[10px] text-emerald-100 hover:border-emerald-400"
                    >
                      {t("reports.openReplayTrace")}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
            {!loadingContent && selectedReport && (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-200">
                {reportContent}
              </pre>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
