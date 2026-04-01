"use client";

import { useMemo } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { DistrictGround } from "@/components/city/DistrictGround";
import { BuildingNode } from "@/components/city/BuildingNode";
import { EdgeRoad } from "@/components/city/EdgeRoad";
import { LiveFlows } from "@/components/city/LiveFlows";
import { Edge, FlowEvent, Node, TopologyGraph } from "@/types/schema";

interface CitySceneProps {
  topology?: TopologyGraph;
  nodes: Node[];
  edges: Edge[];
  events: FlowEvent[];
  selectedNodeId?: string;
  selectedSpanId?: string;
  replay?: {
    enabled: boolean;
    traceId?: string;
    cursor: number;
  };
  onSelectNode: (nodeId: string) => void;
  onSelectEvent: (event: FlowEvent) => void;
  onHoverEvent: (event?: FlowEvent) => void;
}

export function CityScene({
  topology,
  nodes,
  edges,
  events,
  selectedNodeId,
  selectedSpanId,
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

  const activeDistrictIds = useMemo(() => new Set(nodes.map((node) => node.district_id)), [nodes]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.span_id === selectedSpanId),
    [events, selectedSpanId],
  );

  return (
    <div className="city-shell h-full w-full">
      <div className="grid-lines" />
      <Canvas shadows camera={{ position: [0, 150, 130], fov: 42 }}>
        <color attach="background" args={["#050a12"]} />
        <fog attach="fog" args={["#050a12", 120, 280]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[80, 120, 60]} intensity={0.8} castShadow />
        <pointLight position={[-90, 50, -40]} intensity={0.5} color="#6ea8ff" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[360, 260]} />
          <meshStandardMaterial color="#071120" />
        </mesh>

        {topology?.districts.map((district) => (
          <DistrictGround
            key={district.id}
            district={district}
            dimmed={Boolean(replay?.enabled) && !activeDistrictIds.has(district.id)}
          />
        ))}

        {edges.map((edge) => {
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
              dimmed={Boolean(replay?.enabled && replay.traceId && selectedEvent && selectedEvent.trace_id !== replay.traceId)}
            />
          );
        })}

        {nodes.map((node) => (
          <BuildingNode
            key={node.id}
            node={node}
            highlighted={selectedNodeId === node.id}
            dimmed={Boolean(replay?.enabled && replay.traceId && !events.some((event) => event.trace_id === replay.traceId && (event.from_node === node.id || event.to_node === node.id)))}
            onSelect={onSelectNode}
          />
        ))}

        <LiveFlows
          events={events}
          nodesById={nodesById}
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
    </div>
  );
}
