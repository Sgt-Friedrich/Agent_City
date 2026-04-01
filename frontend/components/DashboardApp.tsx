"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CityScene } from "@/components/city/CityScene";
import { FilterPanel } from "@/components/panels/FilterPanel";
import { DetailDrawer } from "@/components/panels/DetailDrawer";
import { FlowEventHoverCard } from "@/components/panels/FlowEventHoverCard";
import { MetricsHeader } from "@/components/panels/MetricsHeader";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { api } from "@/lib/api";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useFilteredTopology } from "@/hooks/useFilteredTopology";
import { useLiveFlowSocket } from "@/hooks/useLiveFlowSocket";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent } from "@/types/schema";

export function DashboardApp() {
  const searchParams = useSearchParams();
  const { loading, error } = useBootstrapData();
  useLiveFlowSocket();

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

  const { topology, nodes, edges, events } = useFilteredTopology();
  const nodesById = useMemo(() => {
    return nodes.reduce<Record<string, (typeof nodes)[number]>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [nodes]);

  const replayTarget = useMemo(() => traces[0]?.envelope.trace_id, [traces]);

  const searchTarget = searchParams.get("target");
  useEffect(() => {
    if (searchTarget && searchTarget !== target) {
      setTarget(searchTarget);
    }
  }, [searchTarget, setTarget, target]);

  useEffect(() => {
    setViewMode("live");
  }, [setViewMode]);

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
        Loading topology and runtime feeds...
      </main>
    );
  }

  if (error && !topology) {
    return (
      <main className="flex h-screen items-center justify-center text-sm text-rose-300">
        Failed to load: {error}
      </main>
    );
  }

  return (
    <main data-testid="dashboard-root" className="h-screen w-screen overflow-hidden bg-transparent text-slate-100">
      <div className="mx-auto flex h-full max-w-[1700px] flex-col border-x border-line">
        <MetricsHeader metrics={metrics} mode={viewMode} diagnosticMode={diagnosticMode} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#071120cc] px-4 py-2 text-xs text-slate-300">
          <div className="panel-title text-sm uppercase tracking-wide">Agent City Runtime Monitor</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-slate-400 md:inline">static topology + runtime trace overlay</span>
            <button
              type="button"
              onClick={handleRegisterTarget}
              disabled={registering}
              className="rounded border border-line bg-[#10233a] px-2 py-1 text-xs text-slate-100 hover:bg-[#18395f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registering ? "registering..." : "add repo"}
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
                href={`/replay/${replayTarget}?target=${encodeURIComponent(target)}`}
                className="rounded border border-line bg-[#11304d] px-2 py-1 text-slate-100 hover:bg-[#174266]"
              >
                open replay
              </Link>
            )}
          </div>
        </div>

        <div data-testid="dashboard-layout" className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[270px_1fr_320px]">
          <FilterPanel />

          <section data-testid="city-panel" className="relative min-h-[42vh] lg:min-h-0">
            <CityScene
              topology={topology}
              nodes={nodes}
              edges={edges}
              events={events}
              diagnosticMode={diagnosticMode}
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
          </section>

          <DetailDrawer hoveredEvent={hoveredEvent} />
        </div>

        <div data-testid="timeline-container" className="h-[220px] lg:h-[210px]">
          <TimelinePanel />
        </div>
      </div>
    </main>
  );
}
