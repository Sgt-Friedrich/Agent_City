import {
  DistrictType,
  Edge,
  FlowEvent,
  Node,
  NodeType,
  SpanKind,
} from "@/types/schema";

export type DiagnosticMode = "realtime" | "heatmap" | "errors";
export type DashboardMode =
  | "overview"
  | "live"
  | "replay"
  | "diagnostics"
  | "parser_analysis";

export const themeTokens = {
  surface: "#050a12",
  panel: "#0a1422",
  panelElevated: "#0f1b2f",
  line: "#1e334b",
  text: "#d6e7fb",
  muted: "#7f95ad",
  accent: "#4cb8ff",
  glow: "#5cc4ff",
  status: {
    healthy: "#3ddf8e",
    warning: "#ffd05a",
    error: "#ff5f68",
    idle: "#667b92",
  },
  flow: {
    llm: "#56acff",
    retrieval: "#45d57a",
    tool: "#a67aff",
    memory: "#ffd869",
    error: "#ff5f68",
    runtime: "#56e6dc",
  },
} as const;

export const animationPresets = {
  buildingPulseHz: 1.8,
  hoverGlowBoost: 0.32,
  replayDimOpacity: 0.14,
  flowTrailBaseOpacity: 0.28,
  flowTrailActiveOpacity: 0.65,
  flowParticleBaseSize: 0.3,
  flowParticleDensityMax: 5,
} as const;

const districtPalette: Record<
  DistrictType,
  { fill: string; border: string; glow: string }
> = {
  planning: { fill: "#1f4a63", border: "#6ec8ff", glow: "#4db9ff" },
  retrieval: { fill: "#1f5344", border: "#5fe4a3", glow: "#3fd28b" },
  memory: { fill: "#6a5620", border: "#f9d56a", glow: "#eec451" },
  tools: { fill: "#43265d", border: "#c28aff", glow: "#9f69e0" },
  llm: { fill: "#1d4f7a", border: "#77c3ff", glow: "#5eafff" },
  safety: { fill: "#642f2d", border: "#ff8c86", glow: "#ff6862" },
  runtime: { fill: "#2d4c64", border: "#7fc7f9", glow: "#5ba7de" },
  boundary: { fill: "#38404a", border: "#9aa5b5", glow: "#8490a2" },
};

const nodeTypePreset: Record<
  NodeType,
  { variant: "tower" | "datacenter" | "warehouse" | "industrial" | "checkpoint" | "hub"; roughness: number; metalness: number; glyph: string }
> = {
  llm: { variant: "tower", roughness: 0.14, metalness: 0.18, glyph: "LLM" },
  prompt: { variant: "tower", roughness: 0.2, metalness: 0.12, glyph: "PR" },
  planner: { variant: "hub", roughness: 0.24, metalness: 0.3, glyph: "PL" },
  agent: { variant: "hub", roughness: 0.24, metalness: 0.26, glyph: "AG" },
  sub_agent: { variant: "hub", roughness: 0.26, metalness: 0.24, glyph: "SA" },
  retriever: { variant: "datacenter", roughness: 0.34, metalness: 0.22, glyph: "RE" },
  reranker: { variant: "datacenter", roughness: 0.34, metalness: 0.2, glyph: "RR" },
  embedding: { variant: "datacenter", roughness: 0.36, metalness: 0.2, glyph: "EM" },
  memory: { variant: "warehouse", roughness: 0.44, metalness: 0.18, glyph: "ME" },
  tool: { variant: "industrial", roughness: 0.32, metalness: 0.45, glyph: "TL" },
  mcp: { variant: "industrial", roughness: 0.3, metalness: 0.52, glyph: "MC" },
  guardrail: { variant: "checkpoint", roughness: 0.4, metalness: 0.24, glyph: "GR" },
  evaluator: { variant: "checkpoint", roughness: 0.42, metalness: 0.22, glyph: "EV" },
  runtime: { variant: "hub", roughness: 0.3, metalness: 0.33, glyph: "RT" },
  session: { variant: "hub", roughness: 0.31, metalness: 0.31, glyph: "SE" },
  event_bus: { variant: "hub", roughness: 0.3, metalness: 0.32, glyph: "EVB" },
  external: { variant: "industrial", roughness: 0.4, metalness: 0.18, glyph: "EX" },
};

