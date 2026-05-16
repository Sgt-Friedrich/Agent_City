"use client";

import { useMemo, useState } from "react";

import { NextStepPanel } from "@/components/analysis/NextStepPanel";
import { useI18n } from "@/hooks/useI18n";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, Node } from "@/types/schema";
import { NodeExplainabilityProfile } from "@/types/schema";

interface DetailDrawerProps {
  hoveredEvent?: FlowEvent;
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
  const { t, formatRelativeTime } = useI18n();
  const [showNodeDetail, setShowNodeDetail] = useState(false);
  const [showFlowDetail, setShowFlowDetail] = useState(false);
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
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);

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
        selectedEvent.fallback_from ? `fallback ${shortId(selectedEvent.fallback_from)}` : undefined,
        selectedEvent.status === "error" ? "error" : undefined,
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
    const explainabilityRaw = selectedNode.metadata?.explainability;
    const explainability =
      explainabilityRaw && typeof explainabilityRaw === "object"
        ? (explainabilityRaw as NodeExplainabilityProfile)
        : undefined;

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
      explainability,
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
    <aside
      data-testid="detail-drawer"
      className="h-full max-h-[34vh] overflow-y-auto border-l border-line bg-[#081320cc] p-3 scrollbar-thin lg:max-h-none"
    >
      <h2 className="panel-title text-sm uppercase tracking-wide text-slate-200">{t("dashboard.inspectorTitle")}</h2>

      {selectedNode ? (
        <section className="mt-3 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <div className="badge">{t("drawer.nodeBadge")}</div>
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-slate-200"
              onClick={() => setShowNodeDetail((prev) => !prev)}
            >
              {showNodeDetail ? t("drawer.summaryView") : t("drawer.detailView")}
            </button>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.summary")}</div>
            <div className="mt-1 text-[12px] text-slate-100">
              {nodeContext?.explainability?.display_name ?? selectedNode.name}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{selectedNode.type} | {nodeContext?.districtName}</div>
            <div className="text-[11px] text-slate-400">{nodeContext?.districtSummary}</div>
            {nodeContext?.explainability?.responsibility ? (
              <div className="mt-1 rounded border border-line bg-[#0b1828] px-2 py-1 text-[11px] text-slate-300">
                {nodeContext.explainability.responsibility}
              </div>
            ) : null}
            <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
              <div>{t("drawer.status")}: {selectedNode.status}</div>
              <div>{t("drawer.lastActive")}: {formatRelativeTime(nodeContext?.latestTimestamp)}</div>
              <div>{t("drawer.qps")}: {(selectedNode.metrics?.qps ?? 0).toFixed(2)}</div>
              <div>{t("drawer.p95")}: {(selectedNode.metrics?.p95_ms ?? 0).toFixed(0)}ms</div>
              <div>{t("drawer.errorRate")}: {((selectedNode.metrics?.error_rate ?? 0) * 100).toFixed(2)}%</div>
              <div>{t("drawer.queue")}: {selectedNode.metrics?.queue_depth ?? 0}</div>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{t("drawer.inTop3")}: {nodeContext?.inboundTop.join(", ") || t("common.na")}</div>
            <div className="text-[11px] text-slate-400">{t("drawer.outTop3")}: {nodeContext?.outboundTop.join(", ") || t("common.na")}</div>
            {(nodeContext?.explainability?.inputs?.length || nodeContext?.explainability?.outputs?.length) ? (
              <div className="mt-1 text-[11px] text-slate-400">
                in: {nodeContext?.explainability?.inputs?.slice(0, 2).join(", ") || t("common.na")} | out: {nodeContext?.explainability?.outputs?.slice(0, 2).join(", ") || t("common.na")}
              </div>
            ) : null}
            {nodeContext?.explainability?.protocols?.length ? (
              <div className="text-[11px] text-cyan-200">
                {nodeContext.explainability.protocols.slice(0, 3).join(" | ")}
              </div>
            ) : null}
            {nodeContext?.explainability?.risk_hint ? (
              <div className="text-[11px] text-amber-200">{nodeContext.explainability.risk_hint}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-amber-400"
                onClick={() => {
                  setViewMode("diagnostics");
                  setDiagnosticFocus("errors");
                  setSearchQuery(`node:${selectedNode.id} status:error`);
                }}
              >
                {t("drawer.openNodeDiagnostics")}
              </button>
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
                onClick={() => {
                  setViewMode("parser_analysis");
                  setSearchQuery(`node:${selectedNode.id}`);
                }}
              >
                {t("drawer.openNodeParser")}
              </button>
            </div>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("drawer.nodeTrend")}</div>
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

          {showNodeDetail && (
            <div className="space-y-2 rounded border border-line bg-[#0a1626] p-2 text-[11px] text-slate-400">
              <div>{t("drawer.nodeId")}: {selectedNode.id}</div>
              <div>{t("drawer.metadata")}: {JSON.stringify(selectedNode.metadata)}</div>
              {nodeContext?.explainability ? (
                <div>
                  explainability:
                  {" "}
                  {JSON.stringify(nodeContext.explainability)}
                </div>
              ) : null}
              <div>{t("drawer.upstream")}: {nodeContext?.upstream.join(" ; ") || t("common.na")}</div>
              <div>{t("drawer.downstream")}: {nodeContext?.downstream.join(" ; ") || t("common.na")}</div>
              <div>{t("drawer.traceList")}: {nodeContext?.traceSummaries.join(" | ") || t("common.na")}</div>
              <div>{t("drawer.recentEvents")}: {nodeContext?.relatedEvents.map((event) => shortId(event.span_id)).join(", ") || t("common.na")}</div>
              <div className="mt-1">
                {t("drawer.provenance")}:
                {selectedNode.source_provenance.map((item) => (
                  <div key={`${item.source_type}-${item.location}`}>{item.source_type}: {item.location}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-3 text-xs text-slate-500">{t("drawer.selectNodeHint")}</section>
      )}

      {selectedEvent && (
        <section className="mt-5 space-y-2 border-t border-line pt-3 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <div className="badge">{t("drawer.flowBadge")}</div>
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-slate-200"
              onClick={() => setShowFlowDetail((prev) => !prev)}
            >
              {showFlowDetail ? t("drawer.summaryView") : t("drawer.detailView")}
            </button>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.summary")}</div>
            <div className="mt-1 text-[12px] text-slate-100">{selectedEvent.summary}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {eventContext?.fromName} -&gt; {eventContext?.toName}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
              <div>{t("drawer.direction")}: {selectedEvent.direction}</div>
              <div>{t("drawer.protocol")}: {selectedEvent.protocol}</div>
              <div>{t("drawer.kind")}: {selectedEvent.span_kind}</div>
              <div>{t("drawer.status")}: {selectedEvent.status}</div>
              <div>{t("drawer.latency")}: {selectedEvent.latency_ms} ms</div>
              <div>{t("drawer.step")}: {eventContext?.positionLabel}</div>
            </div>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("inspector.context")}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {t("drawer.parent")}: {eventContext?.parentSummary ?? t("drawer.rootSpan")}
            </div>
            <div className="text-[10px] text-slate-500">
              {t("drawer.parentId")}: {eventContext?.parentSpanId ? shortId(eventContext.parentSpanId) : t("common.na")}
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
                {t("drawer.focusPath")}
              </button>
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-400"
                onClick={openReplayAtSpan}
              >
                {t("drawer.openReplayAtSpan")}
              </button>
            </div>
          </div>

          <div className="rounded border border-line bg-[#0a1626] p-2">
            <div className="flex items-center justify-between">
              <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("drawer.payload")}</div>
              <button
                type="button"
                className="text-[10px] text-slate-400 hover:text-slate-200"
                onClick={() => setPayloadRaw((prev) => !prev)}
              >
                {payloadRaw ? t("drawer.payloadPretty") : t("drawer.payloadRaw")}
              </button>
            </div>
            <div className="mt-1 rounded border border-line bg-[#0b1828] p-2 text-[11px] text-slate-400">
              {selectedEvent.payload_preview}
            </div>
            {showFlowDetail && (
              <pre className="mt-2 max-h-36 overflow-auto rounded border border-line bg-[#060f1b] p-2 text-[10px] text-slate-400">
                {JSON.stringify(
                  {
                    payload_detail: selectedEvent.payload_detail,
                    attributes: selectedEvent.attributes,
                    retry_count: selectedEvent.retry_count,
                    fallback_from: selectedEvent.fallback_from ?? null,
                  },
                  null,
                  payloadRaw ? 0 : 2,
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
