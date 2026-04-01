"use client";

import { useMemo } from "react";

import { districtStyle } from "@/lib/visualTheme";
import { District, FlowEvent, Node, TopologyGraph } from "@/types/schema";

interface CityMiniMapProps {
  topology?: TopologyGraph;
  nodes: Node[];
  events: FlowEvent[];
  replayTraceId?: string;
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

export function CityMiniMap({ topology, nodes, events, replayTraceId }: CityMiniMapProps) {
  const nodeById = useMemo(() => {
    const map: Record<string, Node> = {};
    for (const node of nodes) {
      map[node.id] = node;
    }
    return map;
  }, [nodes]);

  const activeDistricts = useMemo(() => {
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

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-line bg-[#081323d8] p-2 shadow-glow">
      <div className="panel-title text-[10px] uppercase tracking-wide text-slate-300">City Overview</div>
      <svg width={mapWidth} height={mapHeight} className="mt-1 overflow-visible">
        {districts.map(({ district, x, y, w, h }) => {
          const style = districtStyle(district.type, { active: activeDistricts.has(district.id) });
          return (
            <g key={district.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={2}
                fill={style.fill}
                fillOpacity={style.fillOpacity + 0.1}
                stroke={style.border}
                strokeOpacity={style.borderOpacity}
                strokeWidth={activeDistricts.has(district.id) ? 1.6 : 1}
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
      </svg>
    </div>
  );
}
