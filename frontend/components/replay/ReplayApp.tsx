"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CityScene } from "@/components/city/CityScene";
import { FlowEventHoverCard } from "@/components/panels/FlowEventHoverCard";
import { ReplayController } from "@/components/replay/ReplayController";
import { ReplaySpanList } from "@/components/replay/ReplaySpanList";
import { api } from "@/lib/api";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, Node, TraceRecord } from "@/types/schema";

interface ReplayAppProps {
  traceId: string;
  target: string;
}

export function ReplayApp({ traceId, target }: ReplayAppProps) {
  const { loading } = useBootstrapData();
  const [hoveredEvent, setHoveredEvent] = useState<FlowEvent>();
  const [trace, setTrace] = useState<TraceRecord>();

  const topology = useDashboardStore((state) => state.topology);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const replay = useDashboardStore((state) => state.replay);
  const startReplay = useDashboardStore((state) => state.startReplay);
  const stopReplay = useDashboardStore((state) => state.stopReplay);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);

  useEffect(() => {
    setTarget(target);
  }, [setTarget, target]);

  useEffect(() => {
    setViewMode("replay");
    startReplay(traceId);
    return () => {
      stopReplay();
    };
  }, [setViewMode, startReplay, stopReplay, traceId]);

  useEffect(() => {
    let cancelled = false;
    async function loadTrace() {
      try {
        const detail = await api.getTraceDetail(traceId, target);
        if (cancelled) return;
        setTrace(detail.trace);
      } catch {
        if (!cancelled) {
          setTrace(undefined);
        }
      }
    }
    loadTrace();
    return () => {
      cancelled = true;
    };
  }, [target, traceId]);

  const events = trace?.spans ?? [];
  const nodesById = (topology?.nodes ?? []).reduce<Record<string, Node>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#03070d] text-slate-100">
      <div className="mx-auto flex h-full max-w-[1760px] flex-col border-x border-line">
        <div className="flex items-center justify-between border-b border-line bg-[#050d18f5] px-4 py-2 text-xs">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">Replay Mode</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">target: {target}</div>
          <Link href={`/?target=${encodeURIComponent(target)}`} className="rounded border border-line bg-[#10233a] px-2 py-1 text-slate-200 hover:bg-[#173659]">
            back to live
          </Link>
        </div>

        <ReplayController trace={trace} />

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
          <section className="relative min-h-0 border-r border-line">
            {!loading && (
              <CityScene
                topology={topology}
                nodes={topology?.nodes ?? []}
                edges={topology?.edges ?? []}
                events={events}
                diagnosticMode={diagnosticMode}
                replay={{
                  enabled: replay.active,
                  traceId: replay.traceId,
                  cursor: replay.cursor,
                }}
                onSelectNode={(nodeId) => setSelectedNode(nodeId)}
                onSelectEvent={(event) => setSelectedSpan(event.span_id, event.trace_id)}
                onHoverEvent={(event) => setHoveredEvent(event)}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-[#02071066]" />
            {hoveredEvent && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 w-[320px]">
                <FlowEventHoverCard event={hoveredEvent} nodesById={nodesById} />
              </div>
            )}
          </section>
          <ReplaySpanList trace={trace} />
        </div>
      </div>
    </main>
  );
}
