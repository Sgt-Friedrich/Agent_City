"use client";

import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { WS_LIVE_URL } from "@/lib/config";
import { useDashboardStore } from "@/store/useDashboardStore";
import { LiveMessage } from "@/types/schema";

export function useLiveFlowSocket(): void {
  const socketRef = useRef<WebSocket>();

  const target = useDashboardStore((state) => state.target);
  const pushLiveEvent = useDashboardStore((state) => state.pushLiveEvent);
  const upsertTrace = useDashboardStore((state) => state.upsertTrace);
  const mergeObservedEdges = useDashboardStore((state) => state.mergeObservedEdges);
  const setTraceDetail = useDashboardStore((state) => state.setTraceDetail);
  const setMetrics = useDashboardStore((state) => state.setMetrics);
  const setDiagnosticsSummary = useDashboardStore((state) => state.setDiagnosticsSummary);
  const setParserAnalysis = useDashboardStore((state) => state.setParserAnalysis);
  const setLiveStreamStatus = useDashboardStore((state) => state.setLiveStreamStatus);

  useEffect(() => {
    const socket = new WebSocket(`${WS_LIVE_URL}?target=${encodeURIComponent(target)}`);
    socketRef.current = socket;
    setLiveStreamStatus({ connected: false, lastMessageAt: new Date().toISOString() });

    socket.onopen = () => {
      setLiveStreamStatus({ connected: true, lastMessageAt: new Date().toISOString() });
    };

    socket.onclose = () => {
      setLiveStreamStatus({ connected: false, lastMessageAt: new Date().toISOString() });
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data) as LiveMessage;
      if (message.target && message.target !== target) {
        return;
      }

      setLiveStreamStatus({
        connected: true,
        liveMode: message.live_mode,
        flowGate: message.flow_gate,
        activeTraceId: message.active_trace_id ?? message.trace_id,
        lastMessageAt: new Date().toISOString(),
      });

      if (message.type === "trace_started" && message.trace) {
        upsertTrace({ envelope: message.trace, spans: [] });
        return;
      }

      if (message.type === "flow_event" && message.span && message.trace_id) {
        pushLiveEvent(message.span);
        const current = useDashboardStore.getState().traces;
        const existing = current.find((item) => item.envelope.trace_id === message.trace_id);

        if (existing) {
          upsertTrace({
            ...existing,
            spans: [...existing.spans, message.span],
          });
        }

        return;
      }

      if (message.type === "trace_completed" && message.trace) {
        if (message.inferred_edges?.length) {
          mergeObservedEdges(message.inferred_edges);
        }

        try {
          const detail = await api.getTraceDetail(message.trace.trace_id, target);
          setTraceDetail(message.trace.trace_id, detail);
          upsertTrace(detail.trace);
          const [summary, diagnostics, parserAnalysis] = await Promise.all([
            api.getMetricsSummary(target),
            api.getDiagnosticsSummary(target),
            api.getParserAnalysis(target),
          ]);
          setMetrics(summary);
          setDiagnosticsSummary(diagnostics);
          setParserAnalysis(parserAnalysis);
        } catch {
          // Keep websocket stream resilient even if a detail refresh fails.
        }
      }
    };

    return () => {
      socket.close();
    };
  }, [
    mergeObservedEdges,
    pushLiveEvent,
    setDiagnosticsSummary,
    setMetrics,
    setParserAnalysis,
    setLiveStreamStatus,
    setTraceDetail,
    target,
    upsertTrace,
  ]);
}
