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

  const items = useMemo(() => events.slice(0, maxItems), [events, maxItems]);

  return (
    <section className="h-full overflow-y-auto border-t border-line bg-[#070f1bcc] p-2 scrollbar-thin">
      <div className="panel-title px-1 text-xs uppercase tracking-wide text-slate-300">Live Timeline</div>
      <div className="mt-2 space-y-1">
        {items.map((event) => {
          const selected = selectedSpanId === event.span_id;
          return (
            <button
              key={event.span_id}
              type="button"
              className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs ${
                selected
                  ? "border-sky-400 bg-[#0f253d]"
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
