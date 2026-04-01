"use client";

import { Line } from "@react-three/drei";

import { Edge, Node } from "@/types/schema";

interface EdgeRoadProps {
  edge: Edge;
  fromNode: Node;
  toNode: Node;
  dimmed?: boolean;
  highlighted?: boolean;
}

export function EdgeRoad({ edge, fromNode, toNode, dimmed, highlighted }: EdgeRoadProps) {
  const color = highlighted ? "#90d3ff" : edge.status === "observed" ? "#7fb6dc" : "#446988";
  const opacity = dimmed ? 0.08 : highlighted ? 0.95 : 0.36;

  return (
    <Line
      points={[
        [fromNode.position.x, 0.6, fromNode.position.z],
        [toNode.position.x, 0.6, toNode.position.z],
      ]}
      color={color}
      lineWidth={highlighted ? 2.5 : 1.3}
      transparent
      opacity={opacity}
      dashed={edge.kind === "dependency"}
      dashScale={12}
      dashSize={1.1}
      gapSize={0.9}
    />
  );
}
