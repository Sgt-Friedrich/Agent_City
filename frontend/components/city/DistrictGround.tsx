"use client";

import { useState } from "react";

import { Html, Line } from "@react-three/drei";

import { DiagnosticMode, districtStyle } from "@/lib/visualTheme";
import { District } from "@/types/schema";

interface DistrictGroundProps {
  district: District;
  dimmed?: boolean;
  active?: boolean;
  diagnosticMode?: DiagnosticMode;
}

export function DistrictGround({
  district,
  dimmed,
  active,
  diagnosticMode = "realtime",
}: DistrictGroundProps) {
  const [hovered, setHovered] = useState(false);
  const style = districtStyle(district.type, {
    dimmed,
    hovered,
    active,
    diagnosticMode,
  });
  const halfW = district.bounds.width / 2;
  const halfD = district.bounds.depth / 2;
  const borderPoints: [number, number, number][] = [
    [-halfW, 0.02, -halfD],
    [halfW, 0.02, -halfD],
    [halfW, 0.02, halfD],
    [-halfW, 0.02, halfD],
    [-halfW, 0.02, -halfD],
  ];

  return (
    <group position={[district.position.x, 0, district.position.z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[district.bounds.width, district.bounds.depth]} />
        <meshStandardMaterial color={style.fill} transparent opacity={style.fillOpacity} />
      </mesh>

      <Line
        points={borderPoints}
        color={style.border}
        transparent
        opacity={style.borderOpacity}
        lineWidth={1.2}
      />

      <Html position={[0, 0.08, -district.bounds.depth / 2 + 2.4]} center>
        <div className="rounded-full border border-line bg-[#071525cc] px-3 py-1 text-[11px] font-medium tracking-wide text-slate-300">
          {district.name}
        </div>
      </Html>

      {hovered && (
        <Html position={[0, 0.08, district.bounds.depth / 2 - 3.2]} center>
          <div className="w-52 rounded border border-line bg-[#061425dd] p-2 text-[10px] text-slate-300 shadow-glow">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{district.name}</div>
            <div className="mt-1 text-slate-400">{district.summary}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
