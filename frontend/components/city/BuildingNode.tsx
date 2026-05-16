"use client";

import { useMemo, useRef, useState } from "react";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { animationPresets, DiagnosticMode, nodeStyle } from "@/lib/visualTheme";
import { Node } from "@/types/schema";
import { NodeExplainabilityProfile } from "@/types/schema";

interface NodeActivitySummary {
  districtName?: string;
  lastActiveLabel?: string;
  inboundTop: string[];
  outboundTop: string[];
}

interface BuildingNodeProps {
  node: Node;
  highlighted?: boolean;
  pathHighlighted?: boolean;
  dimmed?: boolean;
  active?: boolean;
  activity?: NodeActivitySummary;
  diagnosticMode?: DiagnosticMode;
  aggregateCount?: number;
  onSelect: (nodeId: string) => void;
}

function BuildingBody({
  variant,
  size,
  height,
  color,
  opacity,
  emissive,
  emissiveIntensity,
  roughness,
  metalness,
}: {
  variant: "tower" | "datacenter" | "warehouse" | "industrial" | "checkpoint" | "hub";
  size: number;
  height: number;
  color: string;
  opacity: number;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}) {
  const materialProps = {
    color,
    transparent: true,
    opacity,
    emissive,
    emissiveIntensity,
    roughness,
    metalness,
  };

  if (variant === "tower") {
    return (
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[size * 0.42, size * 0.56, height, 10]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    );
  }

  if (variant === "datacenter") {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 1.15, height, size * 0.82]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[0, height * 0.64, -size * 0.28]} castShadow receiveShadow>
          <boxGeometry args={[size * 1.02, height * 0.18, size * 0.1]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (variant === "warehouse") {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 1.2, height, size * 0.95]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[0, height + 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 1.24, 0.2, size * 0.98]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (variant === "industrial") {
    return (
      <group>
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size, height, size]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[size * 0.22, height + 0.38, -size * 0.18]} castShadow receiveShadow>
          <cylinderGeometry args={[size * 0.1, size * 0.14, 0.8, 8]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (variant === "checkpoint") {
    const pillarH = Math.max(2.6, height * 0.74);
    return (
      <group>
        <mesh position={[-size * 0.23, pillarH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 0.34, pillarH, size * 0.34]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[size * 0.23, pillarH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 0.34, pillarH, size * 0.34]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[0, pillarH + 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[size * 1.02, 0.44, size * 0.42]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size * 1.02, height, size * 1.02]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh position={[0, height + 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[size * 0.74, 0.42, size * 0.74]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    </group>
  );
}

export function BuildingNode({
  node,
  highlighted,
  pathHighlighted,
  dimmed,
  active,
  activity,
  diagnosticMode = "realtime",
  aggregateCount = 1,
  onSelect,
}: BuildingNodeProps) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [labelMode, setLabelMode] = useState<"none" | "mini" | "full">("none");
  const { camera } = useThree();
  const statusRef = useRef<THREE.Mesh>(null);
  const focusRingRef = useRef<THREE.Mesh>(null);
  const visibilityTicker = useRef(0);
  const coreNode = useMemo(
    () => ["planner", "llm", "guardrail", "runtime", "event_bus"].includes(node.type),
    [node.type],
  );
  const explainability = useMemo(() => {
    const raw = node.metadata?.explainability;
    if (!raw || typeof raw !== "object") return {} as NodeExplainabilityProfile;
    return raw as NodeExplainabilityProfile;
  }, [node.metadata]);
  const displayName = explainability.display_name ?? (node.metadata?.display_name as string | undefined) ?? node.name;
  const technicalName = explainability.technical_name ?? node.name;
  const roleName = t(`nodeType.${node.type}` as MessageKey);
  const semanticLabel = aggregateCount > 1 ? `${roleName} ${t("city.node.cluster")}` : displayName;
  const responsibility = explainability.responsibility ?? (node.metadata?.summary as string | undefined) ?? "";
  const protocols = Array.isArray(explainability.protocols) ? explainability.protocols : [];

  const visual = useMemo(
    () => nodeStyle(node, { hovered, highlighted, dimmed, active, diagnosticMode }),
    [active, diagnosticMode, dimmed, highlighted, hovered, node],
  );

  useFrame((state, delta) => {
    if (statusRef.current) {
      const pulse = active
        ? 0.86 + Math.sin(state.clock.elapsedTime * animationPresets.buildingPulseHz) * 0.2
        : 0.72;
      statusRef.current.scale.setScalar(pulse);
    }
    if (focusRingRef.current) {
      const pulse = (highlighted || pathHighlighted)
        ? 1 + Math.sin(state.clock.elapsedTime * 5.2) * 0.06
        : 1;
      focusRingRef.current.scale.setScalar(pulse);
    }

    visibilityTicker.current += delta;
    if (visibilityTicker.current > 0.22) {
      visibilityTicker.current = 0;
      const dx = camera.position.x - node.position.x;
      const dz = camera.position.z - node.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const nextMode: "none" | "mini" | "full" =
        distance < 104
          ? "full"
          : distance < 152 || (coreNode && distance < 188)
            ? "mini"
            : "none";
      setLabelMode(nextMode);
    }
  });

  const cardVisible = hovered || highlighted;
  const iconY = Math.max(2.2, node.height + 1.6);

  return (
    <group position={[node.position.x, 0, node.position.z]}>
      <mesh
        position={[0, node.height / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onSelect(node.id)}
      >
        <boxGeometry args={[Math.max(node.size * 1.3, 3.4), Math.max(node.height, 5.5), Math.max(node.size * 1.3, 3.4)]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <group>
        <BuildingBody
          variant={visual.variant}
          size={node.size}
          height={node.height}
          color={visual.color}
          opacity={visual.opacity}
          emissive={visual.emissive}
          emissiveIntensity={visual.emissiveIntensity}
          roughness={visual.roughness}
          metalness={visual.metalness}
        />
      </group>

      <mesh position={[0, iconY, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.18, 16]} />
        <meshStandardMaterial color="#0a1827" metalness={0.4} roughness={0.42} />
      </mesh>

      <mesh ref={statusRef} position={[0, iconY + 0.4, 0]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial
          color={visual.statusLight}
          emissive={visual.statusLight}
          emissiveIntensity={active ? 1.05 : 0.48}
        />
      </mesh>

      {(highlighted || pathHighlighted) ? (
        <mesh ref={focusRingRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(node.size * 0.66, 2.2), Math.max(node.size * 0.9, 2.9), 28]} />
          <meshStandardMaterial
            color={highlighted ? "#7dd7ff" : "#5ec0ff"}
            emissive={highlighted ? "#7dd7ff" : "#5ec0ff"}
            emissiveIntensity={highlighted ? 0.74 : 0.44}
            transparent
            opacity={highlighted ? 0.8 : 0.45}
          />
        </mesh>
      ) : null}

      {(labelMode !== "none" || hovered || highlighted) && (
        <Html position={[0, iconY + 1.05, 0]} center zIndexRange={[2, 0]} wrapperClass="city-html-overlay">
          <div className="min-w-[74px] rounded-lg border border-line bg-[#071629df] px-2 py-1 text-[10px] text-slate-200 shadow-glow">
            <div className="flex items-center justify-center gap-1">
              <span className="panel-title max-w-[132px] truncate text-[10px] uppercase tracking-wide text-slate-200">
                {labelMode === "mini" && !hovered && !highlighted ? roleName : semanticLabel}
              </span>
              <span className="rounded border border-line/80 bg-[#0d2238] px-1 text-[9px] uppercase text-slate-500">
                {visual.glyph}
              </span>
            </div>
            {aggregateCount > 1 ? (
              <div className="mt-0.5 text-center text-[10px] text-emerald-200">
                {aggregateCount} {t("city.node.modules")}
              </div>
            ) : null}
            {(labelMode === "full" || hovered || highlighted) && aggregateCount <= 1 ? (
              <div className="mt-0.5 max-w-[152px] truncate text-center text-[10px] text-slate-400">{roleName}</div>
            ) : null}
          </div>
        </Html>
      )}

      {cardVisible && (
        <Html position={[0, node.height + 2.4, 0]} center zIndexRange={[3, 0]} wrapperClass="city-html-overlay">
          <div className="w-56 rounded border border-line bg-[#051222ee] p-2 text-xs text-slate-200 shadow-glow">
            <div className="panel-title text-[11px] uppercase tracking-wide text-slate-200">{semanticLabel}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {roleName} | {activity?.districtName ?? node.district_id}
            </div>
            <div className="mt-1 truncate text-[10px] text-slate-500">
              {t("city.node.technicalName")}: {technicalName}
            </div>
            {responsibility ? (
              <div className="mt-1 line-clamp-2 text-[10px] text-slate-300">{responsibility}</div>
            ) : null}
            {protocols.length > 0 ? (
              <div className="mt-1 text-[10px] text-cyan-200">{protocols.slice(0, 3).join(" | ")}</div>
            ) : null}
            {aggregateCount > 1 ? (
              <div className="text-[10px] text-emerald-200">{t("city.node.clusterSize")}: {aggregateCount}</div>
            ) : null}
            <div className="mt-1 text-[10px] text-slate-400">{t("city.node.status")}: {node.status}</div>
            <div className="text-[10px] text-slate-400">
              {t("city.node.qpsP95Error")}: {(node.metrics?.qps ?? 0).toFixed(1)} / {(node.metrics?.p95_ms ?? 0).toFixed(0)}ms / {((node.metrics?.error_rate ?? 0) * 100).toFixed(2)}%
            </div>
            <div className="text-[10px] text-slate-400">{t("city.node.lastActive")}: {activity?.lastActiveLabel ?? t("city.node.noRecentFlow")}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {t("city.node.in")}: {(activity?.inboundTop.length ? activity.inboundTop.join(", ") : t("common.na"))}
            </div>
            <div className="text-[10px] text-slate-400">
              {t("city.node.out")}: {(activity?.outboundTop.length ? activity.outboundTop.join(", ") : t("common.na"))}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
