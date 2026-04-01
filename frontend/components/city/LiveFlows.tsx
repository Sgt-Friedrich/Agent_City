"use client";

import { useMemo, useRef } from "react";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { spanKindColor } from "@/lib/colorMaps";
import { FlowEvent, Node } from "@/types/schema";

interface LiveFlowsProps {
  events: FlowEvent[];
  nodesById: Record<string, Node>;
  replay?: {
    enabled: boolean;
    traceId?: string;
    cursor: number;
  };
  onHoverEvent: (event?: FlowEvent) => void;
  onClickEvent: (event: FlowEvent) => void;
}

interface FlowParticleProps {
  event: FlowEvent;
  fromNode: Node;
  toNode: Node;
  onHoverEvent: (event?: FlowEvent) => void;
  onClickEvent: (event: FlowEvent) => void;
}

function FlowParticle({
  event,
  fromNode,
  toNode,
  onHoverEvent,
  onClickEvent,
}: FlowParticleProps) {
  const ref = useRef<THREE.Mesh>(null);

  const start = useMemo(
    () => new THREE.Vector3(fromNode.position.x, fromNode.height + 1.6, fromNode.position.z),
    [fromNode.height, fromNode.position.x, fromNode.position.z],
  );
  const end = useMemo(
    () => new THREE.Vector3(toNode.position.x, toNode.height + 1.6, toNode.position.z),
    [toNode.height, toNode.position.x, toNode.position.z],
  );

  // Higher latency means slower movement, making bottlenecks visible during replay.
  const speed = useMemo(() => {
    const normalized = Math.max(0.18, 1.8 - event.latency_ms / 1800);
    return normalized;
  }, [event.latency_ms]);

  const color = spanKindColor(event.span_kind, event.status);
  const offset = useMemo(() => (event.span_id.length % 7) * 0.09, [event.span_id]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    ref.current.position.lerpVectors(start, end, t);
  });

  return (
    <group>
      <Line
        points={[
          [start.x, start.y, start.z],
          [end.x, end.y, end.z],
        ]}
        color={color}
        lineWidth={event.status === "error" ? 2.5 : 1.5}
        transparent
        opacity={0.3}
      />
      <mesh
        ref={ref}
        onPointerOver={() => onHoverEvent(event)}
        onPointerOut={() => onHoverEvent(undefined)}
        onClick={() => onClickEvent(event)}
      >
        <sphereGeometry args={[0.46, 14, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
    </group>
  );
}

export function LiveFlows({ events, nodesById, replay, onHoverEvent, onClickEvent }: LiveFlowsProps) {
  const displayEvents = useMemo(() => {
    const candidate = replay?.enabled
      ? events
          .filter((event) => !replay.traceId || event.trace_id === replay.traceId)
          .slice(0, Math.max(replay.cursor, 1))
      : events.slice(0, 120);

    return candidate.filter(
      (event) => event.to_node && nodesById[event.from_node] && nodesById[event.to_node],
    );
  }, [events, nodesById, replay]);

  return (
    <group>
      {displayEvents.map((event) => {
        const fromNode = nodesById[event.from_node];
        const toNode = event.to_node ? nodesById[event.to_node] : undefined;
        if (!toNode) return null;

        return (
          <FlowParticle
            key={event.span_id}
            event={event}
            fromNode={fromNode}
            toNode={toNode}
            onHoverEvent={onHoverEvent}
            onClickEvent={onClickEvent}
          />
        );
      })}
    </group>
  );
}
