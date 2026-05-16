"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ControlCenterBar } from "@/components/analysis/ControlCenterBar";
import { ControlInspector } from "@/components/analysis/ControlInspector";
import { DiagnosticsCenter } from "@/components/analysis/DiagnosticsCenter";
import { JobsCenter } from "@/components/analysis/JobsCenter";
import { ParserAnalysisCenter } from "@/components/analysis/ParserAnalysisCenter";
import { PromptTaskFlowPanel } from "@/components/analysis/PromptTaskFlowPanel";
import { RepositoriesCenter } from "@/components/analysis/RepositoriesCenter";
import { ReportsCenter } from "@/components/analysis/ReportsCenter";
import { SettingsCenter } from "@/components/analysis/SettingsCenter";
import { StartHerePanel } from "@/components/analysis/StartHerePanel";
import { CityScene } from "@/components/city/CityScene";
import { FilterPanel } from "@/components/panels/FilterPanel";
import { DetailDrawer } from "@/components/panels/DetailDrawer";
import { FlowEventHoverCard } from "@/components/panels/FlowEventHoverCard";
import { MetricsHeader } from "@/components/panels/MetricsHeader";
import { CommandPalette } from "@/components/panels/CommandPalette";
import { RepositoryImportWizard } from "@/components/panels/RepositoryImportWizard";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { useAnalysisData } from "@/hooks/useAnalysisData";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { useControlPlaneData } from "@/hooks/useControlPlaneData";
import { useDesktopAppStatus } from "@/hooks/useDesktopAppStatus";
import { useFilteredTopology } from "@/hooks/useFilteredTopology";
import { useI18n } from "@/hooks/useI18n";
import { useLiveFlowSocket } from "@/hooks/useLiveFlowSocket";
import { useParseJobs } from "@/hooks/useParseJobs";
import { MessageKey } from "@/i18n/messages";
import { api } from "@/lib/api";
import { DashboardMode } from "@/lib/visualTheme";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent } from "@/types/schema";

type TopRibbonTab = "workspace" | "analysis" | "control" | "parser";

function flowGateMessageKey(flowGate?: string): MessageKey | undefined {
  if (flowGate?.startsWith("probe_error")) return "flowGate.probeError";
  switch (flowGate) {
    case "always_simulated":
      return "flowGate.alwaysSimulated";
    case "manual_pause":
      return "flowGate.manualPause";
    case "codex_gate_target_mismatch":
      return "flowGate.codexTargetMismatch";
    case "waiting_codex_process":
      return "flowGate.waitingCodexProcess";
    case "waiting_codex_cpu_low":
    case "waiting_codex_baseline":
      return "flowGate.waitingCodexActivity";
    case "codex_active_cpu":
      return "flowGate.codexActive";
    case "probe_error":
      return "flowGate.probeError";
    default:
      return undefined;
  }
}

