"use client";

import { useMemo, useState } from "react";

import { Html } from "@react-three/drei";

import { statusColor } from "@/lib/colorMaps";
import { Node } from "@/types/schema";

interface BuildingNodeProps {
  node: Node;
  highlighted?: boolean;
  dimmed?: boolean;
  onSelect: (nodeId: string) => void;
}

export function BuildingNode({ node, highlighted, dimmed, onSelect }: BuildingNodeProps) {
  const [hovered, setHovered] = useState(false);
  const color = useMemo(() => statusColor(node.status), [node.status]);

  const opacity = dimmed ? 0.16 : highlighted || hovered ? 1 : 0.86;
  const emissiveIntensity = highlighted || hovered ? 0.45 : 0.15;

  return (
    <group position={[node.position.x, 0, node.position.z]}>
      <mesh
        position={[0, node.height / 2, 0]}
        castShadow
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onSelect(node.id)}
      >
        <boxGeometry args={[node.size, node.height, node.size]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.38}
          metalness={0.25}
        />
      </mesh>

      {(hovered || highlighted) && (
        <Html position={[0, node.height + 2.2, 0]} center>
          <div className="w-44 rounded-md border border-line bg-[#050f1ce6] p-2 text-xs text-slate-200 shadow-glow">
            <div className="panel-title text-[11px] text-slate-300">{node.name}</div>
            <div className="mt-1 text-[10px] text-slate-400">{node.type}</div>
            <div className="mt-1 text-[10px] text-slate-400">{node.status}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
