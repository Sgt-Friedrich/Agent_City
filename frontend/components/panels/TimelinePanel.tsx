"use client";

import { useMemo } from "react";

import { spanKindColor } from "@/lib/colorMaps";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";

interface TimelinePanelProps {
  maxItems?: number;
}

export function TimelinePanel({ maxItems = 60 }: TimelinePanelProps) {
  const events = useDashboardStore((state) => state.liveEvents);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);

  const items = useMemo(() => events.slice(0, maxItems), [events, maxItems]);

  return (
    <section data-testid="timeline-panel" className="h-full overflow-y-auto border-t border-line bg-[#070f1bcc] p-2 scrollbar-thin">
      <div className="flex items-center justify-between px-1">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">Live Timeline</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          {items.length} events | mode: {diagnosticMode}
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {items.map((event) => {
          const selected = selectedSpanId === event.span_id;
          const errorLike = event.status === "error" || event.retry_count > 0 || Boolean(event.fallback_from);
          return (
            <button
              key={event.span_id}
              type="button"
              className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs ${
                selected
                  ? "border-sky-400 bg-[#0f253d]"
                  : errorLike
                    ? "border-rose-500/60 bg-[#2a1318] hover:border-rose-400"
                    : "border-line bg-[#0a1626] hover:border-slate-500"
              }`}
              onClick={() => setSelectedSpan(event.span_id, event.trace_id)}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: spanKindColor(event.span_kind, event.status) }}
                />
                <span>{event.from_node.split(".").at(-1)} -&gt; {event.to_node?.split(".").at(-1)}</span>
                {event.retry_count > 0 && <span className="text-[10px] uppercase text-rose-300">retry</span>}
                {event.fallback_from && <span className="text-[10px] uppercase text-amber-300">fallback</span>}
              </span>
              <span className="text-[10px] text-slate-400">
                {shortId(event.trace_id)} / {event.latency_ms}ms
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
