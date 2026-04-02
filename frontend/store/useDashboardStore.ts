"use client";

import { create } from "zustand";

import {
  AppRuntimeStatus,
  AppSettings,
  BoundTraceResponse,
  DiagnosticsSummary,
  Edge,
  Filters,
  FlowEvent,
  MetricsSummary,
  NodeType,
  ParseJob,
  ParserAnalysisReport,
  RepositoryRecord,
  JobRecord,
  SpanKind,
  TargetOption,
  TimelineGroupBy,
  TopologyGraph,
  TraceRecord,
  DesktopAppStatus,
} from "@/types/schema";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";

interface ReplayState {
  active: boolean;
  traceId?: string;
  cursor: number;
  playing: boolean;
  speed: number;
}

export type DiagnosticFocus = "all" | "errors" | "slow" | "congestion" | "retry_fallback";

interface DashboardState {
  viewMode: DashboardMode;
  diagnosticMode: DiagnosticMode;
  diagnosticFocus: DiagnosticFocus;
  target: string;
  targets: TargetOption[];
  parseJobs: ParseJob[];
  repositories: RepositoryRecord[];
  jobs: JobRecord[];
  runtimeStatus?: AppRuntimeStatus;
  appSettings?: AppSettings;
  ingestDirectory?: string;
  searchQuery: string;
  topology?: TopologyGraph;
  traces: TraceRecord[];
  traceDetails: Record<string, BoundTraceResponse>;
  metrics?: MetricsSummary;
  diagnosticsSummary?: DiagnosticsSummary;
  parserAnalysis?: ParserAnalysisReport;
  desktopStatus?: DesktopAppStatus;
  liveEvents: FlowEvent[];
  timelineGroupBy: TimelineGroupBy;
  selectedNodeId?: string;
  selectedSpanId?: string;
  selectedTraceId?: string;
  filters: Filters;
  replay: ReplayState;
  setViewMode: (mode: DashboardMode) => void;
  setDiagnosticMode: (mode: DiagnosticMode) => void;
  setDiagnosticFocus: (focus: DiagnosticFocus) => void;
  setTarget: (target: string) => void;
  setTargets: (targets: TargetOption[]) => void;
  setParseJobs: (jobs: ParseJob[]) => void;
  setRepositories: (items: RepositoryRecord[]) => void;
  setControlJobs: (items: JobRecord[]) => void;
  upsertControlJob: (item: JobRecord) => void;
  setRuntimeStatus: (status: AppRuntimeStatus | undefined) => void;
  setAppSettings: (settings: AppSettings | undefined) => void;
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
  setDesktopStatus: (status: DesktopAppStatus | undefined) => void;
  pushLiveEvent: (event: FlowEvent) => void;
  setSelectedNode: (nodeId?: string) => void;
  setSelectedSpan: (spanId?: string, traceId?: string) => void;
  setSelectedTrace: (traceId?: string) => void;
  setTimelineGroupBy: (groupBy: TimelineGroupBy) => void;
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
  diagnosticFocus: "all",
  target: "mock",
  targets: [],
  parseJobs: [],
  repositories: [],
  jobs: [],
  runtimeStatus: undefined,
  appSettings: undefined,
  ingestDirectory: undefined,
  searchQuery: "",
  traces: [],
  traceDetails: {},
  diagnosticsSummary: undefined,
  parserAnalysis: undefined,
  desktopStatus: undefined,
  liveEvents: [],
  timelineGroupBy: "time",
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
  setDiagnosticFocus: (diagnosticFocus) => set({ diagnosticFocus }),

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
      diagnosticFocus: "all",
      selectedNodeId: undefined,
      selectedSpanId: undefined,
      selectedTraceId: undefined,
      filters: defaultFilters,
      viewMode:
        get().viewMode === "parser_analysis"
          ? "parser_analysis"
          : get().viewMode === "reports"
            ? "reports"
            : get().viewMode === "repositories"
              ? "repositories"
              : get().viewMode === "jobs"
                ? "jobs"
                : get().viewMode === "settings"
                  ? "settings"
                  : get().replay.active
                    ? "replay"
                    : get().diagnosticMode === "realtime"
                      ? "overview"
                      : "diagnostics",
    }),

  setTargets: (targets) => set({ targets }),

  setParseJobs: (parseJobs) => set({ parseJobs }),
  setRepositories: (repositories) => set({ repositories }),
  setControlJobs: (jobs) => set({ jobs }),
  upsertControlJob: (item) => {
    const jobs = [...get().jobs];
    const index = jobs.findIndex((job) => job.id === item.id);
    if (index >= 0) {
      jobs[index] = item;
    } else {
      jobs.unshift(item);
    }
    set({ jobs: jobs.slice(0, 200) });
  },
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
  setAppSettings: (appSettings) => set({ appSettings }),

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
  setDesktopStatus: (desktopStatus) => set({ desktopStatus }),

  pushLiveEvent: (event) => {
    const next = [event, ...get().liveEvents].slice(0, 100);
    set({ liveEvents: next, selectedSpanId: event.span_id, selectedTraceId: event.trace_id });
  },

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setSelectedSpan: (spanId, traceId) => set({ selectedSpanId: spanId, selectedTraceId: traceId }),
  setSelectedTrace: (traceId) => set({ selectedTraceId: traceId }),
  setTimelineGroupBy: (timelineGroupBy) => set({ timelineGroupBy }),

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
