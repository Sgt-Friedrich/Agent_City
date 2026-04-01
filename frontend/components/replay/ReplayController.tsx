"use client";

import { useEffect } from "react";

import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { TraceRecord } from "@/types/schema";

interface ReplayControllerProps {
  trace?: TraceRecord;
}

export function ReplayController({ trace }: ReplayControllerProps) {
  const replay = useDashboardStore((state) => state.replay);
  const setReplayCursor = useDashboardStore((state) => state.setReplayCursor);
  const setReplayPlaying = useDashboardStore((state) => state.setReplayPlaying);

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
    }, Math.max(120, Math.min(800, nextSpan.latency_ms / 2)));

    return () => window.clearTimeout(timeout);
  }, [replay.cursor, replay.playing, setReplayCursor, setReplayPlaying, trace]);

  if (!trace) {
    return (
      <div className="border-b border-line bg-[#091323ee] p-3 text-xs text-slate-400">
        Replay: trace not found.
      </div>
    );
  }

  return (
    <section className="border-b border-line bg-[#091323ee] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="badge">Replay</span>
        <span className="panel-title text-slate-100">{shortId(trace.envelope.trace_id)}</span>
        <span className="text-slate-500">{trace.envelope.user_input}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
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
        <input
          type="range"
          min={0}
          max={Math.max(spans.length, 1)}
          value={Math.min(replay.cursor, spans.length)}
          onChange={(event) => setReplayCursor(Number(event.target.value))}
          className="w-64"
        />
        <span className="text-xs text-slate-400">
          {Math.min(replay.cursor, spans.length)} / {spans.length}
        </span>
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
        </div>
      )}
    </section>
  );
}