export function DashboardApp() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { loading, error } = useBootstrapData();
  useLiveFlowSocket();
  useParseJobs();
  useAnalysisData();
  useControlPlaneData();
  useDesktopAppStatus();

  const [hoveredEvent, setHoveredEvent] = useState<FlowEvent>();
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [ribbonTab, setRibbonTab] = useState<TopRibbonTab>("workspace");
  const [ribbonExpanded, setRibbonExpanded] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptFlowOpen, setPromptFlowOpen] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const ribbonHostRef = useRef<HTMLDivElement | null>(null);
  const previousModeRef = useRef<DashboardMode>("overview");

  const metrics = useDashboardStore((state) => state.metrics);
  const viewMode = useDashboardStore((state) => state.viewMode);
  const diagnosticMode = useDashboardStore((state) => state.diagnosticMode);
  const parserAnalysis = useDashboardStore((state) => state.parserAnalysis);
  const diagnosticsSummary = useDashboardStore((state) => state.diagnosticsSummary);
  const target = useDashboardStore((state) => state.target);
  const targets = useDashboardStore((state) => state.targets);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setTargets = useDashboardStore((state) => state.setTargets);
  const selectedNodeId = useDashboardStore((state) => state.selectedNodeId);
  const selectedSpanId = useDashboardStore((state) => state.selectedSpanId);
  const selectedTraceId = useDashboardStore((state) => state.selectedTraceId);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const traces = useDashboardStore((state) => state.traces);
  const repositories = useDashboardStore((state) => state.repositories);
  const desktopStatus = useDashboardStore((state) => state.desktopStatus);
  const appSettings = useDashboardStore((state) => state.appSettings);
  const liveStreamStatus = useDashboardStore((state) => state.liveStreamStatus);

  const { topology, nodes, edges, events } = useFilteredTopology();
  const nodesById = useMemo(() => {
    return nodes.reduce<Record<string, (typeof nodes)[number]>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [nodes]);

  const replayTarget = useMemo(() => traces[0]?.envelope.trace_id, [traces]);
  const importedRepositoryCount = useMemo(
    () => repositories.filter((repo) => repo.source_type !== "mock").length,
    [repositories],
  );

  const searchTarget = searchParams.get("target");
  useEffect(() => {
    if (searchTarget && searchTarget !== target) {
      setTarget(searchTarget);
    }
  }, [searchTarget, setTarget, target]);

  useEffect(() => {
    if (!ribbonExpanded && !viewMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const host = ribbonHostRef.current;
      if (!host) return;
      if (!host.contains(event.target as Node)) {
        setRibbonExpanded(false);
        setViewMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRibbonExpanded(false);
        setViewMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ribbonExpanded, viewMenuOpen]);

  useEffect(() => {
    setRibbonExpanded(false);
    setViewMenuOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "settings") {
      setSettingsOpen(true);
      setViewMode(previousModeRef.current ?? "overview");
      return;
    }
    previousModeRef.current = viewMode;
  }, [setViewMode, viewMode]);

  const handleImported = async (targetId: string) => {
    const targetItems = await api.getTargets();
    setTargets(targetItems.items);
    setTarget(targetId);
    setViewMode("overview");
  };

  if (loading && !topology) {
    return (
      <main className="flex h-screen items-center justify-center text-sm text-slate-300">
        {t("app.loading")}
      </main>
    );
  }

  if (error && !topology) {
    return (
      <main className="flex h-screen items-center justify-center text-sm text-rose-300">
        {t("app.loadFailed")}: {error}
      </main>
    );
  }

  const isParserMode = viewMode === "parser_analysis";
  const isDiagnosticsMode = viewMode === "diagnostics";
  const isRepositoriesMode = viewMode === "repositories";
  const isJobsMode = viewMode === "jobs";
  const isReportsMode = viewMode === "reports";
  const isArchitectureMode =
    !isParserMode && !isReportsMode && !isRepositoriesMode && !isJobsMode;
  const allowRibbonPanels = isArchitectureMode;
  const shouldShowStartHere = isArchitectureMode && !isDiagnosticsMode && importedRepositoryCount === 0;
  const shellModeText =
    desktopStatus?.shellMode === "desktop" ? t("header.desktopMode") : t("header.browserMode");
  const backendBadge = desktopStatus?.backend.ready ? t("common.ready") : desktopStatus?.backend.message ?? t("common.unknown");
  const frontendBadge = desktopStatus?.frontend.ready ? t("common.ready") : desktopStatus?.frontend.message ?? t("common.unknown");
  const liveFlowMode = appSettings?.live_flow_mode ?? "codex_real_only";
  const liveFlowModeLabel =
    liveFlowMode === "manual"
      ? t("settings.liveFlowMode.manual")
      : liveFlowMode === "codex_real_only"
        ? t("settings.liveFlowMode.codex_real_only")
        : t("settings.liveFlowMode.always_simulated");
  const flowGateKey = flowGateMessageKey(liveStreamStatus?.flowGate);
  const liveGateLabel = flowGateKey
    ? t(flowGateKey)
    : liveStreamStatus?.connected
      ? t("common.ready")
      : t("common.offline");

  const ribbonViewModes: Array<{ id: DashboardMode; label: string }> = [
    { id: "overview", label: t("nav.overview") },
    { id: "live", label: t("nav.live") },
    { id: "replay", label: t("nav.replay") },
    { id: "diagnostics", label: t("nav.diagnostics") },
    { id: "parser_analysis", label: t("nav.parser") },
    { id: "repositories", label: t("nav.repositories") },
    { id: "jobs", label: t("nav.jobs") },
    { id: "reports", label: t("nav.reports") },
  ];
  const currentModeLabel =
    ribbonViewModes.find((item) => item.id === viewMode)?.label ??
    viewMode;

  const handleRibbonTab = (tab: TopRibbonTab) => {
    if (!allowRibbonPanels) return;
    if (ribbonTab === tab) {
      setRibbonExpanded((prev) => !prev);
      return;
    }
    setRibbonTab(tab);
    setRibbonExpanded(true);
    setViewMenuOpen(false);
  };

  const navigateToMode = (mode: DashboardMode) => {
    setViewMode(mode);
    setRibbonExpanded(false);
    setViewMenuOpen(false);
  };

  const toggleSettingsMode = () => {
    setRibbonExpanded(false);
    setViewMenuOpen(false);
    setSettingsOpen((prev) => !prev);
  };

  const ribbonTabLabel = (tab: TopRibbonTab): string => {
    if (tab === "workspace") return t("nav.overview");
    if (tab === "analysis") return t("filter.search");
    if (tab === "control") return t("control.title");
    return t("nav.parser");
  };

  const parserConfidence = parserAnalysis?.parser_confidence ?? 0;
  const unresolvedCount = parserAnalysis?.unresolved_symbols.length ?? 0;
  const errorCount = diagnosticsSummary?.error_event_count ?? 0;
  const retryFallbackCount = (diagnosticsSummary?.retry_event_count ?? 0) + (diagnosticsSummary?.fallback_event_count ?? 0);

  const renderRibbonPanel = () => {
    if (!ribbonExpanded) return null;

    if (ribbonTab === "analysis") {
      return <FilterPanel layout="drawer" />;
    }

    if (ribbonTab === "control") {
      return (
        <div className="rounded border border-line">
          <ControlCenterBar onOpenImportWizard={() => setImportWizardOpen(true)} />
        </div>
      );
    }

    if (ribbonTab === "parser") {
      return (
        <div className="grid grid-cols-1 gap-2 rounded border border-line bg-[#071325d8] p-3 text-xs text-slate-300 md:grid-cols-3">
          <div className="rounded border border-line bg-[#0c1d31] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("filter.parserConfidence")}</div>
            <div className="mt-1 text-lg text-cyan-200">{parserConfidence.toFixed(3)}</div>
          </div>
          <div className="rounded border border-line bg-[#0c1d31] p-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("repositories.unresolved")}</div>
            <div className="mt-1 text-lg text-amber-200">{unresolvedCount}</div>
          </div>
          <div className="flex items-center gap-2 rounded border border-line bg-[#0c1d31] p-2">
              <button
                type="button"
                className="rounded border border-line bg-[#12314f] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
                onClick={() => navigateToMode("parser_analysis")}
              >
                {t("filter.openParserQuality")}
              </button>
              <button
                type="button"
                className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-200 hover:border-slate-300"
                onClick={() => navigateToMode("repositories")}
              >
                {t("nav.repositories")}
              </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-2 rounded border border-line bg-[#071325d8] p-3 text-xs text-slate-300 md:grid-cols-4">
        <div className="rounded border border-line bg-[#0c1d31] p-2">
          <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("metrics.mode")}</div>
          <div className="mt-1 text-sm text-cyan-200">{currentModeLabel}</div>
        </div>
        <div className="rounded border border-line bg-[#0c1d31] p-2">
          <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("filter.quick.errorChains")}</div>
          <div className="mt-1 text-sm text-rose-200">{errorCount}</div>
        </div>
        <div className="rounded border border-line bg-[#0c1d31] p-2">
          <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{t("filter.quick.fallbackRetry")}</div>
          <div className="mt-1 text-sm text-amber-200">{retryFallbackCount}</div>
        </div>
        <div className="flex items-center gap-2 rounded border border-line bg-[#0c1d31] p-2">
          <button
            type="button"
            className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-sky-400"
            onClick={() => navigateToMode("live")}
          >
            {t("nav.live")}
          </button>
          <button
            type="button"
            className="rounded border border-line bg-[#10243a] px-2 py-1 text-[11px] text-slate-100 hover:border-rose-400"
            onClick={() => navigateToMode("diagnostics")}
          >
            {t("nav.diagnostics")}
          </button>
        </div>
      </div>
    );
  };

  const renderViewModeMenu = () => {
    if (!viewMenuOpen) return null;

    return (
      <div className="pointer-events-none absolute right-4 top-[calc(100%+10px)] z-[1000]">
        <div className="pointer-events-auto w-[340px] rounded-xl border border-cyan-400/25 bg-[#071425b0] shadow-[0_20px_60px_rgba(1,6,18,0.7),0_0_30px_rgba(56,189,248,0.16)] backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-t-xl border-b border-line/80 bg-[#0a1c33b8] px-3 py-2">
            <div className="panel-title text-[11px] uppercase tracking-wide text-cyan-200">{t("filter.workbenchViews")}</div>
            <button
              type="button"
              className="rounded border border-line bg-[#10243a] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:border-sky-400"
              onClick={() => setViewMenuOpen(false)}
            >
              {t("common.close")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {ribbonViewModes.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`view-mode-${item.id}`}
                className={`rounded border px-2 py-1.5 text-left text-[11px] uppercase tracking-wide ${
                  viewMode === item.id
                    ? "border-sky-400 bg-[#12324f] text-slate-100"
                    : "border-line bg-[#0b1a2c] text-slate-400 hover:border-sky-400 hover:text-slate-200"
                }`}
                onClick={() => navigateToMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main data-testid="dashboard-root" className="h-screen w-screen overflow-hidden bg-transparent text-slate-100">
      <div className="mx-auto flex h-full max-w-[1900px] flex-col border-x border-line">
        <MetricsHeader metrics={metrics} mode={viewMode} diagnosticMode={diagnosticMode} />

        <header className="relative z-[1100] flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#071120d8] px-4 py-2 text-xs text-slate-300 backdrop-blur-md">
          <div>
            <div className="panel-title text-sm uppercase tracking-wide">{t("app.title")}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded border border-line bg-[#10243a] px-1.5 py-0.5">{t("header.shell")}: {shellModeText}</span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  desktopStatus?.backend.ready ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                }`}
              >
                {t("header.backend")}: {backendBadge}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  desktopStatus?.frontend.ready ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                }`}
              >
                {t("header.frontend")}: {frontendBadge}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  liveFlowMode === "always_simulated"
                    ? "border-amber-500/40 text-amber-300"
                    : liveFlowMode === "codex_real_only"
                      ? "border-cyan-500/40 text-cyan-300"
                      : "border-slate-500/40 text-slate-400"
                }`}
              >
                {t("header.flow")}: {liveFlowModeLabel}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  liveStreamStatus?.flowGate?.includes("active")
                    ? "border-emerald-500/40 text-emerald-300"
                    : liveStreamStatus?.flowGate === "always_simulated"
                      ? "border-amber-500/40 text-amber-300"
                      : "border-slate-500/40 text-slate-400"
                }`}
              >
                {t("header.source")}: {liveGateLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <CommandPalette onOpenImportWizard={() => setImportWizardOpen(true)} />
            <button
              type="button"
              data-testid="header-add-repository"
              onClick={() => setImportWizardOpen(true)}
              className="rounded border border-line bg-[#10233a] px-2 py-1 text-xs text-slate-100 hover:bg-[#18395f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("header.addRepository")}
            </button>
            <button
              type="button"
              data-testid="header-open-settings"
              onClick={toggleSettingsMode}
              className={`rounded border px-2 py-1 text-xs ${
                settingsOpen
                  ? "border-sky-400 bg-[#153250] text-slate-100"
                  : "border-line bg-[#10233a] text-slate-100 hover:bg-[#18395f]"
              }`}
            >
              {settingsOpen ? `${t("common.close")} ${t("nav.settings")}` : t("nav.settings")}
            </button>
            <select
              className="rounded border border-line bg-[#0b1a2b] px-2 py-1 text-xs text-slate-100"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {targets.length === 0 && <option value={target}>{target}</option>}
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {replayTarget && (
              <Link
                data-testid="open-replay-link"
                href={`/replay?traceId=${encodeURIComponent(replayTarget)}&target=${encodeURIComponent(target)}`}
                className="rounded border border-line bg-[#11304d] px-2 py-1 text-slate-100 hover:bg-[#174266]"
              >
                {t("header.openReplay")}
              </Link>
            )}
          </div>
        </header>

        <div ref={ribbonHostRef} className="relative z-[900] border-b border-line bg-[#06111dd8] px-4 py-2 text-xs backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {allowRibbonPanels ? (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-testid="ribbon-tab-workspace"
                  className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                    ribbonTab === "workspace"
                      ? "border-cyan-400 bg-[#153250] text-slate-100"
                      : "border-line bg-[#0f2136] text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleRibbonTab("workspace")}
                >
                  {t("nav.overview")}
                </button>
                <button
                  type="button"
                  data-testid="ribbon-tab-analysis"
                  className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                    ribbonTab === "analysis"
                      ? "border-cyan-400 bg-[#153250] text-slate-100"
                      : "border-line bg-[#0f2136] text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleRibbonTab("analysis")}
                >
                  {t("filter.search")}
                </button>
                <button
                  type="button"
                  data-testid="ribbon-tab-control"
                  className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                    ribbonTab === "control"
                      ? "border-cyan-400 bg-[#153250] text-slate-100"
                      : "border-line bg-[#0f2136] text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleRibbonTab("control")}
                >
                  {t("control.title")}
                </button>
                <button
                  type="button"
                  data-testid="ribbon-tab-parser"
                  className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                    ribbonTab === "parser"
                      ? "border-cyan-400 bg-[#153250] text-slate-100"
                      : "border-line bg-[#0f2136] text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => handleRibbonTab("parser")}
                >
                  {t("nav.parser")}
                </button>
              </div>
            ) : (
              <div className="rounded border border-line bg-[#0f2136] px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                {currentModeLabel}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded border border-line bg-[#0f2136] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                {currentModeLabel}
              </span>
              <button
                type="button"
                data-testid="view-menu-toggle"
                className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  viewMenuOpen
                    ? "border-sky-400 bg-[#12324f] text-slate-100"
                    : "border-line bg-[#0f2136] text-slate-300 hover:border-sky-400"
                }`}
                onClick={() => {
                  setViewMenuOpen((prev) => !prev);
                  setRibbonExpanded(false);
                }}
              >
                {t("filter.workbenchViews")}
              </button>
              {allowRibbonPanels ? (
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    ribbonExpanded
                      ? "border-cyan-400 bg-[#153250] text-slate-100"
                      : "border-line bg-[#0f2136] text-slate-300 hover:border-cyan-400"
                  }`}
                  onClick={() => setRibbonExpanded((prev) => !prev)}
                >
                  {ribbonExpanded ? t("common.close") : t("common.open")}
                </button>
              ) : null}
            </div>
          </div>

          {allowRibbonPanels && ribbonExpanded ? (
            <div className="pointer-events-none absolute left-4 top-[calc(100%+10px)] z-[1000]">
              <div className="pointer-events-auto w-[min(920px,calc(100vw-2rem))] rounded-xl border border-cyan-400/25 bg-[#071425b0] shadow-[0_20px_60px_rgba(1,6,18,0.7),0_0_36px_rgba(56,189,248,0.18)] backdrop-blur-xl">
                <div className="flex items-center justify-between rounded-t-xl border-b border-line/80 bg-[#0a1c33b8] px-3 py-2">
                  <div className="panel-title text-[11px] uppercase tracking-wide text-cyan-200">
                    {ribbonTabLabel(ribbonTab)}
                  </div>
                  <button
                    type="button"
                    className="rounded border border-line bg-[#10243a] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:border-sky-400"
                    onClick={() => setRibbonExpanded(false)}
                  >
                    {t("common.close")}
                  </button>
                </div>
                <div className="max-h-[58vh] overflow-y-auto p-3 scrollbar-thin">
                  {renderRibbonPanel()}
                </div>
              </div>
            </div>
          ) : null}
          {renderViewModeMenu()}
        </div>

        <div data-testid="dashboard-layout" className="relative z-0 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section data-testid="city-panel" className="relative z-0 isolate min-h-[42vh] border-r border-line lg:min-h-0">
            {isParserMode ? (
              <ParserAnalysisCenter />
            ) : isRepositoriesMode ? (
              <RepositoriesCenter />
            ) : isJobsMode ? (
              <JobsCenter />
            ) : isReportsMode ? (
              <ReportsCenter />
            ) : (
              <>
                <CityScene
                  topology={topology}
                  nodes={nodes}
                  edges={edges}
                  events={events}
                  viewMode={viewMode}
                  diagnosticMode={isDiagnosticsMode ? diagnosticMode : "realtime"}
                  selectedNodeId={selectedNodeId}
                  selectedSpanId={selectedSpanId}
                  selectedTraceId={selectedTraceId}
                  onSelectNode={(nodeId) => setSelectedNode(nodeId)}
                  onSelectEvent={(event) => setSelectedSpan(event.span_id, event.trace_id)}
                  onHoverEvent={(event) => setHoveredEvent(event)}
                />
                {isArchitectureMode ? (
                  <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
                    {promptFlowOpen ? (
                      <div className="w-[360px]">
                        <PromptTaskFlowPanel
                          nodes={nodes}
                          events={events}
                          onClose={() => setPromptFlowOpen(false)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-cyan-400/25 bg-[#061322c8] px-2 py-1 text-[11px] uppercase tracking-wide text-cyan-100 shadow-[0_12px_32px_rgba(1,10,25,0.5)] backdrop-blur-xl hover:border-cyan-300"
                        onClick={() => setPromptFlowOpen(true)}
                      >
                        {t("promptFlow.title")}
                      </button>
                    )}
                  </div>
                ) : null}
                {shouldShowStartHere ? (
                  <StartHerePanel onOpenImportWizard={() => setImportWizardOpen(true)} />
                ) : null}
                {hoveredEvent && (
                  <div className="pointer-events-none absolute left-3 top-3 z-10 w-[320px]">
                    <FlowEventHoverCard event={hoveredEvent} nodesById={nodesById} />
                  </div>
                )}
              </>
            )}
          </section>

          {isArchitectureMode && (isDiagnosticsMode || isParserMode) ? (
            <DiagnosticsCenter />
          ) : isArchitectureMode ? (
            <DetailDrawer hoveredEvent={hoveredEvent} />
          ) : (
            <ControlInspector onOpenSettings={() => setSettingsOpen(true)} />
          )}
        </div>

        {isArchitectureMode ? (
          <div
            data-testid="timeline-container"
            className={`${timelineExpanded ? "h-[220px] lg:h-[210px]" : "h-[74px]"} transition-[height] duration-200`}
          >
            <TimelinePanel compact={!timelineExpanded} onToggleCompact={() => setTimelineExpanded((prev) => !prev)} />
          </div>
        ) : (
          <div className="h-[140px] border-t border-line bg-[#070f1bcc] p-2 text-xs text-slate-400">
            <div className="panel-title text-xs uppercase tracking-wide text-slate-300">
              {t("dashboard.taskStreamTitle")}
            </div>
            <div className="mt-2">{t("dashboard.taskStreamHint")}</div>
          </div>
        )}
      </div>
      <RepositoryImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImported={handleImported}
      />
      {settingsOpen ? (
        <div
          data-testid="settings-modal"
          className="pointer-events-none fixed inset-0 z-[1000] flex items-start justify-center bg-black/42 px-4 py-8 backdrop-blur-md"
        >
          <div className="pointer-events-auto max-h-[calc(100vh-4rem)] w-[min(1120px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#071425e8] shadow-[0_24px_90px_rgba(0,0,0,0.72),0_0_45px_rgba(56,189,248,0.16)]">
            <SettingsCenter onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

