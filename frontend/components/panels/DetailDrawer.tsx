"use client";

import { useMemo, useState } from "react";

import { NextStepPanel } from "@/components/analysis/NextStepPanel";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, Node } from "@/types/schema";

interface DetailDrawerProps {
  hoveredEvent?: FlowEvent;
}

function recentLabel(timestamp?: string): string {
  if (!timestamp) return "n/a";
  const delta = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(delta) || delta < 0) return "just now";
  if (delta < 2_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

function mockTrend(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const values: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    values.push(16 + (hash % 72));
  }
  return values;
}

export function DetailDrawer({ hoveredEvent }: DetailDrawerProps) {
  const [showNodeDeep, setShowNodeDeep] = useState(false);
  const [showFlowDeep, setShowFlowDeep] = useState(false);
  const [payloadRaw, setPayloadRaw] = useState(false);

  const topology = useDashboardStore((state) => state.topology);
  const target = useDashboardStore((state) => state.target);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const liveEvents = useDashboardStore((state) => state.liveEvents);
  const traces = useDashboardStore((state) => state.traces);
  const setTraceFilter = useDashboardStore((state) => state.setTraceFilter);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const nodeById = useMemo(() => {
    const map: Record<string, Node> = {};
    for (const node of topology?.nodes ?? []) {
      map[node.id] = node;
    }
    return map;
  }, [topology?.nodes]);

  const selectedNode = useMemo(
    () => topology?.nodes.find((node) => node.id === selectedNodeId),
    [selectedNodeId, topology],
  );

  const selectedEvent = useMemo(
    () => hoveredEvent ?? liveEvents.find((event) => event.span_id === selectedSpanId),
    [hoveredEvent, liveEvents, selectedSpanId],
  );

  const eventContext = useMemo(() => {
    if (!selectedEvent) return undefined;
    const trace = traces.find((item) => item.envelope.trace_id === selectedEvent.trace_id);
    const spanIndex = trace?.spans.findIndex((span) => span.span_id === selectedEvent.span_id) ?? -1;
    const total = trace?.spans.length ?? 0;
    const parent = selectedEvent.parent_span_id
      ? trace?.spans.find((span) => span.span_id === selectedEvent.parent_span_id)
      : undefined;
    const fromName = nodeById[selectedEvent.from_node]?.name ?? selectedEvent.from_node;
    const toName = selectedEvent.to_node
      ? (nodeById[selectedEvent.to_node]?.name ?? selectedEvent.to_node)
      : "internal";
    return {
      fromName,
      toName,
      parentSummary: parent?.summary,
      parentSpanId: parent?.span_id,
      positionLabel: total > 0 && spanIndex >= 0 ? `${spanIndex + 1} / ${total}` : "n/a",
      flags: [
        selectedEvent.retry_count > 0 ? `retry x${selectedEvent.retry_count}` : undefined,
        selectedEvent.fallback_from ? `fallback from ${shortId(selectedEvent.fallback_from)}` : undefined,
        selectedEvent.status === "error" ? "error event" : undefined,
      ].filter(Boolean) as string[],
    };
  }, [nodeById, selectedEvent, traces]);

  const focusPath = () => {
    if (!selectedEvent) return;
    setTraceFilter(selectedEvent.trace_id);
    setSelectedTrace(selectedEvent.trace_id);
    setSelectedSpan(selectedEvent.span_id, selectedEvent.trace_id);
    setViewMode("live");
  };

  const openReplayAtSpan = () => {
    if (!selectedEvent) return;
    const params = new URLSearchParams({
      traceId: selectedEvent.trace_id,
      target,
      spanId: selectedEvent.span_id,
    });
    window.location.href = `/replay?${params.toString()}`;
  };

  const nodeContext = useMemo(() => {
    if (!selectedNode || !topology) return undefined;

    const relatedEvents = liveEvents.filter(
      (event) => event.from_node === selectedNode.id || event.to_node === selectedNode.id,
    );
    const latestTimestamp = relatedEvents[0]?.timestamp;

    const inboundCounter = new Map<string, number>();
    const outboundCounter = new Map<string, number>();

    for (const event of relatedEvents) {
      if (event.to_node === selectedNode.id) {
        inboundCounter.set(event.from_node, (inboundCounter.get(event.from_node) ?? 0) + 1);
      }
      if (event.from_node === selectedNode.id && event.to_node) {
        outboundCounter.set(event.to_node, (outboundCounter.get(event.to_node) ?? 0) + 1);
      }
    }

    const inboundTop = Array.from(inboundCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => `${nodeById[id]?.name ?? id} (${count})`);
    const outboundTop = Array.from(outboundCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => `${nodeById[id]?.name ?? id} (${count})`);

    const upstream = topology.edges
      .filter((edge) => edge.to === selectedNode.id)
      .slice(0, 6)
      .map((edge) => `${nodeById[edge.from]?.name ?? edge.from} [${edge.kind}]`);
    const downstream = topology.edges
      .filter((edge) => edge.from === selectedNode.id)
      .slice(0, 6)
      .map((edge) => `${nodeById[edge.to]?.name ?? edge.to} [${edge.kind}]`);

    const traceIds = Array.from(new Set(relatedEvents.map((event) => event.trace_id))).slice(0, 6);
    const traceSummaries = traceIds.map((traceId) => {
      const trace = traces.find((item) => item.envelope.trace_id === traceId);
      return trace
        ? `${shortId(traceId)} ${trace.envelope.status} ${trace.envelope.duration_ms}ms`
        : shortId(traceId);
    });

    const district = topology.districts.find((item) => item.id === selectedNode.district_id);

    return {
      districtName: district?.name ?? selectedNode.district_id,
      districtSummary: district?.summary,
      relatedEvents: relatedEvents.slice(0, 8),
      latestTimestamp,
      inboundTop,
      outboundTop,
      upstream,
      downstream,
      traceSummaries,
      trend: mockTrend(selectedNode.id),
    };
  }, [liveEvents, nodeById, selectedNode, topology, traces]);

  return (
    <aside data-testid="detail-drawer" className="h-full max-h-[34vh] overflow-y-auto border-l border-line bg-[#081320cc] p-3 scrollbar-thin lg:max-h-none">
      <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">Inspector</h2>

      {selectedNode ? (
        <section className="mt-3 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <div className="badge">Node</div>
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-slate-200"
              onClick={() => setShowNodeDeep((prev) => !prev)}
            >
              {showNodeDeep ? "summary" : "detail"}
            </button>
          </div>

          <div className="panel-title text-base text-slate-100">{selectedNode.name}</div>
          <div className="text-[11px] text-slate-400">{selectedNode.type} | {nodeContext?.districtName}</div>
          <div className="text-[11px] text-slate-400">{nodeContext?.districtSummary}</div>
          <div>status: {selectedNode.status}</div>
          <div>qps / p95 / error: {(selectedNode.metrics?.qps ?? 0).toFixed(2)} / {(selectedNode.metrics?.p95_ms ?? 0).toFixed(0)}ms / {((selectedNode.metrics?.error_rate ?? 0) * 100).toFixed(2)}%</div>
          <div>active / queue: {selectedNode.metrics?.active_count ?? 0} / {selectedNode.metrics?.queue_depth ?? 0}</div>
          <div>last active: {recentLabel(nodeContext?.latestTimestamp)}</div>
          <div className="text-[11px] text-slate-400">in top3: {nodeContext?.inboundTop.join(", ") || "n/a"}</div>
          <div className="text-[11px] text-slate-400">out top3: {nodeContext?.outboundTop.join(", ") || "n/a"}</div>

          <div className="rounded border border-line bg-[#0b1828] p-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">mock trend</div>
            <div className="mt-1 flex items-end gap-1">
              {(nodeContext?.trend ?? []).map((value, index) => (
                <span
                  key={index}
                  className="inline-block w-[5px] rounded-sm bg-cyan-400/70"
                  style={{ height: `${Math.max(6, value)}px` }}
                />
              ))}
            </div>
          </div>

          {showNodeDeep && (
            <div className="space-y-2 rounded border border-line bg-[#0a1626] p-2 text-[11px] text-slate-400">
              <div>id: {selectedNode.id}</div>
              <div>metadata: {JSON.stringify(selectedNode.metadata)}</div>
              <div>upstream: {nodeContext?.upstream.join(" ; ") || "n/a"}</div>
              <div>downstream: {nodeContext?.downstream.join(" ; ") || "n/a"}</div>
              <div>trace list: {nodeContext?.traceSummaries.join(" | ") || "n/a"}</div>
              <div>recent events: {nodeContext?.relatedEvents.map((event) => shortId(event.span_id)).join(", ") || "n/a"}</div>
              <div className="mt-1">
                provenance:
                {selectedNode.source_provenance.map((item) => (
                  <div key={`${item.source_type}-${item.location}`}>{item.source_type}: {item.location}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-3 text-xs text-slate-500">Click a building to inspect module details.</section>
      )}

      {selectedEvent && (
        <section className="mt-5 space-y-2 border-t border-line pt-3 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <div className="badge">Flow Event</div>
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-slate-200"
              onClick={() => setShowFlowDeep((prev) => !prev)}
            >
              {showFlowDeep ? "summary" : "detail"}
            </button>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">Summary</div>
            <div className="mt-1 text-[12px] text-slate-100">{selectedEvent.summary}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {eventContext?.fromName} -&gt; {eventContext?.toName}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
              <div>direction: {selectedEvent.direction}</div>
              <div>protocol: {selectedEvent.protocol}</div>
              <div>kind: {selectedEvent.span_kind}</div>
              <div>status: {selectedEvent.status}</div>
              <div>latency: {selectedEvent.latency_ms} ms</div>
              <div>step: {eventContext?.positionLabel}</div>
            </div>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">Context</div>
            <div className="mt-1 text-[11px] text-slate-400">
              parent: {eventContext?.parentSummary ?? "root span"}
            </div>
            <div className="text-[10px] text-slate-500">
              parent_id: {eventContext?.parentSpanId ? shortId(eventContext.parentSpanId) : "n/a"}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              trace_id: {shortId(selectedEvent.trace_id)} | span_id: {shortId(selectedEvent.span_id)}
            </div>
            {eventContext?.flags.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {eventContext.flags.map((flag) => (
                  <span key={flag} className="rounded border border-amber-500/40 bg-[#2b2113] px-1.5 py-0.5 text-[10px] text-amber-200">
                    {flag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
                onClick={focusPath}
              >
                focus path
              </button>
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
                onClick={openReplayAtSpan}
              >
                open replay at span
              </button>
            </div>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="flex items-center justify-between">
              <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">Payload</div>
              <button
                type="button"
                className="text-[10px] text-slate-400 hover:text-slate-200"
                onClick={() => setPayloadRaw((prev) => !prev)}
              >
                {payloadRaw ? "pretty json" : "raw json"}
              </button>
            </div>
            <div className="mt-1 rounded border border-line bg-[#0b1828] p-2 text-[11px] text-slate-400">
              {selectedEvent.payload_preview}
            </div>
            {showFlowDeep && (
              <pre className="mt-2 max-h-36 overflow-auto rounded border border-line bg-[#060f1b] p-2 text-[10px] text-slate-400">
                {payloadRaw
                  ? JSON.stringify(
                      {
                        payload_detail: selectedEvent.payload_detail,
                        attributes: selectedEvent.attributes,
                        retry_count: selectedEvent.retry_count,
                        fallback_from: selectedEvent.fallback_from ?? null,
                      },
                      null,
                      0,
                    )
                  : JSON.stringify(
                      {
                        payload_detail: selectedEvent.payload_detail,
                        attributes: selectedEvent.attributes,
                        retry_count: selectedEvent.retry_count,
                        fallback_from: selectedEvent.fallback_from ?? null,
                      },
                      null,
                      2,
                    )}
              </pre>
            )}
          </div>
        </section>
      )}

      {!selectedNode && !selectedEvent && <NextStepPanel />}
    </aside>
  );
}
