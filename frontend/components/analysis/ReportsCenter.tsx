"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ReportArtifact } from "@/types/schema";

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

async function saveReportContent(defaultFileName: string, content: string): Promise<{ ok: boolean; path?: string }> {
  if (window.agentCityDesktop?.saveTextReport) {
    const result = await window.agentCityDesktop.saveTextReport({
      defaultFileName,
      content,
    });
    return { ok: Boolean(result.ok), path: result.path };
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
  const target = useDashboardStore((state) => state.target);
  const desktopStatus = useDashboardStore((state) => state.desktopStatus);

  const [reports, setReports] = useState<ReportArtifact[]>([]);
  const [docsRoot, setDocsRoot] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<string>();
  const [reportContent, setReportContent] = useState<string>("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId),
    [reports, selectedReportId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setMessage("");

    api
      .getReports()
      .then((payload) => {
        if (cancelled) return;
        setReports(payload.items);
        setDocsRoot(payload.docs_root);
        if (!selectedReportId && payload.items.length > 0) {
          setSelectedReportId(payload.items[0].id);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "failed to load reports");
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
  }, [target]);

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
          setMessage(error instanceof Error ? error.message : "failed to load report content");
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
        setMessage(result.path ? `analysis report exported: ${result.path}` : "analysis report exported");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "failed to export analysis report");
    } finally {
      setExporting(false);
    }
  };

  const saveCurrentDocument = async () => {
    if (!selectedReport) return;
    const result = await saveReportContent(selectedReport.file_name, reportContent);
    if (result.ok) {
      setMessage(result.path ? `saved: ${result.path}` : "document exported");
    }
  };

  const openDocsDirectory = async () => {
    if (window.agentCityDesktop?.openReportsDirectory) {
      const result = await window.agentCityDesktop.openReportsDirectory();
      if (!result.ok) {
        setMessage(result.message ?? "failed to open docs directory");
      }
      return;
    }

    setMessage(`desktop shell not attached; docs root: ${docsRoot}`);
  };

  return (
    <section data-testid="reports-center" className="flex h-full min-h-0 flex-col overflow-hidden p-3">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">Reports Center</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-sky-400"
              onClick={openDocsDirectory}
            >
              open docs directory
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={exportCurrentAnalysis}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-emerald-400 disabled:opacity-60"
            >
              {exporting ? "exporting..." : "export live analysis"}
            </button>
            <button
              type="button"
              onClick={saveCurrentDocument}
              disabled={!selectedReport}
              className="rounded border border-line bg-[#10243a] px-2 py-1 text-slate-200 hover:border-sky-400 disabled:opacity-50"
            >
              export selected document
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-400 xl:grid-cols-3">
          <div>target: {target}</div>
          <div>shell: {desktopStatus?.shellMode ?? "browser"}</div>
          <div>docs root: {docsRoot || "not available"}</div>
        </div>

        {message && <div className="mt-2 text-xs text-emerald-300">{message}</div>}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[340px_1fr]">
        <section className="min-h-0 overflow-y-auto rounded border border-line bg-[#0a1626] p-2 scrollbar-thin">
          <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Artifacts</div>
          {loadingList && <div className="mt-2 text-[11px] text-slate-500">loading report catalog...</div>}
          {!loadingList && reports.length === 0 && (
            <div className="mt-2 text-[11px] text-slate-500">no report artifact found</div>
          )}
          <div className="mt-2 space-y-1">
            {reports.map((artifact) => (
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
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded border border-line bg-[#0a1626]">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] text-slate-400">
            <div>
              {selectedReport ? `${selectedReport.title} (${selectedReport.file_name})` : "select a report"}
            </div>
            {selectedReport && (
              <div>
                updated: {formatTime(selectedReport.updated_at)} | id: {shortId(selectedReport.id)}
              </div>
            )}
          </div>

          <div className="h-[calc(100%-37px)] overflow-y-auto p-3 scrollbar-thin">
            {loadingContent && <div className="text-[11px] text-slate-500">loading report content...</div>}
            {!loadingContent && !selectedReport && <div className="text-[11px] text-slate-500">no report selected</div>}
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
