"use client";

import { useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { saveDesktopTextReport } from "@/lib/desktopBridge";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { RepositoryRecord } from "@/types/schema";

function statusClass(status: RepositoryRecord["status"]): string {
  if (status === "ready") return "border-emerald-500/40 bg-[#10281f] text-emerald-200";
  if (status === "parsing") return "border-sky-500/40 bg-[#102539] text-sky-200";
  if (status === "failed") return "border-rose-500/40 bg-[#2a1418] text-rose-200";
  return "border-line bg-[#101e31] text-slate-300";
}

export function RepositoriesCenter() {
  const { t, formatDateTime } = useI18n();
  const repositories = useDashboardStore((state) => state.repositories);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);
  const [busyRepo, setBusyRepo] = useState<string>();
  const [message, setMessage] = useState("");

  const runParse = async (repo: RepositoryRecord, force: boolean) => {
    setBusyRepo(repo.target_id);
    try {
      const response = await api.runJob({
        type: force ? "reparse_repository" : "parse_repository",
        target: repo.target_id,
        payload: force ? { target_id: repo.target_id } : { repo_path: repo.path, target_id: repo.target_id },
      });
      upsertControlJob(response.job);
      setMessage(`${force ? t("repositories.actions.reparse") : t("repositories.actions.parse")}: ${repo.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("repositories.jobFailed"));
    } finally {
      setBusyRepo(undefined);
    }
  };

  const removeRepository = async (repo: RepositoryRecord) => {
    if (!window.confirm(`${t("repositories.removeConfirm")} ${repo.name}`)) return;
    setBusyRepo(repo.target_id);
    try {
      await api.removeRepository(repo.target_id);
      setMessage(`${t("repositories.actions.remove")}: ${repo.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("repositories.removeFailed"));
    } finally {
      setBusyRepo(undefined);
    }
  };

  const exportResult = async (repo: RepositoryRecord) => {
    try {
      const markdown = await api.getAnalysisReportMarkdown(repo.target_id);
      const result = await saveDesktopTextReport({
        defaultFileName: `repository_${repo.target_id}_analysis.md`,
        content: markdown,
      });
      if (result.ok) {
        setMessage(`${t("repositories.actions.export")}: ${result.path ?? repo.target_id}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("repositories.exportFailed"));
    }
  };

  return (
    <section className="h-full overflow-y-auto p-3 scrollbar-thin" data-testid="repositories-center">
      <div className="rounded border border-line bg-[#091626] p-2">
        <div className="panel-title text-sm uppercase tracking-wide text-slate-100">
          {t("repositories.title")}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {repositories.length} {t("repositories.count")}
        </div>
        {message ? <div className="mt-1 text-[11px] text-emerald-300">{message}</div> : null}
      </div>

      <div className="mt-3 space-y-2">
        {repositories.length === 0 && (
          <div className="rounded border border-line bg-[#0a1626] p-3 text-xs text-slate-500">
            {t("repositories.empty")}
          </div>
        )}
        {repositories.map((repo) => (
          <article key={repo.id} className="rounded border border-line bg-[#0a1626] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="panel-title text-sm text-slate-100">{repo.name}</div>
                <div className="mt-1 max-w-[820px] truncate text-[11px] text-slate-400" title={repo.path}>
                  {repo.path}
                </div>
              </div>
              <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${statusClass(repo.status)}`}>
                {repo.status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 lg:grid-cols-5">
              <div>
                {t("repositories.lang")}: {repo.languages.join(", ")}
              </div>
              <div>
                {t("repositories.domain")}: {repo.domain}
              </div>
              <div>
                {t("repositories.confidence")}: {repo.parser_confidence.toFixed(3)} ({repo.parser_grade})
              </div>
              <div>
                {t("repositories.unresolved")}: {repo.unresolved_count}
              </div>
              <div>
                {t("repositories.inferred")}: {repo.inferred_edge_count}
              </div>
              <div>
                {t("repositories.nodesEdges")}: {repo.node_count}/{repo.edge_count}
              </div>
              <div>
                {t("repositories.target")}: {shortId(repo.target_id)}
              </div>
              <div>
                {t("repositories.source")}: {repo.source_type}
              </div>
              <div className="col-span-2">
                {t("repositories.lastParsed")}: {formatDateTime(repo.last_parsed_at)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={busyRepo === repo.target_id}
                onClick={() => runParse(repo, false)}
                className="rounded border border-line bg-[#12304a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400 disabled:opacity-50"
              >
                {t("repositories.actions.parse")}
              </button>
              <button
                type="button"
                disabled={busyRepo === repo.target_id}
                onClick={() => runParse(repo, true)}
                className="rounded border border-line bg-[#12304a] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400 disabled:opacity-50"
              >
                {t("repositories.actions.reparse")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTarget(repo.target_id);
                  setViewMode("parser_analysis");
                }}
                className="rounded border border-line bg-[#0f2135] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400"
              >
                {t("repositories.actions.openParser")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTarget(repo.target_id);
                  setViewMode("overview");
                }}
                className="rounded border border-line bg-[#0f2135] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400"
              >
                {t("repositories.actions.openTopology")}
              </button>
              <button
                type="button"
                onClick={() => exportResult(repo)}
                className="rounded border border-line bg-[#0f2135] px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-400"
              >
                {t("repositories.actions.export")}
              </button>
              <button
                type="button"
                disabled={repo.target_id === "mock" || busyRepo === repo.target_id}
                onClick={() => removeRepository(repo)}
                className="rounded border border-rose-500/40 bg-[#2a1418] px-2 py-1 text-[11px] text-rose-200 hover:border-rose-300 disabled:opacity-40"
              >
                {t("repositories.actions.remove")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
