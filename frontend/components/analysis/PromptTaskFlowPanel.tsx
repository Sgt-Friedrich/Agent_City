"use client";

import { useMemo } from "react";

import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { resolvePromptStageSnapshots } from "@/lib/promptFlow";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FlowEvent, Node } from "@/types/schema";

interface PromptTaskFlowPanelProps {
  nodes: Node[];
  events: FlowEvent[];
  onClose?: () => void;
}

export function PromptTaskFlowPanel({ nodes, events, onClose }: PromptTaskFlowPanelProps) {
  const { t } = useI18n();
  const focusedStage = useDashboardStore((state) => state.promptStageFocus);
  const setPromptStageFocus = useDashboardStore((state) => state.setPromptStageFocus);
  const setSelectedTrace = useDashboardStore((state) => state.setSelectedTrace);
  const setSelectedSpan = useDashboardStore((state) => state.setSelectedSpan);
  const setSelectedNode = useDashboardStore((state) => state.setSelectedNode);
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  const stageSnapshots = useMemo(
    () => resolvePromptStageSnapshots(nodes, events),
    [events, nodes],
  );

  const activeSnapshot = stageSnapshots.find((item) => item.id === focusedStage);

  const toggleStage = (stageId: (typeof stageSnapshots)[number]["id"], nodeIds: string[]) => {
    if (focusedStage === stageId) {
      setPromptStageFocus(undefined, []);
      return;
    }
    setSelectedTrace(undefined);
    setSelectedSpan(undefined, undefined);
    setSelectedNode(nodeIds[0]);
    setPromptStageFocus(stageId, nodeIds);
    setViewMode("overview");
  };

  return (
    <section
      className="pointer-events-auto rounded-xl border border-cyan-400/25 bg-[#061322b8] p-3 shadow-[0_16px_40px_rgba(1,10,25,0.65),0_0_28px_rgba(56,189,248,0.15)] backdrop-blur-xl"
      data-testid="prompt-task-flow-panel"
    >
      <div className="flex items-center justify-between">
        <div className="panel-title text-[11px] uppercase tracking-wide text-cyan-200">{t("promptFlow.title")}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:border-sky-400"
            onClick={() => setPromptStageFocus(undefined, [])}
          >
            {t("promptFlow.clear")}
          </button>
          {onClose ? (
            <button
              type="button"
              className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:border-sky-400"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-slate-400">{t("promptFlow.subtitle")}</div>

      <div className="mt-2 grid grid-cols-2 gap-1">
        {stageSnapshots.map((stage) => {
          const active = focusedStage === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              className={`rounded border px-2 py-1 text-left ${
                active
                  ? "border-cyan-400 bg-[#143250] text-slate-100"
                  : "border-line bg-[#0b1a2c] text-slate-300 hover:border-cyan-400"
              }`}
              onClick={() => toggleStage(stage.id, stage.nodeIds)}
            >
              <div className="text-[10px] uppercase tracking-wide">{t(stage.labelKey as MessageKey)}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{stage.nodeIds.length} {t("promptFlow.modules")}</div>
            </button>
          );
        })}
      </div>

      {activeSnapshot ? (
        <div className="mt-2 rounded border border-line bg-[#0b1a2c] p-2 text-[10px] text-slate-300">
          <div className="panel-title text-[10px] uppercase tracking-wide text-sky-200">
            {t(activeSnapshot.labelKey as MessageKey)}
          </div>
          <div className="mt-1 text-slate-400">{t(activeSnapshot.hintKey as MessageKey)}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {activeSnapshot.nodeNames.length ? (
              activeSnapshot.nodeNames.map((name) => (
                <span key={name} className="rounded border border-line bg-[#10243a] px-1.5 py-0.5 text-[10px] text-slate-200">
                  {name}
                </span>
              ))
            ) : (
            <span className="text-slate-500">{t("promptFlow.noNodes")}</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
