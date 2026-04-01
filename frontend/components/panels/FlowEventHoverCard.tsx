"use client";

import { shortId } from "@/lib/utils";
import { FlowEvent, Node } from "@/types/schema";

interface FlowEventHoverCardProps {
  event: FlowEvent;
  nodesById: Record<string, Node>;
  className?: string;
}

export function FlowEventHoverCard({ event, nodesById, className }: FlowEventHoverCardProps) {
  const fromName = nodesById[event.from_node]?.name ?? event.from_node;
  const toName = event.to_node ? (nodesById[event.to_node]?.name ?? event.to_node) : "internal";

  return (
    <div className={`rounded border border-line bg-[#061325e0] p-3 text-xs text-slate-200 shadow-glow ${className ?? ""}`}>
      <div className="panel-title text-[11px] uppercase tracking-wide text-slate-300">Flow Hover</div>
      <div className="mt-2 text-[12px] text-slate-100">{fromName} -&gt; {toName}</div>
      <div className="mt-1 text-[11px] text-slate-400">direction: {event.direction}</div>
      <div className="text-[11px] text-slate-400">protocol: {event.protocol}</div>
      <div className="text-[11px] text-slate-400">span kind: {event.span_kind}</div>
      <div className="mt-1 rounded border border-line bg-[#0a1a2c] px-2 py-1 text-[11px] text-slate-300">
        {event.summary}
      </div>
      <div className="mt-1 rounded border border-line bg-[#0a1a2c] px-2 py-1 text-[11px] text-slate-400">
        {event.payload_preview}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>latency: {event.latency_ms} ms</span>
        <span>status: {event.status}</span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        trace: {shortId(event.trace_id)} | span: {shortId(event.span_id)}
      </div>
    </div>
  );
}
