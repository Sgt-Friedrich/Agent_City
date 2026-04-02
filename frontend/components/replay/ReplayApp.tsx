"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CityScene } from "@/components/city/CityScene";
import { FlowEventHoverCard } from "@/components/panels/FlowEventHoverCard";
import { ReplayController } from "@/components/replay/ReplayController";
import { ReplaySpanList } from "@/components/replay/ReplaySpanList";
import { api } from "@/lib/api";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useI18n } from "@/hooks/useI18n";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, Node, TraceRecord } from "@/types/schema";

interface ReplayAppProps {
  traceId: string;
  target: string;
  initialSpanId?: string;
}

export function ReplayApp({ traceId, target, initialSpanId }: ReplayAppProps) {
  const { t } = useI18n();
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
  const setReplayCursor = useDashboardStore((state) => state.setReplayCursor);
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

  useEffect(() => {
    if (!trace || !initialSpanId) return;
    const index = trace.spans.findIndex((span) => span.span_id === initialSpanId);
    if (index >= 0) {
      setReplayCursor(index + 1);
    }
  }, [initialSpanId, setReplayCursor, trace]);

  useEffect(() => {
    if (!trace || replay.cursor <= 0) return;
    const index = Math.min(trace.spans.length - 1, Math.max(0, replay.cursor - 1));
    const current = trace.spans[index];
    if (!current) return;
    setSelectedSpan(current.span_id, current.trace_id);
    setSelectedNode(current.to_node ?? current.from_node);
  }, [replay.cursor, setSelectedNode, setSelectedSpan, trace]);

  const events = trace?.spans ?? [];
  const currentSpan = trace && replay.cursor > 0
    ? trace.spans[Math.min(trace.spans.length - 1, Math.max(0, replay.cursor - 1))]
    : undefined;
  const nodesById = (topology?.nodes ?? []).reduce<Record<string, Node>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

  return (
    <main data-testid="replay-root" className="h-screen w-screen overflow-hidden bg-[#03070d] text-slate-100">
      <div className="mx-auto flex h-full max-w-[1760px] flex-col border-x border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#050d18f5] px-4 py-2 text-xs">
          <div className="panel-title text-sm uppercase tracking-wide text-slate-100">{t("replay.modeTitle")}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">target: {target}</div>
          <Link href={`/?target=${encodeURIComponent(target)}`} className="rounded border border-line bg-[#10233a] px-2 py-1 text-slate-200 hover:bg-[#173659]">
            {t("replay.backToLive")}
          </Link>
        </div>

        <ReplayController trace={trace} />

        <div data-testid="replay-layout" className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <section data-testid="replay-city-panel" className="relative min-h-[46vh] border-r border-line lg:min-h-0">
            {!loading && (
              <CityScene
                topology={topology}
                nodes={topology?.nodes ?? []}
                edges={topology?.edges ?? []}
                events={events}
                viewMode="replay"
                diagnosticMode={diagnosticMode}
                selectedTraceId={traceId}
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
            <div className="pointer-events-none absolute inset-0 bg-[#0207107a]" />
            {currentSpan ? (
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded border border-line bg-[#071325e6] px-3 py-2 shadow-glow">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {Math.min(replay.cursor, trace?.spans.length ?? 0)} / {trace?.spans.length ?? 0}
                </div>
                <div className="panel-title text-xs text-slate-100">{currentSpan.summary}</div>
                <div className="text-[10px] text-cyan-300">
                  {currentSpan.from_node} -&gt; {currentSpan.to_node ?? "internal"}
                </div>
              </div>
            ) : null}
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
