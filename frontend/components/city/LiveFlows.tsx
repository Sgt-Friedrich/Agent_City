"use client";

import { useMemo, useRef } from "react";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { DiagnosticMode, flowStyle } from "@/lib/visualTheme";
import { FlowEvent, Node } from "@/types/schema";

interface LiveFlowsProps {
  events: FlowEvent[];
  nodesById: Record<string, Node>;
  replay?: {
    enabled: boolean;
    traceId?: string;
    cursor: number;
  };
  selectedSpanId?: string;
  diagnosticMode?: DiagnosticMode;
  onHoverEvent: (event?: FlowEvent) => void;
  onClickEvent: (event: FlowEvent) => void;
}

interface FlowTrackProps {
  event: FlowEvent;
  fromNode: Node;
  toNode: Node;
  highlighted: boolean;
  replayEnabled: boolean;
  diagnosticMode: DiagnosticMode;
  onHoverEvent: (event?: FlowEvent) => void;
  onClickEvent: (event: FlowEvent) => void;
}

function quadraticAt(
  t: number,
  start: THREE.Vector3,
  control: THREE.Vector3,
  end: THREE.Vector3,
): THREE.Vector3 {
  const inv = 1 - t;
  return new THREE.Vector3(
    inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
    inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
    inv * inv * start.z + 2 * inv * t * control.z + t * t * end.z,
  );
}

function sampleCurve(
  start: THREE.Vector3,
  control: THREE.Vector3,
  end: THREE.Vector3,
  points = 20,
): [number, number, number][] {
  const samples: [number, number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const p = quadraticAt(i / points, start, control, end);
    samples.push([p.x, p.y, p.z]);
  }
  return samples;
}

function MovingParticle({
  color,
  speed,
  phase,
  size,
  start,
  control,
  end,
  blink,
  event,
  onHoverEvent,
  onClickEvent,
}: {
  color: string;
  speed: number;
  phase: number;
  size: number;
  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;
  blink: boolean;
  event: FlowEvent;
  onHoverEvent: (event?: FlowEvent) => void;
  onClickEvent: (event: FlowEvent) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + phase) % 1;
    const point = quadraticAt(t, start, control, end);
    ref.current.position.set(point.x, point.y, point.z);
    const intensity = blink ? 0.85 + Math.sin(clock.getElapsedTime() * 8.6 + phase) * 0.28 : 0.58;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = intensity;
  });

  return (
    <mesh
      ref={ref}
      onPointerOver={() => onHoverEvent(event)}
      onPointerOut={() => onHoverEvent(undefined)}
      onClick={() => onClickEvent(event)}
    >
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.62} />
    </mesh>
  );
}

function FlowTrack({
  event,
  fromNode,
  toNode,
  highlighted,
  replayEnabled,
  diagnosticMode,
  onHoverEvent,
  onClickEvent,
}: FlowTrackProps) {
  const start = useMemo(
    () => new THREE.Vector3(fromNode.position.x, fromNode.height + 1.5, fromNode.position.z),
    [fromNode.height, fromNode.position.x, fromNode.position.z],
  );
  const end = useMemo(
    () => new THREE.Vector3(toNode.position.x, toNode.height + 1.5, toNode.position.z),
    [toNode.height, toNode.position.x, toNode.position.z],
  );

  const control = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5);
    const dir = end.clone().sub(start);
    const sideBase = event.retry_count > 0 ? 8.5 : event.fallback_from ? -7.2 : 0;
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(sideBase);
    const lift = event.status === "error" ? 8 : event.retry_count > 0 ? 6.4 : event.fallback_from ? 5.4 : 3.6;
    mid.add(perp);
    mid.y += lift;
    return mid;
  }, [end, event.fallback_from, event.retry_count, event.status, start]);

  const visual = useMemo(
    () => flowStyle(event, { replay: replayEnabled, active: highlighted, diagnosticMode }),
    [diagnosticMode, event, highlighted, replayEnabled],
  );
  const curvePoints = useMemo(() => sampleCurve(start, control, end, 26), [control, end, start]);

  const arrow = useMemo(() => {
    const anchor = quadraticAt(0.9, start, control, end);
    const tangent = quadraticAt(0.92, start, control, end).sub(anchor);
    const angle = Math.atan2(tangent.x, tangent.z);
    return { anchor, angle };
  }, [control, end, start]);

  return (
    <group>
      <Line
        points={curvePoints}
        color={visual.color}
        lineWidth={visual.lineWidth}
        transparent
        opacity={visual.trailOpacity}
        dashed={visual.dashed}
        dashScale={12}
        dashSize={0.95}
        gapSize={0.75}
      />
      <Line
        points={curvePoints}
        color={visual.color}
        lineWidth={visual.lineWidth + 0.9}
        transparent
        opacity={highlighted ? Math.min(0.95, visual.trailOpacity + 0.2) : visual.trailOpacity * 0.35}
      />

      <mesh position={arrow.anchor} rotation={[Math.PI / 2, 0, -arrow.angle]}>
        <coneGeometry args={[0.48, 1.45, 6]} />
        <meshStandardMaterial color={visual.color} emissive={visual.color} emissiveIntensity={0.24} transparent opacity={visual.trailOpacity} />
      </mesh>

      {Array.from({ length: visual.particleCount }).map((_, index) => (
        <MovingParticle
          key={`${event.span_id}-${index}`}
          color={visual.color}
          speed={visual.speed}
          phase={index / visual.particleCount + ((event.span_id.length + index) % 4) * 0.07}
          size={visual.particleSize}
          start={start}
          control={control}
          end={end}
          blink={visual.blink}
          event={event}
          onHoverEvent={onHoverEvent}
          onClickEvent={onClickEvent}
        />
      ))}
    </group>
  );
}

export function LiveFlows({
  events,
  nodesById,
  replay,
  selectedSpanId,
  diagnosticMode = "realtime",
  onHoverEvent,
  onClickEvent,
}: LiveFlowsProps) {
  const displayEvents = useMemo(() => {
    const candidate = replay?.enabled
      ? events
          .filter((event) => !replay.traceId || event.trace_id === replay.traceId)
          .slice(0, Math.max(replay.cursor, 1))
      : events.slice(0, 140);

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
          <FlowTrack
            key={event.span_id}
            event={event}
            fromNode={fromNode}
            toNode={toNode}
            highlighted={selectedSpanId === event.span_id}
            replayEnabled={Boolean(replay?.enabled)}
            diagnosticMode={diagnosticMode}
            onHoverEvent={onHoverEvent}
            onClickEvent={onClickEvent}
          />
        );
      })}
    </group>
  );
}
