"use client";

import { useMemo } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

interface Suggestion {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  action: () => void;
}

export function NextStepPanel() {
  const diagnostics = useDashboardStore((state) => state.diagnosticsSummary);
  const parser = useDashboardStore((state) => state.parserAnalysis);
  const traces = useDashboardStore((state) => state.traces);
  const repositories = useDashboardStore((state) => state.repositories);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setTarget = useDashboardStore((state) => state.setTarget);

  const suggestions = useMemo<Suggestion[]>(() => {
    const result: Suggestion[] = [];

    if ((diagnostics?.error_event_count ?? 0) > 0) {
      result.push({
        id: "error-chain",
        title: "Investigate error chain",
        detail: `${diagnostics?.error_event_count ?? 0} error events were detected in recent traces.`,
        actionLabel: "open diagnostics",
        action: () => {
          setViewMode("diagnostics");
          setDiagnosticMode("errors");
          setDiagnosticFocus("errors");
          setSearchQuery("status:error has:error");
        },
      });
    }

    if ((diagnostics?.retry_event_count ?? 0) + (diagnostics?.fallback_event_count ?? 0) > 0) {
      result.push({
        id: "retry-fallback",
        title: "Review retry/fallback behavior",
        detail: `retry=${diagnostics?.retry_event_count ?? 0}, fallback=${diagnostics?.fallback_event_count ?? 0}`,
        actionLabel: "focus retry/fallback",
        action: () => {
          setViewMode("diagnostics");
          setDiagnosticFocus("retry_fallback");
          setSearchQuery("has:retry,fallback");
        },
      });
    }

    if ((parser?.parser_confidence ?? 1) < 0.75) {
      result.push({
        id: "parser-confidence",
        title: "Improve parser confidence",
        detail: `Current confidence is ${(parser?.parser_confidence ?? 0).toFixed(3)}.`,
        actionLabel: "open parser analysis",
        action: () => {
          setViewMode("parser_analysis");
          setSearchQuery("");
        },
      });
    }

    if (traces.length > 0) {
      result.push({
        id: "hot-trace",
        title: "Replay latest trace",
        detail: `Latest trace ${traces[0].envelope.trace_id} can be replayed for root-cause drill-down.`,
        actionLabel: "open replay mode",
        action: () => {
          setTraceFilter(traces[0].envelope.trace_id);
          setViewMode("replay");
        },
      });
    }

    const lowRepo = repositories
      .filter((repo) => repo.parser_confidence < 0.72)
      .sort((a, b) => a.parser_confidence - b.parser_confidence)[0];
    if (lowRepo) {
      result.push({
        id: "low-repo",
        title: "Re-parse low quality repository",
        detail: `${lowRepo.name} confidence=${lowRepo.parser_confidence.toFixed(3)} unresolved=${lowRepo.unresolved_count}`,
        actionLabel: "switch repository",
        action: () => {
          setTarget(lowRepo.target_id);
          setViewMode("repositories");
        },
      });
    }

    return result.slice(0, 4);
  }, [
    diagnostics?.error_event_count,
    diagnostics?.fallback_event_count,
    diagnostics?.retry_event_count,
    parser?.parser_confidence,
    repositories,
    setDiagnosticFocus,
    setDiagnosticMode,
    setSearchQuery,
    setTarget,
    setTraceFilter,
    setViewMode,
    traces,
  ]);

  return (
    <section className="mt-3 rounded border border-line bg-[#0a1626] p-2">
      <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Recommended Next Steps</div>
      <div className="mt-2 space-y-2">
        {suggestions.length === 0 && (
          <div className="text-[11px] text-slate-500">No urgent recommendation. Continue in Overview or Live mode.</div>
        )}
        {suggestions.map((item) => (
          <div key={item.id} className="rounded border border-line bg-[#0f2034] p-2 text-[11px] text-slate-300">
            <div className="text-slate-100">{item.title}</div>
            <div className="mt-1 text-slate-400">{item.detail}</div>
            <button
              type="button"
              className="mt-2 rounded border border-line bg-[#123251] px-2 py-1 text-[10px] uppercase tracking-wide text-slate-100 hover:border-sky-400"
              onClick={item.action}
            >
              {item.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
