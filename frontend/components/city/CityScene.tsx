"use client";

import { useMemo } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { BuildingNode } from "@/components/city/BuildingNode";
import { CityMiniMap } from "@/components/city/CityMiniMap";
import { DistrictGround } from "@/components/city/DistrictGround";
import { EdgeRoad } from "@/components/city/EdgeRoad";
import { LiveFlows } from "@/components/city/LiveFlows";
import { DiagnosticMode } from "@/lib/visualTheme";
import { Edge, FlowEvent, Node, TopologyGraph } from "@/types/schema";

interface CitySceneProps {
  topology?: TopologyGraph;
  nodes: Node[];
  edges: Edge[];
  events: FlowEvent[];
  selectedNodeId?: string;
  selectedSpanId?: string;
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

  const activeNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const event of activeEvents) {
      set.add(event.from_node);
      if (event.to_node) set.add(event.to_node);
    }
    return set;
  }, [activeEvents]);

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

  return (
    <div data-testid="city-scene" className="city-shell h-full w-full">
      <div className="grid-lines" />
      <Canvas shadows camera={{ position: [0, 150, 130], fov: 42 }}>
        <color attach="background" args={["#050a12"]} />
        <fog attach="fog" args={["#050a12", 120, 290]} />

        <ambientLight intensity={0.34} />
        <directionalLight position={[80, 120, 60]} intensity={0.88} castShadow />
        <pointLight position={[-90, 50, -40]} intensity={0.52} color="#6ea8ff" />
        <pointLight position={[88, 42, -58]} intensity={0.42} color="#6bf0bb" />

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
          const highlighted =
            selectedEvent?.from_node === edge.from && selectedEvent?.to_node === edge.to;

          return (
            <EdgeRoad
              key={edge.id}
              edge={edge}
              fromNode={from}
              toNode={to}
              highlighted={highlighted}
              diagnosticMode={diagnosticMode}
              dimmed={
                Boolean(replay?.enabled && replay.traceId && selectedEvent && selectedEvent.trace_id !== replay.traceId)
              }
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
                  replay?.enabled &&
                    replay.traceId &&
                    !activeEvents.some((event) => event.from_node === node.id || event.to_node === node.id),
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
