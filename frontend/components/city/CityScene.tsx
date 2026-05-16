"use client";

import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { BuildingNode } from "@/components/city/BuildingNode";
import { CityMiniMap } from "@/components/city/CityMiniMap";
import { DistrictGround } from "@/components/city/DistrictGround";
import { EdgeRoad } from "@/components/city/EdgeRoad";
import { LiveFlows } from "@/components/city/LiveFlows";
import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";
import { useDashboardStore } from "@/store/useDashboardStore";
import { Edge, FlowEvent, Node, TopologyGraph } from "@/types/schema";

interface CitySceneProps {
  topology?: TopologyGraph;
  nodes: Node[];
  edges: Edge[];
  events: FlowEvent[];
  selectedNodeId?: string;
  selectedSpanId?: string;
  selectedTraceId?: string;
  viewMode?: DashboardMode;
  diagnosticMode?: DiagnosticMode;
  replay?: {
    enabled: boolean;
    traceId?: string;
    cursor: number;
  };
  onSelectNode: (nodeId: string) => void;
  onSelectEvent: (event: FlowEvent) => void;
  onHoverEvent: (event?: FlowEvent) => void;
}

interface CameraViewSnapshot {
  x: number;
  z: number;
  distance: number;
}

interface CameraDirectorProps {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  navigationTarget?: { x: number; z: number };
  replayFollowTarget?: { x: number; z: number };
  onSnapshot: (snapshot: CameraViewSnapshot) => void;
  onNavigationSettled: () => void;
}

const NODE_CLUSTER_RADIUS = 9.5;
const NODE_LAYOUT_GOLDEN_ANGLE = 2.399963229728653;
const NODE_ACTIVITY_WINDOW_MS = 150_000;
const DENSE_NODE_THRESHOLD = 9;

type NodeDensityMode = "aggregate" | "balanced" | "detail";

interface NodeLayoutResult {
  nodes: Node[];
  aggregateCounts: Record<string, number>;
  representativeByNodeId: Record<string, string>;
}

interface AdaptiveDistrictMeta {
  toolsScale: number;
  runtimeScale: number;
}

