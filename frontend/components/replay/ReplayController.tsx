"use client";

import { useEffect } from "react";

import { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/hooks/useI18n";
import { shortId } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";
import { SpanKind, TraceRecord } from "@/types/schema";

interface ReplayControllerProps {
  trace?: TraceRecord;
}

function spanSubtitle(t: (key: MessageKey) => string, spanKind: SpanKind): string {
  const key = `replay.subtitle.${spanKind}` as MessageKey;
  return t(key);
}

const replaySpeeds = [0.5, 1, 1.5, 2, 4];

export function ReplayController({ trace }: ReplayControllerProps) {
  const { t } = useI18n();
  const replay = useDashboardStore((state) => state.replay);
  const setReplayCursor = useDashboardStore((state) => state.setReplayCursor);
  const setReplayPlaying = useDashboardStore((state) => state.setReplayPlaying);
  const setReplaySpeed = useDashboardStore((state) => state.setReplaySpeed);

  const spans = trace?.spans ?? [];
  const current = spans[Math.max(0, Math.min(replay.cursor - 1, spans.length - 1))];
  const progress = spans.length > 0 ? Math.min(100, Math.round((Math.min(replay.cursor, spans.length) / spans.length) * 100)) : 0;

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
        {t("replay.notFound")}
      </div>
    );
  }

  return (
    <section data-testid="replay-controller" className="border-b border-line bg-[#091323ee] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="badge">{t("replay.modeTitle")}</span>
        <span className="panel-title text-slate-100">{shortId(trace.envelope.trace_id)}</span>
        <span className="text-slate-500">{trace.envelope.user_input}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-slate-300">
        <span className="rounded border border-line bg-[#10233a] px-1.5 py-0.5">{t("replay.label.duration")} {trace.envelope.duration_ms}ms</span>
        <span className="rounded border border-line bg-[#10233a] px-1.5 py-0.5">{t("replay.label.tokens")} {trace.envelope.token_in}/{trace.envelope.token_out}</span>
        <span className="rounded border border-line bg-[#10233a] px-1.5 py-0.5">{t("replay.label.cost")} ${trace.envelope.estimated_cost.toFixed(5)}</span>
        <span className="rounded border border-line bg-[#10233a] px-1.5 py-0.5">{t("replay.label.status")} {trace.envelope.status}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => setReplayPlaying(!replay.playing)}
        >
          {replay.playing ? t("replay.pause") : t("replay.play")}
        </button>
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => {
            setReplayCursor(0);
            setReplayPlaying(false);
          }}
        >
          {t("replay.reset")}
        </button>
        <button
          className="rounded border border-line bg-[#0c1f33] px-2 py-1 text-xs text-slate-200 hover:bg-[#14304f]"
          onClick={() => {
            setReplayCursor(0);
            setReplayPlaying(true);
          }}
        >
          {t("replay.replay")}
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
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-[#0a1626]">
        <div className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-200" style={{ width: `${Math.max(4, progress)}%` }} />
      </div>

      {current && (
        <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-300 md:grid-cols-3">
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            {t("replay.statusFromTo")}: {current.from_node} -&gt; {current.to_node}
          </div>
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            {t("replay.statusKindProtocol")}: {current.span_kind} / {current.protocol}
          </div>
          <div className="rounded border border-line bg-[#0b1828] px-2 py-1">
            {t("replay.statusLatency")}: {current.status} / {current.latency_ms} ms
          </div>
          <div className="rounded border border-line bg-[#10233a] px-2 py-1 text-[11px] text-cyan-200 md:col-span-3">
            {spanSubtitle(t, current.span_kind)}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
        {spans.map((span, index) => {
          const active = replay.cursor - 1 === index;
          const done = replay.cursor - 1 > index;
          return (
            <button
              key={span.span_id}
              type="button"
              onClick={() => {
                setReplayCursor(index + 1);
                setReplayPlaying(false);
              }}
              className={`h-2 min-w-6 rounded transition-all ${
                active
                  ? "bg-cyan-300"
                  : done
                    ? "bg-sky-500/70"
                    : "bg-slate-700"
              }`}
              title={`${index + 1}. ${span.span_kind} ${span.latency_ms}ms`}
            />
          );
        })}
      </div>
    </section>
  );
}