const spanPalette: Record<SpanKind, string> = {
  AGENT: themeTokens.flow.runtime,
  CHAIN: themeTokens.flow.runtime,
  LLM: themeTokens.flow.llm,
  TOOL: themeTokens.flow.tool,
  RETRIEVER: themeTokens.flow.retrieval,
  RERANKER: themeTokens.flow.retrieval,
  EMBEDDING: themeTokens.flow.retrieval,
  GUARDRAIL: "#ff9361",
  EVALUATOR: "#ff9361",
  MEMORY: themeTokens.flow.memory,
  MCP: themeTokens.flow.tool,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHeat(node: Node): number {
  const qps = node.metrics?.qps ?? 0;
  const active = node.metrics?.active_count ?? 0;
  return clamp(qps / 45 + active / 36, 0, 1);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`
    : value;
  const number = Number.parseInt(normalized, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(a: string, b: string, ratio: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  const t = clamp(ratio, 0, 1);
  return rgbToHex(
    left.r + (right.r - left.r) * t,
    left.g + (right.g - left.g) * t,
    left.b + (right.b - left.b) * t,
  );
}

function heatColor(value: number): string {
  const v = clamp(value, 0, 1);
  if (v < 0.5) {
    return mixHex("#37cfa4", "#f0d35f", v / 0.5);
  }
  return mixHex("#f0d35f", "#ff5f68", (v - 0.5) / 0.5);
}

export function statusColor(status: string): string {
  switch (status) {
    case "healthy":
    case "success":
      return themeTokens.status.healthy;
    case "warning":
    case "partial":
      return themeTokens.status.warning;
    case "error":
    case "failed":
      return themeTokens.status.error;
    default:
      return themeTokens.status.idle;
  }
}

export function spanKindColor(spanKind: SpanKind, status?: string): string {
  if (status === "error" || status === "failed") {
    return themeTokens.flow.error;
  }
  return spanPalette[spanKind] ?? themeTokens.flow.runtime;
}

export function districtStyle(
  districtType: DistrictType,
  opts?: { dimmed?: boolean; hovered?: boolean; active?: boolean; diagnosticMode?: DiagnosticMode },
): {
  fill: string;
  border: string;
  glow: string;
  fillOpacity: number;
  borderOpacity: number;
} {
  const palette = districtPalette[districtType] ?? districtPalette.runtime;
  const fillOpacityBase = opts?.diagnosticMode === "errors" ? 0.17 : 0.24;
  const dimScale = opts?.dimmed ? 0.35 : 1;
  const hoverBoost = opts?.hovered ? 0.08 : 0;
  const activeBoost = opts?.active ? 0.05 : 0;

  return {
    fill: palette.fill,
    border: palette.border,
    glow: palette.glow,
    fillOpacity: clamp((fillOpacityBase + hoverBoost + activeBoost) * dimScale, 0.06, 0.46),
    borderOpacity: clamp((opts?.dimmed ? 0.22 : 0.54) + (opts?.hovered ? 0.3 : 0), 0.15, 0.96),
  };
}

export function nodeStyle(
  node: Node,
  opts: {
    hovered?: boolean;
    highlighted?: boolean;
    dimmed?: boolean;
    active?: boolean;
    diagnosticMode?: DiagnosticMode;
  },
): {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  roughness: number;
  metalness: number;
  statusLight: string;
  variant: "tower" | "datacenter" | "warehouse" | "industrial" | "checkpoint" | "hub";
  glyph: string;
} {
  const preset = nodeTypePreset[node.type] ?? nodeTypePreset.runtime;
  const heat = normalizeHeat(node);
  const status = statusColor(node.status);
  const mode = opts.diagnosticMode ?? "realtime";
  const activeBoost = opts.active ? 0.18 : 0;

  const baseColor = mode === "heatmap" ? heatColor(heat) : status;
  const color = mode === "errors" && node.status !== "error" ? mixHex(baseColor, "#243243", 0.55) : baseColor;
  const opacity = opts.dimmed ? 0.14 : clamp(0.74 + activeBoost + (opts.hovered || opts.highlighted ? 0.2 : 0), 0.2, 1);
  const emissiveIntensity = clamp(
    (opts.hovered || opts.highlighted ? 0.44 : 0.14) + activeBoost,
    0.08,
    0.95,
  );

  return {
    color,
    emissive: color,
    emissiveIntensity,
    opacity,
    roughness: preset.roughness,
    metalness: preset.metalness,
    statusLight: status,
    variant: preset.variant,
    glyph: preset.glyph,
  };
}

export function edgeStyle(
  edge: Edge,
  opts?: { highlighted?: boolean; dimmed?: boolean; diagnosticMode?: DiagnosticMode },
): {
  color: string;
  glowColor: string;
  opacity: number;
  glowOpacity: number;
  width: number;
  dashed: boolean;
} {
  const mode = opts?.diagnosticMode ?? "realtime";
  const isErrorEdge = edge.kind === "retry" || edge.kind === "fallback" || edge.status === "error";
  const isDeclared = edge.status === "declared";
  const color = isErrorEdge
    ? themeTokens.flow.error
    : edge.kind === "dataflow"
      ? "#79c8ff"
      : isDeclared
        ? "#4f7295"
        : "#66a8d8";

  const inErrorModeDimmed = mode === "errors" && !isErrorEdge;
  const dimmed = opts?.dimmed || inErrorModeDimmed;

  return {
    color,
    glowColor: opts?.highlighted ? mixHex(color, "#ffffff", 0.22) : color,
    opacity: dimmed ? 0.08 : opts?.highlighted ? 0.8 : 0.35,
    glowOpacity: dimmed ? 0.06 : opts?.highlighted ? 0.7 : 0.24,
    width: opts?.highlighted ? 2.3 : edge.kind === "invocation" ? 1.5 : 1.1,
    dashed: edge.kind === "dependency" || edge.kind === "fallback" || edge.kind === "retry",
  };
}

export function flowStyle(
  event: FlowEvent,
  opts?: { replay?: boolean; active?: boolean; diagnosticMode?: DiagnosticMode },
): {
  color: string;
  particleCount: number;
  particleSize: number;
  speed: number;
  lineWidth: number;
  trailOpacity: number;
  dashed: boolean;
  blink: boolean;
} {
  const mode = opts?.diagnosticMode ?? "realtime";
  const retryLike = event.retry_count > 0;
  const fallbackLike = Boolean(event.fallback_from);
  const errorLike = event.status === "error" || retryLike || fallbackLike;

  const baseColor = errorLike
    ? themeTokens.flow.error
    : spanKindColor(event.span_kind, event.status);
  const color = mode === "errors" && !errorLike ? mixHex(baseColor, "#2f3d4d", 0.5) : baseColor;

  const speed = clamp(2.2 - event.latency_ms / 1200, 0.22, 1.9);
  const throughputHint = clamp((event.attributes?.throughput as number | undefined) ?? 0.5, 0.1, 1.2);
  const particleCount = clamp(Math.round(1 + throughputHint * 2.6 + (opts?.active ? 1 : 0)), 1, animationPresets.flowParticleDensityMax);
  const lineWidth = errorLike ? 2.4 : opts?.active ? 2.1 : 1.5;
  const trailOpacity = errorLike
    ? 0.86
    : opts?.active
      ? animationPresets.flowTrailActiveOpacity
      : animationPresets.flowTrailBaseOpacity;
  const particleSize = clamp(
    animationPresets.flowParticleBaseSize + (opts?.active ? 0.08 : 0) + (errorLike ? 0.04 : 0),
    0.24,
    0.56,
  );

  return {
    color,
    particleCount,
    particleSize,
    speed,
    lineWidth,
    trailOpacity,
    dashed: retryLike || fallbackLike || event.protocol === "mcp",
    blink: errorLike || event.status === "partial",
  };
}

export const flowLegend = [
  { label: "LLM", color: themeTokens.flow.llm },
  { label: "Retrieval", color: themeTokens.flow.retrieval },
  { label: "Tool / MCP", color: themeTokens.flow.tool },
  { label: "Memory", color: themeTokens.flow.memory },
  { label: "Runtime", color: themeTokens.flow.runtime },
  { label: "Error / Retry / Fallback", color: themeTokens.flow.error },
] as const;
