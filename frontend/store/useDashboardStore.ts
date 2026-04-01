"use client";

import { create } from "zustand";

import {
  BoundTraceResponse,
  DiagnosticsSummary,
  Edge,
  Filters,
  FlowEvent,
  MetricsSummary,
  NodeType,
  ParseJob,
  ParserAnalysisReport,
  SpanKind,
  TargetOption,
  TopologyGraph,
  TraceRecord,
} from "@/types/schema";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";

interface ReplayState {
  active: boolean;
  traceId?: string;
  cursor: number;
  playing: boolean;
  speed: number;
}

interface DashboardState {
  viewMode: DashboardMode;
  diagnosticMode: DiagnosticMode;
  target: string;
  targets: TargetOption[];
  parseJobs: ParseJob[];
  ingestDirectory?: string;
  searchQuery: string;
  topology?: TopologyGraph;
  traces: TraceRecord[];
  traceDetails: Record<string, BoundTraceResponse>;
  metrics?: MetricsSummary;
  diagnosticsSummary?: DiagnosticsSummary;
  parserAnalysis?: ParserAnalysisReport;
  liveEvents: FlowEvent[];
  selectedNodeId?: string;
  selectedSpanId?: string;
  selectedTraceId?: string;
  filters: Filters;
  replay: ReplayState;
  setViewMode: (mode: DashboardMode) => void;
  setDiagnosticMode: (mode: DiagnosticMode) => void;
  setTarget: (target: string) => void;
  setTargets: (targets: TargetOption[]) => void;
  setParseJobs: (jobs: ParseJob[]) => void;
  setIngestDirectory: (path?: string) => void;
  setSearchQuery: (query: string) => void;
  setTopology: (topology: TopologyGraph) => void;
  mergeObservedEdges: (edges: Edge[]) => void;
  setTraces: (traces: TraceRecord[]) => void;
  upsertTrace: (trace: TraceRecord) => void;
  setTraceDetail: (traceId: string, detail: BoundTraceResponse) => void;
  setMetrics: (metrics: MetricsSummary) => void;
  setDiagnosticsSummary: (summary: DiagnosticsSummary | undefined) => void;
  setParserAnalysis: (report: ParserAnalysisReport | undefined) => void;
  pushLiveEvent: (event: FlowEvent) => void;
  setSelectedNode: (nodeId?: string) => void;
  setSelectedSpan: (spanId?: string, traceId?: string) => void;
  setSelectedTrace: (traceId?: string) => void;
  setDistrictFilter: (districtIds: string[]) => void;
  setNodeTypeFilter: (nodeTypes: NodeType[]) => void;
  setSpanKindFilter: (spanKinds: SpanKind[]) => void;
  setStatusFilter: (statuses: string[]) => void;
  setTraceFilter: (traceId?: string) => void;
  resetFilters: () => void;
  startReplay: (traceId: string) => void;
  stopReplay: () => void;
  setReplayCursor: (cursor: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplaySpeed: (speed: number) => void;
}

const defaultFilters: Filters = {
  districtIds: [],
  nodeTypes: [],
  statuses: [],
  spanKinds: [],
  traceId: undefined,
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  viewMode: "overview",
  diagnosticMode: "realtime",
  target: "mock",
  targets: [],
  parseJobs: [],
  ingestDirectory: undefined,
  searchQuery: "",
  traces: [],
  traceDetails: {},
  diagnosticsSummary: undefined,
  parserAnalysis: undefined,
  liveEvents: [],
  filters: defaultFilters,
  replay: {
    active: false,
    traceId: undefined,
    cursor: 0,
    playing: false,
    speed: 1,
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setDiagnosticMode: (mode) =>
    set({
      diagnosticMode: mode,
      viewMode:
        mode === "realtime"
          ? get().viewMode === "parser_analysis"
            ? "parser_analysis"
            : get().viewMode === "diagnostics"
              ? "overview"
              : get().viewMode
          : "diagnostics",
    }),

  setTarget: (target) =>
    set({
      target,
      topology: undefined,
      traces: [],
      traceDetails: {},
      diagnosticsSummary: undefined,
      parserAnalysis: undefined,
      liveEvents: [],
      searchQuery: "",
      selectedNodeId: undefined,
      selectedSpanId: undefined,
      selectedTraceId: undefined,
      filters: defaultFilters,
      viewMode:
        get().viewMode === "parser_analysis"
            ? "parser_analysis"
          : get().replay.active
            ? "replay"
            : get().diagnosticMode === "realtime"
              ? "overview"
              : "diagnostics",
    }),

  setTargets: (targets) => set({ targets }),

  setParseJobs: (parseJobs) => set({ parseJobs }),

  setIngestDirectory: (ingestDirectory) => set({ ingestDirectory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setTopology: (topology) => set({ topology }),

  mergeObservedEdges: (edges) => {
    const { topology } = get();
    if (!topology || !edges.length) return;

    const existing = new Map(topology.edges.map((edge) => [edge.id, edge]));
    edges.forEach((edge) => existing.set(edge.id, edge));
    set({
      topology: {
        ...topology,
        edges: Array.from(existing.values()),
      },
    });
  },

  setTraces: (traces) => set({ traces }),

  upsertTrace: (trace) => {
    const traces = [...get().traces];
    const idx = traces.findIndex((item) => item.envelope.trace_id === trace.envelope.trace_id);
    if (idx === -1) {
      traces.unshift(trace);
    } else {
      traces[idx] = trace;
    }
    set({ traces: traces.slice(0, 120) });
  },

  setTraceDetail: (traceId, detail) => {
    set({
      traceDetails: {
        ...get().traceDetails,
        [traceId]: detail,
      },
    });
  },

  setMetrics: (metrics) => set({ metrics }),
  setDiagnosticsSummary: (diagnosticsSummary) => set({ diagnosticsSummary }),
  setParserAnalysis: (parserAnalysis) => set({ parserAnalysis }),

  pushLiveEvent: (event) => {
    const next = [event, ...get().liveEvents].slice(0, 500);
    set({ liveEvents: next, selectedSpanId: event.span_id, selectedTraceId: event.trace_id });
  },

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setSelectedSpan: (spanId, traceId) => set({ selectedSpanId: spanId, selectedTraceId: traceId }),
  setSelectedTrace: (traceId) => set({ selectedTraceId: traceId }),

  setDistrictFilter: (districtIds) => set({ filters: { ...get().filters, districtIds } }),
  setNodeTypeFilter: (nodeTypes) => set({ filters: { ...get().filters, nodeTypes } }),
  setSpanKindFilter: (spanKinds) => set({ filters: { ...get().filters, spanKinds } }),
  setStatusFilter: (statuses) => set({ filters: { ...get().filters, statuses } }),
  setTraceFilter: (traceId) => set({ filters: { ...get().filters, traceId } }),

  resetFilters: () => set({ filters: defaultFilters }),

  startReplay: (traceId) =>
    set({
      viewMode: "replay",
      replay: {
        active: true,
        traceId,
        cursor: 0,
        playing: true,
        speed: 1,
      },
    }),

  stopReplay: () =>
    set({
      viewMode: get().diagnosticMode === "realtime" ? "overview" : "diagnostics",
      replay: {
        active: false,
        traceId: undefined,
        cursor: 0,
        playing: false,
        speed: 1,
      },
    }),

  setReplayCursor: (cursor) =>
    set({
      replay: {
        ...get().replay,
        cursor,
      },
    }),

  setReplayPlaying: (playing) =>
    set({
      replay: {
        ...get().replay,
        playing,
      },
    }),

  setReplaySpeed: (speed) =>
    set({
      replay: {
        ...get().replay,
        speed: Math.max(0.5, Math.min(8, speed)),
      },
    }),
}));
