"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DiagnosticsCenter } from "@/components/analysis/DiagnosticsCenter";
import { ParserAnalysisCenter } from "@/components/analysis/ParserAnalysisCenter";
import { ReportsCenter } from "@/components/analysis/ReportsCenter";
import { CityScene } from "@/components/city/CityScene";
import { FilterPanel } from "@/components/panels/FilterPanel";
import { DetailDrawer } from "@/components/panels/DetailDrawer";
import { FlowEventHoverCard } from "@/components/panels/FlowEventHoverCard";
import { MetricsHeader } from "@/components/panels/MetricsHeader";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { useAnalysisData } from "@/hooks/useAnalysisData";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useDesktopAppStatus } from "@/hooks/useDesktopAppStatus";
import { useFilteredTopology } from "@/hooks/useFilteredTopology";
import { useLiveFlowSocket } from "@/hooks/useLiveFlowSocket";
import { useParseJobs } from "@/hooks/useParseJobs";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent } from "@/types/schema";

export function DashboardApp() {
  const searchParams = useSearchParams();
  const { loading, error } = useBootstrapData();
  useLiveFlowSocket();
  useParseJobs();
  useAnalysisData();
  useDesktopAppStatus();

  const [hoveredEvent, setHoveredEvent] = useState<FlowEvent>();
  const [registering, setRegistering] = useState(false);

  const metrics = useDashboardStore((state) => state.metrics);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);
  const target = useDashboardStore((state) => state.target);
  const targets = useDashboardStore((state) => state.targets);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setTargets = useDashboardStore((state) => state.setTargets);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const traces = useDashboardStore((state) => state.traces);
  const parseJobs = useDashboardStore((state) => state.parseJobs);
  const ingestDirectory = useDashboardStore((state) => state.ingestDirectory);
  const desktopStatus = useDashboardStore((state) => state.desktopStatus);

  const { topology, nodes, edges, events } = useFilteredTopology();
  const nodesById = useMemo(() => {
    return nodes.reduce<Record<string, (typeof nodes)[number]>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [nodes]);

  const replayTarget = useMemo(() => traces[0]?.envelope.trace_id, [traces]);
  const activeParseJob = useMemo(
    () => parseJobs.find((job) => job.status === "running" || job.status === "queued"),
    [parseJobs],
  );
  const recentParseJob = useMemo(
    () => parseJobs.find((job) => job.status === "completed" || job.status === "failed"),
    [parseJobs],
  );
  const displayParseJob = activeParseJob ?? recentParseJob;

  const searchTarget = searchParams.get("target");
  useEffect(() => {
    if (searchTarget && searchTarget !== target) {
      setTarget(searchTarget);
    }
  }, [searchTarget, setTarget, target]);

  const handleRegisterTarget = async () => {
    if (registering) return;

    const repoPath = window.prompt("输入本地仓库绝对路径 (absolute repo path)");
    if (!repoPath) return;
    const label = window.prompt("可选：目标显示名称 (label)") || undefined;
    const targetId = window.prompt("可选：target id (英文/数字/下划线)") || undefined;

    setRegistering(true);
    try {
      const response = await api.registerTarget({
        repo_path: repoPath.trim(),
        label,
        target_id: targetId,
      });

      const targetItems = await api.getTargets();
      setTargets(targetItems.items);
      setTarget(response.target.id);
      setViewMode("overview");
    } catch (registerError) {
      const message =
        registerError instanceof Error ? registerError.message : "register target failed";
      window.alert(message);
    } finally {
      setRegistering(false);
    }
  };

  if (loading && !topology) {
    return (
      <main className="flex h-screen items-center justify-center text-sm text-slate-300">
        Loading App workbench state...
      </main>
    );
  }

  if (error && !topology) {
    return (
      <main className="flex h-screen items-center justify-center text-sm text-rose-300">
        Failed to load local service: {error}
      </main>
    );
  }

  const isParserMode = viewMode === "parser_analysis";
  const isDiagnosticsMode = viewMode === "diagnostics";
  const isReportsMode = viewMode === "reports";
  const shellModeText = desktopStatus?.shellMode === "desktop" ? "desktop app" : "browser preview";

  return (
    <main data-testid="dashboard-root" className="h-screen w-screen overflow-hidden bg-transparent text-slate-100">
      <div className="mx-auto flex h-full max-w-[1900px] flex-col border-x border-line">
        <MetricsHeader metrics={metrics} mode={viewMode} diagnosticMode={diagnosticMode} />

        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#071120cc] px-4 py-2 text-xs text-slate-300">
          <div>
            <div className="panel-title text-sm uppercase tracking-wide">Agent_City Desktop Workbench</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded border border-line bg-[#10243a] px-1.5 py-0.5">shell: {shellModeText}</span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  desktopStatus?.backend.ready ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                }`}
              >
                backend: {desktopStatus?.backend.message ?? "unknown"}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  desktopStatus?.frontend.ready ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                }`}
              >
                frontend: {desktopStatus?.frontend.message ?? "unknown"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleRegisterTarget}
              disabled={registering}
              className="rounded border border-line bg-[#10233a] px-2 py-1 text-xs text-slate-100 hover:bg-[#18395f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registering ? "registering..." : "add local repository"}
            </button>
            <select
              className="rounded border border-line bg-[#0b1a2b] px-2 py-1 text-xs text-slate-100"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {targets.length === 0 && <option value={target}>{target}</option>}
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {replayTarget && (
              <Link
                href={`/replay?traceId=${encodeURIComponent(replayTarget)}&target=${encodeURIComponent(target)}`}
                className="rounded border border-line bg-[#11304d] px-2 py-1 text-slate-100 hover:bg-[#174266]"
              >
                open replay window
              </Link>
            )}
          </div>
        </header>

        <div data-testid="parse-progress-banner" className="border-b border-line bg-[#06111dcc] px-4 py-2 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              auto parse folder:
              <span className="ml-1 rounded bg-[#0f2238] px-1.5 py-0.5 font-mono text-[10px] text-sky-200">
                {ingestDirectory ?? "loading..."}
              </span>
            </div>
            <div className="text-slate-400">复制 agent 目录到此路径后会自动解析并切换目标</div>
          </div>

          {displayParseJob && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-200">
                  parsing: {displayParseJob.repo_name} ({displayParseJob.step})
                </span>
                <span className="font-mono text-sky-300">{displayParseJob.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-[#0b1a2c]">
                <div
                  className={`h-full transition-all duration-300 ${
                    displayParseJob.status === "failed"
                      ? "bg-gradient-to-r from-rose-500 to-rose-300"
                      : displayParseJob.status === "completed"
                        ? "bg-gradient-to-r from-emerald-500 to-green-300"
                        : "bg-gradient-to-r from-sky-500 to-cyan-400"
                  }`}
                  style={{ width: `${Math.max(6, displayParseJob.progress)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-400">{displayParseJob.message ?? "running..."}</div>
            </div>
          )}

          {!activeParseJob && recentParseJob?.status === "completed" && (
            <div className="mt-1 text-[10px] text-emerald-300">
              latest parse finished: {recentParseJob.repo_name} {"->"} {recentParseJob.target_id}
            </div>
          )}

          {!activeParseJob && recentParseJob?.status === "failed" && (
            <div className="mt-1 text-[10px] text-rose-300">
              parse failed: {recentParseJob.repo_name} ({recentParseJob.error ?? recentParseJob.message})
            </div>
          )}
        </div>

        <div data-testid="dashboard-layout" className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[290px_1fr_340px]">
          <FilterPanel />

          <section data-testid="city-panel" className="relative min-h-[42vh] border-r border-line lg:min-h-0">
            {isParserMode ? (
              <ParserAnalysisCenter />
            ) : isReportsMode ? (
              <ReportsCenter />
            ) : (
              <>
                <CityScene
                  topology={topology}
                  nodes={nodes}
                  edges={edges}
                  events={events}
                  diagnosticMode={isDiagnosticsMode ? diagnosticMode : "realtime"}
                  selectedNodeId={selectedNodeId}
                  selectedSpanId={selectedSpanId}
                  onSelectNode={(nodeId) => setSelectedNode(nodeId)}
                  onSelectEvent={(event) => setSelectedSpan(event.span_id, event.trace_id)}
                  onHoverEvent={(event) => setHoveredEvent(event)}
                />
                {hoveredEvent && (
                  <div className="pointer-events-none absolute left-3 top-3 z-10 w-[320px]">
                    <FlowEventHoverCard event={hoveredEvent} nodesById={nodesById} />
                  </div>
                )}
              </>
            )}
          </section>

          {isDiagnosticsMode || isParserMode ? (
            <DiagnosticsCenter />
          ) : (
            <DetailDrawer hoveredEvent={hoveredEvent} />
          )}
        </div>

        <div data-testid="timeline-container" className="h-[220px] lg:h-[210px]">
          <TimelinePanel />
        </div>
      </div>
    </main>
  );
}
