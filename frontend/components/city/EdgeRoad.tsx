"use client";

import { useMemo } from "react";

import { Line } from "@react-three/drei";
import * as THREE from "three";

import { DiagnosticMode, edgeStyle } from "@/lib/visualTheme";
import { Edge, Node } from "@/types/schema";

interface EdgeRoadProps {
  edge: Edge;
  fromNode: Node;
  toNode: Node;
  dimmed?: boolean;
  highlighted?: boolean;
  renderLayer?: "primary" | "secondary" | "suppressed";
  diagnosticMode?: DiagnosticMode;
}

function edgeLaneOffset(edgeId: string): number {
  let hash = 0;
  for (let index = 0; index < edgeId.length; index += 1) {
    hash = (hash * 31 + edgeId.charCodeAt(index)) >>> 0;
  }
  return ((hash % 7) - 3) * 0.72;
}

export function EdgeRoad({
  edge,
  fromNode,
  toNode,
  dimmed,
  highlighted,
  renderLayer = "secondary",
  diagnosticMode = "realtime",
}: EdgeRoadProps) {
  const style = edgeStyle(edge, { highlighted, dimmed, diagnosticMode, renderLayer });

  const points = useMemo<[number, number, number][]>(() => {
    const start: [number, number, number] = [fromNode.position.x, 0.6, fromNode.position.z];
    const end: [number, number, number] = [toNode.position.x, 0.6, toNode.position.z];
    const dir = new THREE.Vector3(end[0] - start[0], 0, end[2] - start[2]);
    const length = Math.max(1, dir.length());
    const perp = length <= 1.01 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const lane = edgeLaneOffset(edge.id) * (renderLayer === "primary" ? 1.6 : 1);
    const lift = edge.kind === "invocation" ? 1.1 : edge.kind === "dependency" ? 0.35 : 0.7;
    const mid = new THREE.Vector3(
      (start[0] + end[0]) / 2,
      0.6 + lift,
      (start[2] + end[2]) / 2,
    ).add(perp.multiplyScalar(Math.min(12, length * 0.08) + lane));
    return [start, [mid.x, mid.y, mid.z], end];
  }, [edge.id, edge.kind, fromNode.position.x, fromNode.position.z, renderLayer, toNode.position.x, toNode.position.z]);
  const roadBasePoints = useMemo<[number, number, number][]>(() => {
    const start: [number, number, number] = [fromNode.position.x, 0.22, fromNode.position.z];
    const end: [number, number, number] = [toNode.position.x, 0.22, toNode.position.z];
    const mainMid = points[1];
    return [start, [mainMid[0], 0.24, mainMid[2]], end];
  }, [fromNode.position.x, fromNode.position.z, points, toNode.position.x, toNode.position.z]);

  const arrow = useMemo(() => {
    const start = new THREE.Vector3(fromNode.position.x, 0.8, fromNode.position.z);
    const end = new THREE.Vector3(toNode.position.x, 0.8, toNode.position.z);
    const position = start.clone().lerp(end, 0.64);
    const direction = end.clone().sub(start);
    direction.y = 0;
    const angle = Math.atan2(direction.x, direction.z);
    return { position, angle };
  }, [fromNode.position.x, fromNode.position.z, toNode.position.x, toNode.position.z]);

  return (
    <group>
      <Line
        points={roadBasePoints}
        color="#223345"
        lineWidth={renderLayer === "primary" ? style.width + 2.7 : style.width + 1.95}
        transparent
        opacity={renderLayer === "suppressed" ? 0.18 : 0.3}
        dashed={false}
      />
      <Line
        points={points}
        color={style.color}
        lineWidth={style.width}
        transparent
        opacity={style.opacity}
        dashed={style.dashed}
        dashScale={11}
        dashSize={1.1}
        gapSize={0.9}
      />
      <Line
        points={points}
        color={style.glowColor}
        lineWidth={style.width + 0.9}
        transparent
        opacity={style.glowOpacity}
        dashed={false}
      />
      {renderLayer !== "suppressed" ? (
        <mesh position={arrow.position} rotation={[Math.PI / 2, 0, -arrow.angle]} scale={[1, 1, 1]}>
          <coneGeometry args={[0.48, 1.4, 6]} />
          <meshStandardMaterial color={style.glowColor} emissive={style.glowColor} emissiveIntensity={0.18} transparent opacity={style.opacity} />
        </mesh>
      ) : null}
    </group>
  );
}
