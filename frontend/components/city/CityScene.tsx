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

function applyNodeDeclutter(nodes: Node[], topology?: TopologyGraph): Node[] {
  if (!nodes.length) return nodes;
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

  for (const districtNodes of byDistrict.values()) {
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

      clusterNodes.forEach((node, index) => {
        if (index === 0) {
          node.position.x = center.x;
          node.position.z = center.z;
          return;
        }
        const radius = 2.8 + Math.sqrt(index) * 3.0;
        const angle = index * NODE_LAYOUT_GOLDEN_ANGLE;
        node.position.x = center.x + Math.cos(angle) * radius;
        node.position.z = center.z + Math.sin(angle) * radius;
      });
    }
  }

  return cloned.map((node) => clampToDistrict(node, districtsById));
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
      const desiredPos = target.clone().add(new THREE.Vector3(50, 95, 48));
      camera.position.lerp(desiredPos, 0.055);
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

  const diagnosticFocus = useDashboardStore((state) => state.diagnosticFocus);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);

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

  const layoutNodes = useMemo(() => applyNodeDeclutter(nodes, topology), [nodes, topology]);

  const nodesById = useMemo<Record<string, Node>>(() => {
    return layoutNodes.reduce<Record<string, Node>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [layoutNodes]);

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

  const focusedEvents = useMemo(() => {
    if (!focusedTraceId) return [];
    const sourceEvents = replay?.enabled ? activeEvents : events;
    return sourceEvents.filter((event) => event.trace_id === focusedTraceId);
  }, [activeEvents, events, focusedTraceId, replay?.enabled]);

  const focusedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (const event of focusedEvents) {
      if (event.to_node) {
        set.add(`${event.from_node}::${event.to_node}`);
      }
    }
    return set;
  }, [focusedEvents]);

  const activeNodeIds = useMemo(() => {
    const set = new Set<string>();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      set.add(event.from_node);
      if (event.to_node) set.add(event.to_node);
    }
    return set;
  }, [activeEvents, focusedEvents]);

  const edgeTraffic = useMemo(() => {
    const counts = new Map<string, number>();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      if (!event.to_node) continue;
      const key = `${event.from_node}::${event.to_node}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [activeEvents, focusedEvents]);

  const edgeEventStats = useMemo(() => {
    const map = new Map<
      string,
      { error: number; retry: number; fallback: number; maxLatency: number; maxQueue: number }
    >();
    const sourceEvents = focusedEvents.length > 0 ? focusedEvents : activeEvents;
    for (const event of sourceEvents) {
      if (!event.to_node) continue;
      const key = `${event.from_node}::${event.to_node}`;
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
  }, [activeEvents, focusedEvents]);

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
    for (const district of topology?.districts ?? []) {
      map[district.id] = district.name;
    }
    return map;
  }, [topology?.districts]);

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
    const nodeId = selectedEvent.to_node ?? selectedEvent.from_node;
    const node = nodesById[nodeId];
    if (!node) return undefined;
    return { x: node.position.x, z: node.position.z };
  }, [nodesById, replay?.enabled, selectedEvent]);

  const focusedPathPreview = useMemo(() => {
    if (!focusedEvents.length) return undefined;
    const chain = focusedEvents.slice(0, 5).map((event) => {
      const from = nodesById[event.from_node]?.name ?? event.from_node.split(".").at(-1) ?? event.from_node;
      const to = event.to_node
        ? nodesById[event.to_node]?.name ?? event.to_node.split(".").at(-1) ?? event.to_node
        : "internal";
      return `${from} -> ${to}`;
    });
    return chain.join(" | ");
  }, [focusedEvents, nodesById]);

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

        {topology?.districts.map((district) => (
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
          const from = nodesById[edge.from];
          const to = nodesById[edge.to];
          if (!from || !to) return null;
          const pairKey = `${edge.from}::${edge.to}`;
          const highlighted =
            selectedEvent?.from_node === edge.from && selectedEvent?.to_node === edge.to;
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
          const renderLayer: "primary" | "secondary" | "suppressed" = focusedTraceId
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

          if (edgeDensity === "focus" && renderLayer === "suppressed" && !highlighted && !inFocusedPath) {
            return null;
          }
          const effectiveRenderLayer: "primary" | "secondary" | "suppressed" =
            edgeDensity === "full" && renderLayer === "suppressed" ? "secondary" : renderLayer;

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
              pathHighlighted={focusedTraceId ? activeNodeIds.has(node.id) : false}
              active={activeNodeIds.has(node.id)}
              diagnosticMode={diagnosticMode}
              dimmed={Boolean(focusedTraceId && !activeNodeIds.has(node.id))}
              activity={{
                districtName: districtNameById[node.district_id],
                lastActiveLabel: formatRelativeTime(activity?.latest),
                inboundTop,
                outboundTop,
              }}
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
          enablePan={false}
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
        topology={topology}
        nodes={layoutNodes}
        events={activeEvents}
        replayTraceId={replay?.enabled ? replay.traceId : undefined}
        cameraView={cameraView}
        onNavigateDistrict={(district) => setNavigationTarget({ x: district.position.x, z: district.position.z })}
      />
    </div>
  );
}
