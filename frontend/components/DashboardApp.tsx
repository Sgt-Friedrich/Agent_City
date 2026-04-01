"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CityScene } from "@/components/city/CityScene";
import { FilterPanel } from "@/components/panels/FilterPanel";
import { DetailDrawer } from "@/components/panels/DetailDrawer";
import { MetricsHeader } from "@/components/panels/MetricsHeader";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useFilteredTopology } from "@/hooks/useFilteredTopology";
import { useLiveFlowSocket } from "@/hooks/useLiveFlowSocket";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent } from "@/types/schema";

export function DashboardApp() {
  const { loading, error } = useBootstrapData();
  useLiveFlowSocket();

  const [hoveredEvent, setHoveredEvent] = useState<FlowEvent>();

  const metrics = useDashboardStore((state) => state.metrics);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const traces = useDashboardStore((state) => state.traces);

  const { topology, nodes, edges, events } = useFilteredTopology();

  const replayTarget = useMemo(() => traces[0]?.envelope.trace_id, [traces]);

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
    <main className="h-screen w-screen overflow-hidden bg-transparent text-slate-100">
      <div className="mx-auto flex h-full max-w-[1700px] flex-col border-x border-line">
        <MetricsHeader metrics={metrics} />

        <div className="flex items-center justify-between border-b border-line bg-[#071120cc] px-4 py-2 text-xs text-slate-300">
          <div className="panel-title text-sm uppercase tracking-wide">Agent City Runtime Monitor</div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">static topology + runtime trace overlay</span>
            {replayTarget && (
              <Link
                href={`/replay/${replayTarget}`}
                className="rounded border border-line bg-[#11304d] px-2 py-1 text-slate-100 hover:bg-[#174266]"
              >
                open replay
              </Link>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[270px_1fr_320px]">
          <FilterPanel />

          <section className="relative min-h-0">
            <CityScene
              topology={topology}
              nodes={nodes}
              edges={edges}
              events={events}
              selectedNodeId={selectedNodeId}
              selectedSpanId={selectedSpanId}
              onSelectNode={(nodeId) => setSelectedNode(nodeId)}
              onSelectEvent={(event) => setSelectedSpan(event.span_id, event.trace_id)}
              onHoverEvent={(event) => setHoveredEvent(event)}
            />
          </section>

          <DetailDrawer hoveredEvent={hoveredEvent} />
        </div>

        <div className="h-[210px]">
          <TimelinePanel />
        </div>
      </div>
    </main>
  );
}
