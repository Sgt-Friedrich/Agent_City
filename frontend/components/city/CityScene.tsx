"use client";

import { useMemo } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { BuildingNode } from "@/components/city/BuildingNode";
import { CityMiniMap } from "@/components/city/CityMiniMap";
import { DistrictGround } from "@/components/city/DistrictGround";
import { EdgeRoad } from "@/components/city/EdgeRoad";
import { LiveFlows } from "@/components/city/LiveFlows";
import { DashboardMode, DiagnosticMode } from "@/lib/visualTheme";
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

function relativeTimeLabel(timestamp?: string): string {
  if (!timestamp) return "n/a";
  const delta = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(delta) || delta < 0) return "just now";
  if (delta < 4_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
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
  const nodesById = useMemo<Record<string, Node>>(() => {
    return nodes.reduce<Record<string, Node>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [nodes]);

  const activeEvents = useMemo(() => {
    if (!replay?.enabled || !replay.traceId) {
      return events;
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
    return activeEvents.filter((event) => event.trace_id === focusedTraceId);
  }, [activeEvents, focusedTraceId]);

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
    for (const event of events) {
      if (!event.to_node) continue;
      const key = `${event.from_node}::${event.to_node}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [events]);

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

    for (const node of nodes) {
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
  }, [events, nodes]);

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
          const renderLayer: "primary" | "secondary" | "suppressed" = focusedTraceId
            ? inFocusedPath
              ? "primary"
              : "suppressed"
            : highlighted
              ? "primary"
              : isTrunkEdge
                ? "secondary"
                : "suppressed";

          return (
            <EdgeRoad
              key={edge.id}
              edge={edge}
              fromNode={from}
              toNode={to}
              highlighted={highlighted}
              renderLayer={renderLayer}
              diagnosticMode={diagnosticMode}
              dimmed={renderLayer === "suppressed"}
            />
          );
        })}

        {nodes.map((node) => {
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
              active={activeNodeIds.has(node.id)}
              diagnosticMode={diagnosticMode}
              dimmed={
                Boolean(
                  focusedTraceId &&
                    !activeNodeIds.has(node.id),
                )
              }
              activity={{
                districtName: districtNameById[node.district_id],
                lastActiveLabel: relativeTimeLabel(activity?.latest),
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
          makeDefault
          enablePan={false}
          minDistance={70}
          maxDistance={240}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4.6}
        />
      </Canvas>

      <CityMiniMap
        topology={topology}
        nodes={nodes}
        events={activeEvents}
        replayTraceId={replay?.enabled ? replay.traceId : undefined}
      />
    </div>
  );
}