type MutableDistrict = TopologyGraph["districts"][number];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDistrictOverlaps(
  inputDistricts: MutableDistrict[],
  anchorDistrictId?: string,
): MutableDistrict[] {
  const districts = inputDistricts.map((district) => ({
    ...district,
    position: { ...district.position },
    bounds: { ...district.bounds },
  }));

  const PADDING = 1.6;
  const ITERATIONS = 30;

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    let moved = false;
    for (let i = 0; i < districts.length; i += 1) {
      for (let j = i + 1; j < districts.length; j += 1) {
        const left = districts[i];
        const right = districts[j];

        const halfLeftW = left.bounds.width / 2 + PADDING;
        const halfLeftD = left.bounds.depth / 2 + PADDING;
        const halfRightW = right.bounds.width / 2 + PADDING;
        const halfRightD = right.bounds.depth / 2 + PADDING;

        const dx = right.position.x - left.position.x;
        const dz = right.position.z - left.position.z;
        const overlapX = halfLeftW + halfRightW - Math.abs(dx);
        const overlapZ = halfLeftD + halfRightD - Math.abs(dz);

        if (overlapX <= 0 || overlapZ <= 0) continue;

        const moveOnX = overlapX < overlapZ;
        const overlap = moveOnX ? overlapX : overlapZ;
        const direction = (moveOnX ? dx : dz) >= 0 ? 1 : -1;
        const push = overlap / 2 + 0.36;

        const leftLocked = left.id === anchorDistrictId || left.type === "planning";
        const rightLocked = right.id === anchorDistrictId || right.type === "planning";

        const applyMove = (district: MutableDistrict, deltaX: number, deltaZ: number) => {
          district.position.x = clampNumber(district.position.x + deltaX, -180, 180);
          district.position.z = clampNumber(district.position.z + deltaZ, -130, 130);
        };

        if (!leftLocked && !rightLocked) {
          if (moveOnX) {
            applyMove(left, -direction * push, 0);
            applyMove(right, direction * push, 0);
          } else {
            applyMove(left, 0, -direction * push);
            applyMove(right, 0, direction * push);
          }
        } else if (leftLocked && !rightLocked) {
          if (moveOnX) {
            applyMove(right, direction * push * 2, 0);
          } else {
            applyMove(right, 0, direction * push * 2);
          }
        } else if (!leftLocked && rightLocked) {
          if (moveOnX) {
            applyMove(left, -direction * push * 2, 0);
          } else {
            applyMove(left, 0, -direction * push * 2);
          }
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  return districts;
}

function agentScaleBias(target: string): { tools: number; runtime: number } {
  const name = target.toLowerCase();
  if (
    name.includes("codex") ||
    name.includes("swe") ||
    name.includes("openhands") ||
    name.includes("autogen")
  ) {
    return { tools: 0.26, runtime: 0.18 };
  }
  if (name.includes("claude") || name.includes("cloude")) {
    return { tools: 0.14, runtime: 0.12 };
  }
  if (name.includes("langgraph") || name.includes("workflow") || name.includes("agent")) {
    return { tools: 0.16, runtime: 0.2 };
  }
  return { tools: 0.08, runtime: 0.1 };
}

function adaptTopologyByTarget(
  topology: TopologyGraph | undefined,
  nodePool: Node[],
  target: string,
): { topology: TopologyGraph | undefined; meta: AdaptiveDistrictMeta } {
  if (!topology) {
    return { topology, meta: { toolsScale: 1, runtimeScale: 1 } };
  }

  const nodes = topology.nodes.length > 0 ? topology.nodes : nodePool;
  const districtNodeCounts = new Map<string, number>();
  for (const node of nodes) {
    districtNodeCounts.set(node.district_id, (districtNodeCounts.get(node.district_id) ?? 0) + 1);
  }

  const planningDistrict =
    topology.districts.find((district) => district.type === "planning") ?? topology.districts[0];
  const centerX = planningDistrict?.position.x ?? 0;
  const centerZ = planningDistrict?.position.z ?? 0;

  const bias = agentScaleBias(target);
  let toolsScale = 1;
  let runtimeScale = 1;

  const districts = topology.districts.map((district) => {
    if (district.type !== "tools" && district.type !== "runtime") {
      return district;
    }

    const count = districtNodeCounts.get(district.id) ?? 0;
    const density = count / Math.max(1, nodes.length);
    const metricHeat = nodes
      .filter((node) => node.district_id === district.id)
      .reduce((acc, node) => acc + (node.metrics?.qps ?? 0) * 0.02 + (node.metrics?.active_count ?? 0) * 0.05, 0);

    const biasValue = district.type === "tools" ? bias.tools : bias.runtime;
    const growth =
      Math.sqrt(Math.max(0, count)) * 0.085 +
      density * 1.7 +
      metricHeat * 0.035 +
      biasValue;
    const scale = clampNumber(1 + growth, 1, 2.25);

    if (district.type === "tools") toolsScale = scale;
    if (district.type === "runtime") runtimeScale = scale;

    const directionX = district.position.x - centerX;
    const directionZ = district.position.z - centerZ;
    const directionLen = Math.hypot(directionX, directionZ) || 1;
    const push = (scale - 1) * 8.5;
    const nextX = district.position.x + (directionX / directionLen) * push;
    const nextZ = district.position.z + (directionZ / directionLen) * push;

    return {
      ...district,
      position: {
        ...district.position,
        x: nextX,
        z: nextZ,
      },
      bounds: {
        width: district.bounds.width * (district.type === "tools" ? scale * 1.06 : scale),
        depth: district.bounds.depth * (district.type === "runtime" ? scale * 1.04 : scale),
      },
      metadata: {
        ...district.metadata,
        adaptive_scale: scale,
        adaptive_target: target,
      },
    };
  });

  const resolvedDistricts = resolveDistrictOverlaps(districts, planningDistrict?.id);

  return {
    topology: {
      ...topology,
      districts: resolvedDistricts,
    },
    meta: {
      toolsScale,
      runtimeScale,
    },
  };
}

function nodePriority(node: Node): number {
  const coreTypes: Node["type"][] = ["planner", "llm", "guardrail", "runtime", "event_bus"];
  const coreBoost = coreTypes.includes(node.type) ? 20 : 0;
  const metricBoost = node.metrics ? (node.metrics.qps ?? 0) * 2 + (node.metrics.active_count ?? 0) : 0;
  return coreBoost + node.height * 0.8 + node.size * 0.7 + metricBoost;
}

function clampToDistrict(node: Node, districtsById: Record<string, TopologyGraph["districts"][number]>): Node {
  const district = districtsById[node.district_id];
  if (!district) return node;
  const margin = Math.max(1.8, node.size * 0.55);
  const minX = district.position.x - district.bounds.width / 2 + margin;
  const maxX = district.position.x + district.bounds.width / 2 - margin;
  const minZ = district.position.z - district.bounds.depth / 2 + margin;
  const maxZ = district.position.z + district.bounds.depth / 2 - margin;
  return {
    ...node,
    position: {
      ...node.position,
      x: Math.max(minX, Math.min(maxX, node.position.x)),
      z: Math.max(minZ, Math.min(maxZ, node.position.z)),
    },
  };
}

function clampNodePositionMutable(node: Node, district: TopologyGraph["districts"][number]) {
  const margin = Math.max(1.8, node.size * 0.55);
  const minX = district.position.x - district.bounds.width / 2 + margin;
  const maxX = district.position.x + district.bounds.width / 2 - margin;
  const minZ = district.position.z - district.bounds.depth / 2 + margin;
  const maxZ = district.position.z + district.bounds.depth / 2 - margin;
  node.position.x = clampNumber(node.position.x, minX, maxX);
  node.position.z = clampNumber(node.position.z, minZ, maxZ);
}

function relaxDistrictNodeCollisions(
  districtNodes: Node[],
  district: TopologyGraph["districts"][number],
  mode: NodeDensityMode,
) {
  if (districtNodes.length < 2) return;

  const iterations = mode === "detail" ? 22 : 14;
  for (let step = 0; step < iterations; step += 1) {
    let moved = false;
    for (let i = 0; i < districtNodes.length; i += 1) {
      for (let j = i + 1; j < districtNodes.length; j += 1) {
        const a = districtNodes[i];
        const b = districtNodes[j];
        let dx = b.position.x - a.position.x;
        let dz = b.position.z - a.position.z;
        let dist = Math.hypot(dx, dz);
        const minDist = Math.max(
          2.4,
          (a.size + b.size) * 0.7 + (mode === "detail" ? 1.1 : 0.75),
        );
        if (dist >= minDist) continue;

        if (dist < 0.001) {
          const angle = ((i + 1) * 1.7 + (j + 1) * 2.3) % (Math.PI * 2);
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          dist = 1;
        } else {
          dx /= dist;
          dz /= dist;
        }

        const push = (minDist - dist) * 0.54;
        a.position.x -= dx * push;
        a.position.z -= dz * push;
        b.position.x += dx * push;
        b.position.z += dz * push;
        moved = true;
      }
    }

    for (const node of districtNodes) {
      clampNodePositionMutable(node, district);
    }

    if (!moved) break;
  }
}

function normalizeNodeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\-./:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nodeGroupKey(node: Node): string {
  const explainability = node.metadata?.explainability as Record<string, unknown> | undefined;
  const explicitGroup = typeof explainability?.group === "string" ? explainability.group : undefined;
  if (explicitGroup) {
    return `${node.type}:${explicitGroup}`;
  }

  const normalized = normalizeNodeName(node.name);
  const parts = normalized.split(/[-_.:/]+/).filter(Boolean);
  if (!parts.length) {
    return `${node.type}:core`;
  }

  if (parts.length >= 2 && (node.type === "runtime" || node.type === "tool" || node.type === "mcp")) {
    return `${node.type}:${parts[0]}-${parts[1]}`;
  }
  return `${node.type}:${parts[0]}`;
}

function nodeDisplayName(node: Node): string {
  const explainability = node.metadata?.explainability as Record<string, unknown> | undefined;
  if (typeof explainability?.display_name === "string" && explainability.display_name.trim()) {
    return explainability.display_name;
  }
  if (typeof node.metadata?.display_name === "string" && node.metadata.display_name.trim()) {
    return node.metadata.display_name;
  }
  return node.name;
}

function districtGridCenter(
  district: TopologyGraph["districts"][number],
  index: number,
  total: number,
  margin: number,
) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);

  const width = Math.max(8, district.bounds.width - margin * 2);
  const depth = Math.max(8, district.bounds.depth - margin * 2);
  const minX = district.position.x - width / 2;
  const minZ = district.position.z - depth / 2;
  const cellW = width / cols;
  const cellD = depth / rows;

  return {
    x: minX + cellW * (col + 0.5),
    z: minZ + cellD * (row + 0.5),
    cellW,
    cellD,
  };
}

function applyNodeLayout(nodes: Node[], topology: TopologyGraph | undefined, mode: NodeDensityMode): NodeLayoutResult {
  if (!nodes.length) return { nodes, aggregateCounts: {}, representativeByNodeId: {} };
  const districtsById: Record<string, TopologyGraph["districts"][number]> = {};
  for (const district of topology?.districts ?? []) {
    districtsById[district.id] = district;
  }

  const cloned = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  const byDistrict = new Map<string, Node[]>();
  for (const node of cloned) {
    const list = byDistrict.get(node.district_id) ?? [];
    list.push(node);
    byDistrict.set(node.district_id, list);
  }

  const aggregateCounts: Record<string, number> = {};
  const representativeByNodeId: Record<string, string> = {};
  const keptNodes: Node[] = [];

  for (const node of cloned) {
    representativeByNodeId[node.id] = node.id;
  }

  for (const [districtId, districtNodes] of byDistrict.entries()) {
    const district = districtsById[districtId];
    if (!district || districtNodes.length < DENSE_NODE_THRESHOLD) {
      const visited = new Set<string>();
      const original = districtNodes.map((node) => ({ id: node.id, x: node.position.x, z: node.position.z }));

      for (const seed of original) {
        if (visited.has(seed.id)) continue;

        const clusterIds: string[] = [];
        for (const candidate of original) {
          const dx = candidate.x - seed.x;
          const dz = candidate.z - seed.z;
          if (Math.hypot(dx, dz) <= NODE_CLUSTER_RADIUS) {
            clusterIds.push(candidate.id);
          }
        }

        clusterIds.forEach((id) => visited.add(id));
        if (clusterIds.length <= 1) continue;

        const clusterNodes = districtNodes
          .filter((node) => clusterIds.includes(node.id))
          .sort((a, b) => nodePriority(b) - nodePriority(a));

        const center = clusterNodes.reduce(
          (acc, node) => ({ x: acc.x + node.position.x, z: acc.z + node.position.z }),
          { x: 0, z: 0 },
        );
        center.x /= clusterNodes.length;
        center.z /= clusterNodes.length;

        const spread = mode === "detail" ? 4.4 : 3.2;
        clusterNodes.forEach((node, index) => {
          if (index === 0) {
            node.position.x = center.x;
            node.position.z = center.z;
            return;
          }
          const radius = 3.2 + Math.sqrt(index) * spread;
          const angle = index * NODE_LAYOUT_GOLDEN_ANGLE;
          node.position.x = center.x + Math.cos(angle) * radius;
          node.position.z = center.z + Math.sin(angle) * radius;
        });
      }

      if (mode === "aggregate") {
        const sorted = districtNodes.slice().sort((a, b) => nodePriority(b) - nodePriority(a));
        const representative = clampToDistrict(sorted[0], districtsById);
        aggregateCounts[representative.id] = districtNodes.length;
        for (const node of districtNodes) {
          representativeByNodeId[node.id] = representative.id;
        }
        keptNodes.push(representative);
      } else {
        if (district) {
          relaxDistrictNodeCollisions(districtNodes, district, mode);
        }
        keptNodes.push(...districtNodes.map((node) => clampToDistrict(node, districtsById)));
      }
      continue;
    }

    const groups = new Map<string, Node[]>();
    for (const node of districtNodes) {
      const key = nodeGroupKey(node);
      const list = groups.get(key) ?? [];
      list.push(node);
      groups.set(key, list);
    }

    const grouped = Array.from(groups.values())
      .map((group) => group.slice().sort((a, b) => nodePriority(b) - nodePriority(a)))
      .sort((a, b) => b.length - a.length || nodePriority(b[0]) - nodePriority(a[0]));

    const margin = mode === "detail" ? 3.4 : 4.6;
    const visibleDistrictNodes: Node[] = [];
    grouped.forEach((groupNodes, groupIndex) => {
      const grid = districtGridCenter(district, groupIndex, grouped.length, margin);
      const baseRadius = Math.max(2.6, Math.min(grid.cellW, grid.cellD) * (mode === "detail" ? 0.28 : 0.2));
      const radialStep = Math.max(2.1, Math.min(grid.cellW, grid.cellD) * (mode === "detail" ? 0.22 : 0.16));
      const maxRadius = Math.max(4.2, Math.min(grid.cellW, grid.cellD) * 0.46);

      const shouldAggregateGroup = mode === "aggregate" || (mode === "balanced" && groupNodes.length > 2);
      if (shouldAggregateGroup) {
        const representative = groupNodes[0];
        representative.position.x = grid.x;
        representative.position.z = grid.z;
        aggregateCounts[representative.id] = groupNodes.length;
        for (const node of groupNodes) {
          representativeByNodeId[node.id] = representative.id;
        }
        visibleDistrictNodes.push(representative);
        return;
      }

      groupNodes.forEach((node, index) => {
        if (index === 0) {
          node.position.x = grid.x;
          node.position.z = grid.z;
          return;
        }
        const radius = Math.min(maxRadius, baseRadius + Math.sqrt(index) * radialStep);
        const angle = index * NODE_LAYOUT_GOLDEN_ANGLE + (groupIndex % 2) * 0.45;
        node.position.x = grid.x + Math.cos(angle) * radius;
        node.position.z = grid.z + Math.sin(angle) * radius;
      });
      visibleDistrictNodes.push(...groupNodes);
    });

    relaxDistrictNodeCollisions(visibleDistrictNodes, district, mode);
    keptNodes.push(...visibleDistrictNodes.map((node) => clampToDistrict(node, districtsById)));
  }

  if (mode === "aggregate" && keptNodes.length === 0) {
    return {
      nodes: cloned.map((node) => clampToDistrict(node, districtsById)),
      aggregateCounts,
      representativeByNodeId,
    };
  }

  return {
    nodes: mode === "aggregate" ? keptNodes : keptNodes.length ? keptNodes : cloned.map((node) => clampToDistrict(node, districtsById)),
    aggregateCounts,
    representativeByNodeId,
  };
}

function nextAutoNodeDensity(
  current: NodeDensityMode,
  distance: number,
  replayEnabled: boolean,
): NodeDensityMode {
  if (replayEnabled) return "detail";

  if (current === "aggregate") {
    if (distance < 170) return "balanced";
    return "aggregate";
  }
  if (current === "detail") {
    if (distance > 122) return "balanced";
    return "detail";
  }

  if (distance >= 188) return "aggregate";
  if (distance <= 104) return "detail";
  return "balanced";
}

function CameraDirector({
  controlsRef,
  navigationTarget,
  replayFollowTarget,
  onSnapshot,
  onNavigationSettled,
}: CameraDirectorProps) {
  const { camera } = useThree();
  const tick = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    let forceSnapshot = false;

    if (navigationTarget) {
      const target = new THREE.Vector3(navigationTarget.x, 0, navigationTarget.z);
      controls.target.lerp(target, 0.2);
      controls.target.y = 0;
      const desiredPos = target.clone().add(new THREE.Vector3(56, 112, 56));
      camera.position.lerp(desiredPos, 0.14);
      controls.update();
      forceSnapshot = true;

      if (controls.target.distanceTo(target) < 0.9 && camera.position.distanceTo(desiredPos) < 2.4) {
        onNavigationSettled();
      }
    } else if (replayFollowTarget) {
      const target = new THREE.Vector3(replayFollowTarget.x, 0, replayFollowTarget.z);
      controls.target.lerp(target, 0.08);
      controls.target.y = 0;
      const desiredPos = target.clone().add(new THREE.Vector3(50, 95, 48));
      camera.position.lerp(desiredPos, 0.055);
      controls.update();
      forceSnapshot = true;
    } else if (Math.abs(controls.target.y) > 0.001) {
      controls.target.y = 0;
      controls.update();
      forceSnapshot = true;
    }

    tick.current += delta;
    if (forceSnapshot || tick.current > 0.17) {
      tick.current = 0;
      onSnapshot({
        x: controls.target.x,
        z: controls.target.z,
        distance: camera.position.distanceTo(controls.target),
      });
    }
  });

  return null;
}

