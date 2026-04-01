"use client";

import { Html } from "@react-three/drei";

import { District } from "@/types/schema";

interface DistrictGroundProps {
  district: District;
  dimmed?: boolean;
}

const districtTint: Record<string, string> = {
  planning: "#24486b",
  retrieval: "#1f5a4a",
  memory: "#6a5a22",
  tools: "#53306e",
  llm: "#2f4f82",
  safety: "#7b3a30",
  runtime: "#32485e",
  boundary: "#4e4f52",
};

export function DistrictGround({ district, dimmed }: DistrictGroundProps) {
  const color = districtTint[district.type] ?? "#2d3a4a";
  const opacity = dimmed ? 0.1 : 0.28;

  return (
    <group position={[district.position.x, 0, district.position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[district.bounds.width, district.bounds.depth]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <Html position={[0, 0.08, -district.bounds.depth / 2 + 2.4]} center>
        <div className="rounded-full border border-line bg-[#071525cc] px-3 py-1 text-[11px] font-medium tracking-wide text-slate-300">
          {district.name}
        </div>
      </Html>
    </group>
  );
}
