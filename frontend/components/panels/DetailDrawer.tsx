"use client";

import { useMemo } from "react";

import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent } from "@/types/schema";

interface DetailDrawerProps {
  hoveredEvent?: FlowEvent;
}

export function DetailDrawer({ hoveredEvent }: DetailDrawerProps) {
  const topology = useDashboardStore((state) => state.topology);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const liveEvents = useDashboardStore((state) => state.liveEvents);

  const selectedNode = useMemo(
    () => topology?.nodes.find((node) => node.id === selectedNodeId),
    [selectedNodeId, topology],
  );

  const selectedEvent = useMemo(
    () => hoveredEvent ?? liveEvents.find((event) => event.span_id === selectedSpanId),
    [hoveredEvent, liveEvents, selectedSpanId],
  );

  return (
    <aside className="h-full overflow-y-auto border-l border-line bg-[#081320cc] p-3 scrollbar-thin">
      <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">Inspector</h2>

      {selectedNode ? (
        <section className="mt-3 space-y-1 text-xs text-slate-300">
          <div className="badge">Node</div>
          <div className="panel-title text-base text-slate-100">{selectedNode.name}</div>
          <div>id: {selectedNode.id}</div>
          <div>type: {selectedNode.type}</div>
          <div>district: {selectedNode.district_id}</div>
          <div>status: {selectedNode.status}</div>
          <div>qps: {selectedNode.metrics?.qps ?? "-"}</div>
          <div>p95: {selectedNode.metrics?.p95_ms ?? "-"} ms</div>
          <div>error: {selectedNode.metrics?.error_rate ?? "-"}</div>
          <div className="mt-2 text-[11px] text-slate-400">provenance</div>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {selectedNode.source_provenance.map((item) => (
              <li key={`${item.source_type}-${item.location}`}>{item.source_type}: {item.location}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-3 text-xs text-slate-500">Click a building to inspect module details.</section>
      )}

      {selectedEvent && (
        <section className="mt-5 space-y-1 border-t border-line pt-3 text-xs text-slate-300">
          <div className="badge">Flow Event</div>
          <div className="panel-title text-sm text-slate-100">{selectedEvent.summary}</div>
          <div>from -&gt; to: {selectedEvent.from_node} -&gt; {selectedEvent.to_node}</div>
          <div>direction: {selectedEvent.direction}</div>
          <div>protocol: {selectedEvent.protocol}</div>
          <div>span_kind: {selectedEvent.span_kind}</div>
          <div>latency: {selectedEvent.latency_ms} ms</div>
          <div>status: {selectedEvent.status}</div>
          <div>trace_id: {shortId(selectedEvent.trace_id)}</div>
          <div>span_id: {shortId(selectedEvent.span_id)}</div>
          <div className="mt-1 rounded border border-line bg-[#0b1828] p-2 text-[11px] text-slate-400">
            {selectedEvent.payload_preview}
          </div>
        </section>
      )}
    </aside>
  );
}