export function CityScene({
  topology,
  nodes,
  edges,
  events,
  selectedNodeId,
  selectedSpanId,
  selectedTraceId,
  viewMode = "overview",
  diagnosticMode = "realtime",
  replay,
  onSelectNode,
  onSelectEvent,
  onHoverEvent,
}: CitySceneProps) {
  const { t, formatRelativeTime } = useI18n();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [cameraView, setCameraView] = useState<CameraViewSnapshot>({ x: 0, z: 0, distance: 165 });
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; z: number }>();
  const [edgeDensity, setEdgeDensity] = useState<"focus" | "balanced" | "full">("focus");
  const [nodeDensity, setNodeDensity] = useState<NodeDensityMode>("balanced");

  const diagnosticFocus = useDashboardStore((state) => state.diagnosticFocus);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const promptStageFocus = useDashboardStore((state) => state.promptStageFocus);
  const promptStageNodeIds = useDashboardStore((state) => state.promptStageNodeIds);
  const target = useDashboardStore((state) => state.target);

  useEffect(() => {
    if (replay?.enabled) {
      setEdgeDensity("balanced");
      return;
    }
    if (viewMode === "overview") {
      setEdgeDensity("focus");
      return;
    }
    if (viewMode === "diagnostics" || viewMode === "live") {
      setEdgeDensity("balanced");
    }
  }, [replay?.enabled, viewMode]);

  useEffect(() => {
    setNodeDensity((current) =>
      nextAutoNodeDensity(current, cameraView.distance, Boolean(replay?.enabled)),
    );
  }, [cameraView.distance, replay?.enabled]);

  const adaptiveTopology = useMemo(
    () => adaptTopologyByTarget(topology, nodes, target),
    [nodes, target, topology],
  );
  const effectiveTopology = adaptiveTopology.topology;
  const nodeLayout = useMemo(
    () => applyNodeLayout(nodes, effectiveTopology, nodeDensity),
    [effectiveTopology, nodeDensity, nodes],
  );
  const layoutNodes = nodeLayout.nodes;
  const aggregateCounts = nodeLayout.aggregateCounts;
  const representativeByNodeId = nodeLayout.representativeByNodeId;
  const sourceNodesById = useMemo<Record<string, Node>>(
    () =>
      nodes.reduce<Record<string, Node>>((acc, node) => {
        acc[node.id] = node;
        return acc;
      }, {}),
    [nodes],
  );

  const nodesById = useMemo<Record<string, Node>>(() => {
    const map = layoutNodes.reduce<Record<string, Node>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});

    for (const [nodeId, representativeId] of Object.entries(representativeByNodeId)) {
      if (!map[nodeId] && map[representativeId]) {
        map[nodeId] = map[representativeId];
      }
    }

    return map;
  }, [layoutNodes, representativeByNodeId]);

  const activeEvents = useMemo(() => {
    if (!replay?.enabled || !replay.traceId) {
      const now = Date.now();
      return events
        .filter((event) => {
          const ts = Date.parse(event.timestamp);
          if (Number.isNaN(ts)) return false;
          return now - ts <= NODE_ACTIVITY_WINDOW_MS;
        })
        .slice(0, 240);
    }
    return events.filter((event) => event.trace_id === replay.traceId).slice(0, Math.max(replay.cursor, 1));
  }, [events, replay]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.span_id === selectedSpanId),
    [events, selectedSpanId],
  );

  const focusedTraceId = useMemo(() => {
    if (replay?.enabled && replay.traceId) return replay.traceId;
    if (selectedTraceId) return selectedTraceId;
    if (selectedEvent?.trace_id) return selectedEvent.trace_id;
    return undefined;
  }, [replay?.enabled, replay?.traceId, selectedTraceId, selectedEvent?.trace_id]);

  const stageFocusedNodeSet = useMemo(
    () => new Set(promptStageNodeIds),
    [promptStageNodeIds],
  );
  const stageFocusActive = Boolean(!focusedTraceId && promptStageFocus && stageFocusedNodeSet.size > 0);

  const focusedEvents = useMemo(() => {
    if (!focusedTraceId) return [];
    const sourceEvents = replay?.enabled ? activeEvents : events;
    return sourceEvents.filter((event) => event.trace_id === focusedTraceId);
  }, [activeEvents, events, focusedTraceId, replay?.enabled]);

  const focusedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (const event of focusedEvents) {
      const fromId = representativeByNodeId[event.from_node] ?? event.from_node;
      const toId = event.to_node ? representativeByNodeId[event.to_node] ?? event.to_node : undefined;
      if (toId) {
        set.add(`${fromId}::${toId}`);
      }
    }
    return set;
  }, [focusedEvents, representativeByNodeId]);

  const activeNodeIds = useMemo(() => {
    const set = new Set<string>();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      const fromId = representativeByNodeId[event.from_node] ?? event.from_node;
      set.add(fromId);
      if (event.to_node) {
        set.add(representativeByNodeId[event.to_node] ?? event.to_node);
      }
    }
    return set;
  }, [activeEvents, focusedEvents, representativeByNodeId]);

  const edgeTraffic = useMemo(() => {
    const counts = new Map<string, number>();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      if (!event.to_node) continue;
      const fromId = representativeByNodeId[event.from_node] ?? event.from_node;
      const toId = representativeByNodeId[event.to_node] ?? event.to_node;
      const key = `${fromId}::${toId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [activeEvents, focusedEvents, representativeByNodeId]);

  const edgeEventStats = useMemo(() => {
    const map = new Map<
      string,
      { error: number; retry: number; fallback: number; maxLatency: number; maxQueue: number }
    >();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      if (!event.to_node) continue;
      const fromId = representativeByNodeId[event.from_node] ?? event.from_node;
      const toId = representativeByNodeId[event.to_node] ?? event.to_node;
      const key = `${fromId}::${toId}`;
      const prev = map.get(key) ?? { error: 0, retry: 0, fallback: 0, maxLatency: 0, maxQueue: 0 };
      const queueDepth = Number(event.attributes?.queue_depth ?? 0);
      map.set(key, {
        error: prev.error + (event.status === "error" ? 1 : 0),
        retry: prev.retry + (event.retry_count > 0 ? 1 : 0),
        fallback: prev.fallback + (event.fallback_from ? 1 : 0),
        maxLatency: Math.max(prev.maxLatency, event.latency_ms),
        maxQueue: Math.max(prev.maxQueue, queueDepth),
      });
    }
    return map;
  }, [activeEvents, focusedEvents, representativeByNodeId]);

  const trunkEdgeSet = useMemo(() => {
    const entries = Array.from(edgeTraffic.entries()).sort((a, b) => b[1] - a[1]);
    const thresholdIndex = Math.min(entries.length - 1, Math.max(2, Math.floor(entries.length * 0.3)));
    const threshold = entries.length > 0 ? entries[thresholdIndex][1] : 0;
    const set = new Set<string>();
    for (const [key, count] of entries) {
      if (count >= threshold && count > 0) {
        set.add(key);
      }
    }
    return set;
  }, [edgeTraffic]);

  const activeDistrictIds = useMemo(() => {
    const set = new Set<string>();
    for (const nodeId of activeNodeIds) {
      const node = nodesById[nodeId];
      if (node) set.add(node.district_id);
    }
    return set;
  }, [activeNodeIds, nodesById]);

  const districtNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const district of effectiveTopology?.districts ?? []) {
      map[district.id] = district.name;
    }
    return map;
  }, [effectiveTopology?.districts]);

  const nodeActivity = useMemo(() => {
    const map: Record<
      string,
      { inbound: Map<string, number>; outbound: Map<string, number>; latest?: string }
    > = {};

    for (const node of layoutNodes) {
      map[node.id] = {
        inbound: new Map<string, number>(),
        outbound: new Map<string, number>(),
      };
    }

    for (const event of events) {
      const from = map[event.from_node];
      const to = event.to_node ? map[event.to_node] : undefined;

      if (from && event.to_node) {
        from.outbound.set(event.to_node, (from.outbound.get(event.to_node) ?? 0) + 1);
      }
      if (to) {
        to.inbound.set(event.from_node, (to.inbound.get(event.from_node) ?? 0) + 1);
      }

      if (from && (!from.latest || new Date(event.timestamp).getTime() > new Date(from.latest).getTime())) {
        from.latest = event.timestamp;
      }
      if (to && (!to.latest || new Date(event.timestamp).getTime() > new Date(to.latest).getTime())) {
        to.latest = event.timestamp;
      }
    }

    return map;
  }, [events, layoutNodes]);

  const sortedEdges = useMemo(() => {
    return edges.slice().sort((a, b) => {
      const priority = (edge: Edge) => {
        if (edge.kind === "invocation") return 3;
        if (edge.kind === "dataflow") return 2;
        if (edge.kind === "dependency") return 1;
        return 0;
      };
      return priority(a) - priority(b);
    });
  }, [edges]);

  const replayFollowTarget = useMemo(() => {
    if (!replay?.enabled || !selectedEvent) return undefined;
    const nodeId = selectedEvent.to_node
      ? representativeByNodeId[selectedEvent.to_node] ?? selectedEvent.to_node
      : representativeByNodeId[selectedEvent.from_node] ?? selectedEvent.from_node;
    const node = nodesById[nodeId];
    if (!node) return undefined;
    return { x: node.position.x, z: node.position.z };
  }, [nodesById, replay?.enabled, representativeByNodeId, selectedEvent]);

  const focusedPathPreview = useMemo(() => {
    if (!focusedEvents.length) return undefined;
    const chain = focusedEvents.slice(0, 5).map((event) => {
      const fromNode = nodesById[event.from_node];
      const from = fromNode ? nodeDisplayName(fromNode) : (event.from_node.split(".").at(-1) ?? event.from_node);
      const to = event.to_node
        ? (
            nodesById[event.to_node]
              ? nodeDisplayName(nodesById[event.to_node])
              : event.to_node.split(".").at(-1) ?? event.to_node
          )
        : "internal";
      return `${from} -> ${to}`;
    });
    return chain.join(" | ");
  }, [focusedEvents, nodesById]);

  const defaultViewTarget = useMemo(() => {
    const planningDistrict = effectiveTopology?.districts.find((district) => district.type === "planning");
    return {
      x: planningDistrict?.position.x ?? 0,
      z: planningDistrict?.position.z ?? 0,
    };
  }, [effectiveTopology?.districts]);

  const sceneTone = useMemo(() => {
    if (replay?.enabled) {
      return {
        background: "#02060b",
        fogNear: 90,
        fogFar: 220,
        ambient: 0.26,
        keyLight: 0.66,
        leftColor: "#365f96",
        rightColor: "#3f8f79",
      };
    }
    if (viewMode === "diagnostics" || diagnosticMode === "errors") {
      return {
        background: "#080b12",
        fogNear: 110,
        fogFar: 250,
        ambient: 0.28,
        keyLight: 0.72,
        leftColor: "#8a3949",
        rightColor: "#a85d55",
      };
    }
    if (viewMode === "live") {
      return {
        background: "#040a14",
        fogNear: 120,
        fogFar: 290,
        ambient: 0.36,
        keyLight: 0.9,
        leftColor: "#56acff",
        rightColor: "#45d57a",
      };
    }
    return {
      background: "#050a12",
      fogNear: 120,
      fogFar: 290,
      ambient: 0.34,
      keyLight: 0.88,
      leftColor: "#6ea8ff",
      rightColor: "#6bf0bb",
    };
  }, [diagnosticMode, replay?.enabled, viewMode]);

  const handleSnapshot = useCallback((snapshot: CameraViewSnapshot) => {
    setCameraView((prev) => {
      const moved =
        Math.abs(prev.x - snapshot.x) > 0.8 ||
        Math.abs(prev.z - snapshot.z) > 0.8 ||
        Math.abs(prev.distance - snapshot.distance) > 1.2;
      return moved ? snapshot : prev;
    });
  }, []);

  const modeHeadline =
    viewMode === "diagnostics"
      ? `${t("nav.diagnostics")} / ${diagnosticMode}`
      : viewMode === "live"
        ? t("nav.live")
        : replay?.enabled
          ? t("nav.replay")
          : t("nav.overview");

  const modeHint =
    viewMode === "diagnostics"
      ? t("city.modeHint.diagnostics")
      : viewMode === "live"
        ? t("city.modeHint.live")
        : replay?.enabled
          ? t("city.modeHint.replay")
          : t("city.modeHint.overview");
  const nodeDensityLabel =
    nodeDensity === "aggregate"
      ? t("city.nodeDensity.aggregate")
      : nodeDensity === "detail"
        ? t("city.nodeDensity.detail")
        : t("city.nodeDensity.balanced");

  return (
    <div data-testid="city-scene" className="city-shell h-full w-full">
      <div className="grid-lines" />
      <Canvas shadows camera={{ position: [0, 150, 130], fov: 42 }}>
        <color attach="background" args={[sceneTone.background]} />
        <fog attach="fog" args={[sceneTone.background, sceneTone.fogNear, sceneTone.fogFar]} />

        <ambientLight intensity={sceneTone.ambient} />
        <directionalLight position={[80, 120, 60]} intensity={sceneTone.keyLight} castShadow />
        <pointLight position={[-90, 50, -40]} intensity={0.52} color={sceneTone.leftColor} />
        <pointLight position={[88, 42, -58]} intensity={0.42} color={sceneTone.rightColor} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[360, 260]} />
          <meshStandardMaterial color="#071120" />
        </mesh>

        {effectiveTopology?.districts.map((district) => (
          <DistrictGround
            key={district.id}
            district={district}
            diagnosticMode={diagnosticMode}
            active={activeDistrictIds.has(district.id)}
            dimmed={Boolean(replay?.enabled && replay.traceId && !activeDistrictIds.has(district.id))}
            compactLabel={cameraView.distance > 148}
          />
        ))}

        {sortedEdges.map((edge) => {
          const fromId = representativeByNodeId[edge.from] ?? edge.from;
          const toId = representativeByNodeId[edge.to] ?? edge.to;
          const from = fromId === toId ? sourceNodesById[edge.from] ?? nodesById[fromId] : nodesById[fromId];
          const to = fromId === toId ? sourceNodesById[edge.to] ?? nodesById[toId] : nodesById[toId];
          if (!from || !to) return null;
          const pairKey = `${fromId}::${toId}`;
          const selectedFrom = selectedEvent ? representativeByNodeId[selectedEvent.from_node] ?? selectedEvent.from_node : undefined;
          const selectedTo = selectedEvent?.to_node
            ? representativeByNodeId[selectedEvent.to_node] ?? selectedEvent.to_node
            : undefined;
          const highlighted =
            selectedFrom === fromId && selectedTo === toId;
          const inFocusedPath = focusedEdgeSet.has(pairKey);
          const isTrunkEdge = trunkEdgeSet.has(pairKey) || edge.kind === "invocation";
          const stat = edgeEventStats.get(pairKey);
          const hasErrorSignal = (stat?.error ?? 0) > 0 || (stat?.retry ?? 0) > 0 || (stat?.fallback ?? 0) > 0;
          const hasSlowSignal = (stat?.maxLatency ?? 0) >= 700;
          const hasCongestionSignal = (stat?.maxQueue ?? 0) >= 5;
          const focusSignal =
            diagnosticFocus === "all"
              ? true
              : diagnosticFocus === "errors"
                ? hasErrorSignal
                : diagnosticFocus === "retry_fallback"
                  ? (stat?.retry ?? 0) > 0 || (stat?.fallback ?? 0) > 0
                  : diagnosticFocus === "slow"
                    ? hasSlowSignal
                    : hasCongestionSignal;
          const stageLayer: "primary" | "secondary" | "suppressed" =
            stageFocusActive
              ? stageFocusedNodeSet.has(edge.from) && stageFocusedNodeSet.has(edge.to)
                ? "primary"
                : stageFocusedNodeSet.has(edge.from) || stageFocusedNodeSet.has(edge.to)
                  ? "secondary"
                  : "suppressed"
              : "secondary";
          const renderLayer: "primary" | "secondary" | "suppressed" = stageFocusActive
            ? stageLayer
            : focusedTraceId
            ? inFocusedPath
              ? "primary"
              : "suppressed"
            : viewMode === "diagnostics"
              ? diagnosticFocus !== "all"
                ? focusSignal
                  ? "primary"
                  : "suppressed"
                : diagnosticMode === "errors"
                  ? hasErrorSignal
                    ? "primary"
                    : isTrunkEdge
                      ? "secondary"
                      : "suppressed"
                  : diagnosticMode === "heatmap"
                    ? hasSlowSignal || hasCongestionSignal
                      ? "primary"
                      : isTrunkEdge
                        ? "secondary"
                        : "suppressed"
                    : highlighted
                      ? "primary"
                      : isTrunkEdge
                        ? "secondary"
                        : "suppressed"
              : highlighted
                ? "primary"
                : isTrunkEdge
                  ? "secondary"
                        : "suppressed";

          const effectiveRenderLayer: "primary" | "secondary" | "suppressed" =
            edgeDensity === "full" && renderLayer === "suppressed"
              ? "secondary"
              : renderLayer;

          return (
            <EdgeRoad
              key={edge.id}
              edge={edge}
              fromNode={from}
              toNode={to}
              highlighted={highlighted || inFocusedPath}
              renderLayer={effectiveRenderLayer}
              diagnosticMode={diagnosticMode}
              dimmed={false}
            />
          );
        })}

        {layoutNodes.map((node) => {
          const activity = nodeActivity[node.id];
          const inboundTop = Array.from(activity?.inbound.entries() ?? [])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => nodesById[id]?.name ?? id);
          const outboundTop = Array.from(activity?.outbound.entries() ?? [])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => nodesById[id]?.name ?? id);

          return (
            <BuildingNode
              key={node.id}
              node={node}
              highlighted={selectedNodeId === node.id}
              pathHighlighted={
                focusedTraceId
                  ? activeNodeIds.has(node.id)
                  : stageFocusActive
                    ? stageFocusedNodeSet.has(node.id)
                    : false
              }
              active={activeNodeIds.has(node.id)}
              diagnosticMode={diagnosticMode}
              dimmed={
                focusedTraceId
                  ? Boolean(!activeNodeIds.has(node.id))
                  : stageFocusActive
                    ? Boolean(!stageFocusedNodeSet.has(node.id))
                    : false
              }
              activity={{
                districtName: districtNameById[node.district_id],
                lastActiveLabel: formatRelativeTime(activity?.latest),
                inboundTop,
                outboundTop,
              }}
              aggregateCount={aggregateCounts[node.id] ?? 1}
              onSelect={onSelectNode}
            />
          );
        })}

        <LiveFlows
          events={events}
          nodesById={nodesById}
          focusTraceId={focusedTraceId}
          selectedSpanId={selectedSpanId}
          diagnosticMode={diagnosticMode}
          replay={replay}
          onHoverEvent={onHoverEvent}
          onClickEvent={onSelectEvent}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          screenSpacePanning={false}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          touches={{
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
          }}
          minDistance={70}
          maxDistance={240}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4.6}
        />

        <CameraDirector
          controlsRef={controlsRef}
          navigationTarget={navigationTarget}
          replayFollowTarget={replay?.enabled ? replayFollowTarget : undefined}
          onSnapshot={handleSnapshot}
          onNavigationSettled={() => setNavigationTarget(undefined)}
        />
      </Canvas>

      <div className="pointer-events-none absolute right-3 top-3 z-10 w-[320px] rounded border border-line bg-[#081626dc] p-2 text-[11px] text-slate-200 shadow-glow">
        <div className="panel-title text-[11px] uppercase tracking-wide text-cyan-200">{modeHeadline}</div>
        <div className="mt-1 text-[10px] text-slate-400">{modeHint}</div>
        <div className="mt-1 text-[10px] text-slate-400">
          {t("metrics.activeFlows")}: {activeEvents.length} | {t("city.edges")}: {edges.length} | {t("filter.trace")}: {focusedTraceId ? focusedTraceId.slice(-8) : t("common.none")}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          {t("city.nodes")}: {layoutNodes.length} | {t("city.nodeDensity.current")}: {nodeDensityLabel}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          {t("city.adaptiveDistrictScale")}: {t("city.runtimeShort")} x{adaptiveTopology.meta.runtimeScale.toFixed(2)} | {t("city.toolsShort")} x{adaptiveTopology.meta.toolsScale.toFixed(2)}
        </div>
        {stageFocusActive ? (
          <div className="mt-1 text-[10px] text-emerald-200">
            {t("promptFlow.focused")}: {t(`promptFlow.stage.${promptStageFocus}` as MessageKey)}
          </div>
        ) : null}
        <div className="pointer-events-auto mt-2 flex items-center gap-1">
          {(["focus", "balanced", "full"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                edgeDensity === mode
                  ? "border-cyan-400 bg-[#16314d] text-slate-100"
                  : "border-line bg-[#0b1a2c] text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setEdgeDensity(mode)}
            >
              {mode === "focus" ? t("city.edgeDensity.focus") : mode === "balanced" ? t("city.edgeDensity.balanced") : t("city.edgeDensity.full")}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          {(["aggregate", "balanced", "detail"] as const).map((mode) => (
            <span
              key={mode}
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                nodeDensity === mode
                  ? "border-emerald-400 bg-[#143428] text-slate-100"
                  : "border-line bg-[#0b1a2c] text-slate-500"
              }`}
            >
              {mode === "aggregate"
                ? t("city.nodeDensity.aggregate")
                : mode === "balanced"
                  ? t("city.nodeDensity.balanced")
                  : t("city.nodeDensity.detail")}
            </span>
          ))}
          <span className="rounded border border-line bg-[#0b1a2c] px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
            {t("city.nodeDensity.auto")}
          </span>
          <button
            type="button"
            className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] uppercase text-slate-200 hover:border-sky-400"
            onClick={() => setNavigationTarget(defaultViewTarget)}
          >
            {t("city.resetView")}
          </button>
        </div>
        {focusedPathPreview ? (
          <div className="mt-2 rounded border border-line bg-[#0b1a2c] px-2 py-1 text-[10px] text-slate-300">{focusedPathPreview}</div>
        ) : null}
      </div>

      {focusedTraceId ? (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded border border-line bg-[#091323e3] px-2 py-1 text-[10px] text-slate-300 shadow-glow">
          <span className="panel-title uppercase tracking-wide text-sky-200">{t("city.focusTrace")}</span>
          <span>{focusedTraceId.slice(-10)}</span>
          <button
            type="button"
            className="pointer-events-auto rounded border border-line bg-[#0f2238] px-1.5 py-0.5 text-[10px] hover:border-sky-400"
            onClick={() => {
              setSelectedTrace(undefined);
              setSelectedSpan(undefined, undefined);
            }}
          >
            {t("city.clearFocus")}
          </button>
        </div>
      ) : null}

      <CityMiniMap
        topology={effectiveTopology}
        nodes={layoutNodes}
        events={activeEvents}
        replayTraceId={replay?.enabled ? replay.traceId : undefined}
        cameraView={cameraView}
        onNavigateDistrict={(district) => setNavigationTarget({ x: district.position.x, z: district.position.z })}
      />
    </div>
  );
}
