"use client";

import { useEffect, useMemo } from "react";

import { spanKindColor } from "@/lib/colorMaps";
import { useI18n } from "@/hooks/useI18n";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, TimelineGroupBy } from "@/types/schema";

interface TimelinePanelProps {
  maxItems?: number;
}

function EventRow({
  event,
  selected,
  onSelect,
  retryLabel,
  fallbackLabel,
}: {
  event: FlowEvent;
  selected: boolean;
  onSelect: (event: FlowEvent) => void;
  retryLabel: string;
  fallbackLabel: string;
}) {
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
      onClick={() => onSelect(event)}
    >
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: spanKindColor(event.span_kind, event.status) }}
        />
        <span>{event.from_node.split(".").at(-1)} -&gt; {event.to_node?.split(".").at(-1)}</span>
        {event.retry_count > 0 && <span className="text-[10px] uppercase text-rose-300">{retryLabel}</span>}
        {event.fallback_from && <span className="text-[10px] uppercase text-amber-300">{fallbackLabel}</span>}
      </span>
      <span className="text-[10px] text-slate-400">
        {shortId(event.trace_id)} / {event.latency_ms}ms
      </span>
    </button>
  );
}

function GroupButtons({
  groupBy,
  onChange,
  labels,
}: {
  groupBy: TimelineGroupBy;
  onChange: (groupBy: TimelineGroupBy) => void;
  labels: Record<TimelineGroupBy, string>;
}) {
  const options: TimelineGroupBy[] = ["time", "trace", "node"];
  return (
    <div className="flex items-center gap-1">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          data-testid={`timeline-group-${item}`}
          className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
            groupBy === item
              ? "border-cyan-400 bg-[#13314d] text-slate-100"
              : "border-line bg-[#0b1828] text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => onChange(item)}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}

export function TimelinePanel({ maxItems = 60 }: TimelinePanelProps) {
  const { t } = useI18n();
  const events = useDashboardStore((state) => state.liveEvents);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const groupBy = useDashboardStore((state) => state.timelineGroupBy);
  const setGroupBy = useDashboardStore((state) => state.setTimelineGroupBy);

  const items = useMemo(() => events.slice(0, maxItems), [events, maxItems]);
  const select = (event: FlowEvent) => setSelectedSpan(event.span_id, event.trace_id);

  const groupedByTrace = useMemo(() => {
    const map = new Map<string, FlowEvent[]>();
    for (const event of items) {
      const key = event.trace_id;
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return Array.from(map.entries()).slice(0, 10);
  }, [items]);

  const groupedByNode = useMemo(() => {
    const map = new Map<string, FlowEvent[]>();
    for (const event of items) {
      const key = event.from_node;
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);
  }, [items]);

  const groupLabels: Record<TimelineGroupBy, string> = {
    time: t("timeline.group.time"),
    trace: t("timeline.group.trace"),
    node: t("timeline.group.node"),
  };

  useEffect(() => {
    if (viewMode === "diagnostics" && groupBy === "time") {
      setGroupBy("trace");
    }
  }, [groupBy, setGroupBy, viewMode]);

  return (
    <section data-testid="timeline-panel" className="h-full overflow-y-auto border-t border-line bg-[#070f1bcc] p-2 scrollbar-thin">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="panel-title text-xs uppercase tracking-wide text-slate-300">{t("timeline.title")}</div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
          <span>{items.length} {t("timeline.events")} | {t("timeline.modeLabel")}: {diagnosticMode}</span>
          <GroupButtons groupBy={groupBy} onChange={setGroupBy} labels={groupLabels} />
        </div>
      </div>

      {groupBy === "time" && (
        <div data-testid="timeline-time-groups" className="mt-2 space-y-1">
          {items.map((event) => (
            <EventRow
              key={event.span_id}
              event={event}
              selected={selectedSpanId === event.span_id}
              onSelect={select}
              retryLabel={t("timeline.retry")}
              fallbackLabel={t("timeline.fallback")}
            />
          ))}
        </div>
      )}

      {groupBy === "trace" && (
        <div data-testid="timeline-trace-groups" className="mt-2 space-y-2">
          {groupedByTrace.map(([traceId, traceEvents]) => (
            <div key={traceId} className="rounded border border-line bg-[#0a1626] p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                <span className="uppercase tracking-wide">trace {shortId(traceId)}</span>
                <span>{traceEvents.length} {t("timeline.spans")}</span>
              </div>
              <div className="space-y-1">
                {traceEvents.slice(0, 6).map((event) => (
                  <EventRow
                    key={event.span_id}
                    event={event}
                    selected={selectedSpanId === event.span_id}
                    onSelect={select}
                    retryLabel={t("timeline.retry")}
                    fallbackLabel={t("timeline.fallback")}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {groupBy === "node" && (
        <div data-testid="timeline-node-groups" className="mt-2 space-y-2">
          {groupedByNode.map(([nodeId, nodeEvents]) => (
            <div key={nodeId} className="rounded border border-line bg-[#0a1626] p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                <span className="uppercase tracking-wide">{nodeId.split(".").at(-1)}</span>
                <span>{nodeEvents.length} {t("timeline.events")}</span>
              </div>
              <div className="space-y-1">
                {nodeEvents.slice(0, 5).map((event) => (
                  <EventRow
                    key={event.span_id}
                    event={event}
                    selected={selectedSpanId === event.span_id}
                    onSelect={select}
                    retryLabel={t("timeline.retry")}
                    fallbackLabel={t("timeline.fallback")}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
