"use client";

import { spanKindColor } from "@/lib/colorMaps";
import { useDashboardStore } from "@/store/useDashboardStore";
import { TraceRecord } from "@/types/schema";

interface ReplaySpanListProps {
  trace?: TraceRecord;
}

export function ReplaySpanList({ trace }: ReplaySpanListProps) {
  const replay = useDashboardStore((state) => state.replay);
  const setReplayCursor = useDashboardStore((state) => state.setReplayCursor);

  if (!trace) {
    return null;
  }

  return (
    <aside className="h-full overflow-y-auto border-l border-line bg-[#081320cc] p-3 scrollbar-thin">
      <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">Replay Spans</h2>
      <div className="mt-3 space-y-1">
        {trace.spans.map((span, index) => {
          const active = replay.cursor - 1 === index;
          const done = replay.cursor - 1 > index;
          return (
            <button
              key={span.span_id}
              className={`w-full rounded border px-2 py-1 text-left text-xs ${
                active
                  ? "border-sky-400 bg-[#14304f]"
                  : done
                    ? "border-line bg-[#10233a]"
                    : "border-line bg-[#0a1626]"
              }`}
              onClick={() => setReplayCursor(index + 1)}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: spanKindColor(span.span_kind, span.status) }}
                  />
                  {span.span_kind}
                </span>
                <span className="text-[10px] text-slate-400">{span.latency_ms} ms</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {span.from_node} -&gt; {span.to_node}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
