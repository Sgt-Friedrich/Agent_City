"use client";

import { useMemo, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { districtStyle } from "@/lib/visualTheme";
import { useDashboardStore } from "@/store/useDashboardStore";
import { District, FlowEvent, Node, TopologyGraph } from "@/types/schema";

interface CityMiniMapProps {
  topology?: TopologyGraph;
  nodes: Node[];
  events: FlowEvent[];
  replayTraceId?: string;
  cameraView?: {
    x: number;
    z: number;
    distance: number;
  };
  onNavigateDistrict?: (district: District) => void;
}

interface RectDistrict {
  district: District;
  x: number;
  y: number;
  w: number;
  h: number;
}

const mapWidth = 180;
const mapHeight = 126;
const mapWorld = { minX: -130, maxX: 130, minZ: -95, maxZ: 95 };

function normalizeX(value: number): number {
  return ((value - mapWorld.minX) / (mapWorld.maxX - mapWorld.minX)) * mapWidth;
}

function normalizeZ(value: number): number {
  return ((value - mapWorld.minZ) / (mapWorld.maxZ - mapWorld.minZ)) * mapHeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function CityMiniMap({ topology, nodes, events, replayTraceId, cameraView, onNavigateDistrict }: CityMiniMapProps) {
  const { t } = useI18n();
  const [overlay, setOverlay] = useState<"activity" | "errors" | "parser">("activity");
  const districtFilters = useDashboardStore((state) => state.filters.districtIds);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setDistrictFilter = useDashboardStore((state) => state.setDistrictFilter);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const diagnostics = useDashboardStore((state) => state.diagnosticsSummary);
  const parser = useDashboardStore((state) => state.parserAnalysis);

  const nodeById = useMemo(() => {
    const map: Record<string, Node> = {};
    for (const node of nodes) {
      map[node.id] = node;
    }
    return map;
  }, [nodes]);

  const activityDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (replayTraceId && event.trace_id !== replayTraceId) continue;
      const from = nodeById[event.from_node];
      const to = event.to_node ? nodeById[event.to_node] : undefined;
      if (from) set.add(from.district_id);
      if (to) set.add(to.district_id);
    }
    return set;
  }, [events, nodeById, replayTraceId]);

  const errorDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const item of diagnostics?.error_nodes ?? []) {
      set.add(item.district_id);
    }
    return set;
  }, [diagnostics?.error_nodes]);

  const lowConfidenceDistricts = useMemo(() => {
    const set = new Set<string>();
    const threshold = 0.65;
    const lowEdges = parser?.low_confidence_edges ?? [];
    for (const edge of lowEdges) {
      const from = nodeById[edge.from];
      const to = nodeById[edge.to];
      if (edge.confidence <= threshold) {
        if (from) set.add(from.district_id);
        if (to) set.add(to.district_id);
      }
    }
    return set;
  }, [nodeById, parser?.low_confidence_edges]);

  const districts = useMemo<RectDistrict[]>(() => {
    if (!topology) return [];
    return topology.districts.map((district) => {
      const left = district.position.x - district.bounds.width / 2;
      const top = district.position.z - district.bounds.depth / 2;
      return {
        district,
        x: normalizeX(left),
        y: normalizeZ(top),
        w: (district.bounds.width / (mapWorld.maxX - mapWorld.minX)) * mapWidth,
        h: (district.bounds.depth / (mapWorld.maxZ - mapWorld.minZ)) * mapHeight,
      };
    });
  }, [topology]);

  const activeSet =
    overlay === "errors"
      ? errorDistricts
      : overlay === "parser"
        ? lowConfidenceDistricts
        : activityDistricts;

  const viewportRect = useMemo(() => {
    const x = normalizeX(cameraView?.x ?? 0);
    const y = normalizeZ(cameraView?.z ?? 0);
    const span = clamp(((cameraView?.distance ?? 165) - 80) * 0.18 + 24, 20, 44);
    return {
      x: clamp(x - span / 2, 0, mapWidth - span),
      y: clamp(y - span / 2, 0, mapHeight - span),
      size: span,
    };
  }, [cameraView?.distance, cameraView?.x, cameraView?.z]);

  return (
    <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081323d8] p-2 shadow-glow">
      <div className="flex items-center justify-between gap-2">
        <div className="panel-title text-[10px] uppercase tracking-wide text-slate-300">{t("city.overviewTitle")}</div>
        <div className="flex gap-1">
          {(["activity", "errors", "parser"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded border px-1 py-0.5 text-[9px] uppercase ${
                overlay === mode
                  ? "border-cyan-400 bg-[#17324d] text-slate-100"
                  : "border-line bg-[#0b1728] text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setOverlay(mode)}
            >
              {mode === "activity" ? t("city.overlay.activity") : mode === "errors" ? t("city.overlay.errors") : t("city.overlay.parser")}
            </button>
          ))}
          <button
            type="button"
            className="rounded border border-line bg-[#0b1728] px-1 py-0.5 text-[9px] uppercase text-slate-500 hover:text-slate-300"
            onClick={() => setDistrictFilter([])}
          >
            {t("common.reset")}
          </button>
        </div>
      </div>
      <svg width={mapWidth} height={mapHeight} className="mt-1 overflow-visible">
        {districts.map(({ district, x, y, w, h }) => {
          const style = districtStyle(district.type, { active: activeSet.has(district.id) });
          const selected = districtFilters.includes(district.id);
          return (
            <g key={district.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={2}
                fill={style.fill}
                fillOpacity={activeSet.has(district.id) ? style.fillOpacity + 0.14 : style.fillOpacity + 0.05}
                stroke={style.border}
                strokeOpacity={selected ? 1 : style.borderOpacity}
                strokeWidth={selected ? 2.4 : activeSet.has(district.id) ? 1.8 : 1}
                className="cursor-pointer"
              onClick={() => {
                setDistrictFilter([district.id]);
                if (overlay === "parser") {
                  setViewMode("parser_analysis");
                  setSearchQuery(`district:${district.id}`);
                  } else if (overlay === "errors") {
                    setViewMode("diagnostics");
                    setDiagnosticMode("errors");
                    setDiagnosticFocus("errors");
                    setSearchQuery(`district:${district.id} status:error`);
                } else {
                  setViewMode("overview");
                  setSearchQuery(`district:${district.id}`);
                }
                onNavigateDistrict?.(district);
              }}
            />
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: "8px", fill: "#d3e1ef", letterSpacing: "0.02em" }}
              >
                {district.name.replace(" District", "")}
              </text>
            </g>
          );
        })}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.size}
          height={viewportRect.size}
          rx={2}
          fill="none"
          stroke="#9fd5ff"
          strokeOpacity={0.86}
          strokeWidth={1.2}
          strokeDasharray="2 2"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
