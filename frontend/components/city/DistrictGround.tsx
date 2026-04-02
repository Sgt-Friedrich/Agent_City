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
  compactLabel?: boolean;
}

function motifLines(district: District): Array<Array<[number, number, number]>> {
  const halfW = district.bounds.width / 2;
  const halfD = district.bounds.depth / 2;
  if (district.type === "retrieval") {
    return [
      [
        [-halfW + 3, 0.03, -halfD + 3],
        [-halfW + 3, 0.03, halfD - 3],
      ],
      [
        [0, 0.03, -halfD + 3],
        [0, 0.03, halfD - 3],
      ],
      [
        [halfW - 3, 0.03, -halfD + 3],
        [halfW - 3, 0.03, halfD - 3],
      ],
    ];
  }
  if (district.type === "memory") {
    return [
      [
        [-halfW + 3, 0.03, -halfD + 3],
        [halfW - 3, 0.03, -halfD + 3],
      ],
      [
        [-halfW + 3, 0.03, 0],
        [halfW - 3, 0.03, 0],
      ],
      [
        [-halfW + 3, 0.03, halfD - 3],
        [halfW - 3, 0.03, halfD - 3],
      ],
    ];
  }
  if (district.type === "tools") {
    return [
      [
        [-halfW + 2.5, 0.03, -halfD + 2.5],
        [halfW - 2.5, 0.03, halfD - 2.5],
      ],
      [
        [halfW - 2.5, 0.03, -halfD + 2.5],
        [-halfW + 2.5, 0.03, halfD - 2.5],
      ],
    ];
  }
  if (district.type === "planning") {
    return [
      [
        [-halfW + 3, 0.03, 0],
        [halfW - 3, 0.03, 0],
      ],
      [
        [0, 0.03, -halfD + 3],
        [0, 0.03, halfD - 3],
      ],
    ];
  }
  if (district.type === "safety") {
    return [
      [
        [-halfW + 3, 0.03, -halfD + 3],
        [halfW - 3, 0.03, -halfD + 3],
      ],
      [
        [-halfW + 3, 0.03, halfD - 3],
        [halfW - 3, 0.03, halfD - 3],
      ],
    ];
  }
  return [];
}

export function DistrictGround({
  district,
  dimmed,
  active,
  diagnosticMode = "realtime",
  compactLabel = false,
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
  const motifs = motifLines(district);

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
        lineWidth={active ? 2.4 : 1.45}
      />
      <Line
        points={borderPoints}
        color={style.glow}
        transparent
        opacity={active ? 0.36 : 0.18}
        lineWidth={active ? 3.3 : 2.1}
      />
      {motifs.map((points, index) => (
        <Line
          key={`${district.id}-motif-${index}`}
          points={points}
          color={style.glow}
          transparent
          opacity={active ? 0.46 : 0.24}
          lineWidth={1}
        />
      ))}

      <Html position={[0, 0.08, -district.bounds.depth / 2 + 2.4]} center>
        <div className="rounded-full border border-line bg-[#071525cc] px-3 py-1 text-[11px] font-medium tracking-wide text-slate-300">
          {compactLabel ? district.name.replace(" District", "") : district.name}
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

      {[[-halfW + 2.3, -halfD + 2.3], [halfW - 2.3, -halfD + 2.3], [halfW - 2.3, halfD - 2.3], [-halfW + 2.3, halfD - 2.3]].map(
        ([x, z], index) => (
          <mesh key={`${district.id}-beacon-${index}`} position={[x, 0.45, z]}>
            <cylinderGeometry args={[0.22, 0.22, 0.9, 10]} />
            <meshStandardMaterial
              color={style.glow}
              emissive={style.glow}
              emissiveIntensity={active ? 0.52 : 0.22}
              transparent
              opacity={active ? 0.82 : 0.5}
            />
          </mesh>
        ),
      )}
    </group>
  );
}
