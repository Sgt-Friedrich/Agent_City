"use client";

import { useEffect } from "react";

import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { SpanKind, TraceRecord } from "@/types/schema";

interface ReplayControllerProps {
  trace?: TraceRecord;
}

const spanSubtitle: Record<SpanKind, string> = {
  AGENT: "planner is decomposing task",
  CHAIN: "orchestrator is chaining execution",
  LLM: "llm is generating",
  TOOL: "tool execution in progress",
  RETRIEVER: "retriever is searching",
  RERANKER: "reranker is ranking",
  EMBEDDING: "embedding context vectors",
  GUARDRAIL: "guardrail is checking output",
  EVALUATOR: "evaluator is scoring response",
  MEMORY: "memory is reading/writing state",
  MCP: "mcp bridge is resolving tools",
};

const replaySpeeds = [0.5, 1, 1.5, 2, 4];

export function ReplayController({ trace }: ReplayControllerProps) {
  const replay = useDashboardStore((state) => state.replay);
  const setReplayCursor = useDashboardStore((state) => state.setReplayCursor);
  const setReplayPlaying = useDashboardStore((state) => state.setReplayPlaying);
  const setReplaySpeed = useDashboardStore((state) => state.setReplaySpeed);

  const spans = trace?.spans ?? [];
  const current = spans[Math.max(0, Math.min(replay.cursor - 1, spans.length - 1))];

  useEffect(() => {
    if (!trace || !replay.playing) return;

    if (replay.cursor >= trace.spans.length) {
      setReplayPlaying(false);
      return;
    }

    const nextSpan = trace.spans[replay.cursor];
    const timeout = window.setTimeout(() => {
      setReplayCursor(replay.cursor + 1);
    }, Math.max(80, Math.min(900, nextSpan.latency_ms / (1.8 * replay.speed))));

    return () => window.clearTimeout(timeout);
  }, [replay.cursor, replay.playing, replay.speed, setReplayCursor, setReplayPlaying, trace]);

  if (!trace) {
    return (
      <div data-testid="replay-controller" className="border-b border-line bg-[#091323ee] p-3 text-xs text-slate-400">
        Replay: trace not found.
      </div>
    );
  }

  return (
    <section data-testid="replay-controller" className="border-b border-line bg-[#091323ee] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="badge">Replay</span>
        <span className="panel-title text-slate-100">{shortId(trace.envelope.trace_id)}</span>
        <span className="text-slate-500">{trace.envelope.user_input}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => setReplayPlaying(!replay.playing)}
        >
          {replay.playing ? "Pause" : "Play"}
        </button>
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => {
            setReplayCursor(0);
            setReplayPlaying(false);
          }}
        >
          Reset
        </button>
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => {
            setReplayCursor(0);
            setReplayPlaying(true);
          }}
        >
          Replay
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(spans.length, 1)}
          value={Math.min(replay.cursor, spans.length)}
          onChange={(event) => setReplayCursor(Number(event.target.value))}
          className="w-56"
        />
        <span className="text-xs text-slate-400">
          {Math.min(replay.cursor, spans.length)} / {spans.length}
        </span>

        <div className="ml-2 flex items-center gap-1">
          {replaySpeeds.map((speed) => (
            <button
              key={speed}
              type="button"
              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                replay.speed === speed
                  ? "border-cyan-400 bg-[#17344e] text-slate-100"
                  : "border-line bg-[#0b1828] text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setReplaySpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-300 md:grid-cols-3">
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            from -&gt; to: {current.from_node} -&gt; {current.to_node}
          </div>
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            kind/protocol: {current.span_kind} / {current.protocol}
          </div>
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            status/latency: {current.status} / {current.latency_ms} ms
          </div>
          <div className="rounded border border-line bg-[#10233a] px-2 py-1 text-[11px] text-cyan-200 md:col-span-3">
            {spanSubtitle[current.span_kind]}
          </div>
        </div>
      )}
    </section>
  );
}
