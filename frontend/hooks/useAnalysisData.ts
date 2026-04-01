"use client";

import { useEffect } from "react";

import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useAnalysisData(): void {
  const target = useDashboardStore((state) => state.target);
  const setDiagnosticsSummary = useDashboardStore((state) => state.setDiagnosticsSummary);
  const setParserAnalysis = useDashboardStore((state) => state.setParserAnalysis);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const [diagnostics, parserAnalysis] = await Promise.all([
          api.getDiagnosticsSummary(target),
          api.getParserAnalysis(target),
        ]);
        if (cancelled) return;
        setDiagnosticsSummary(diagnostics);
        setParserAnalysis(parserAnalysis);
      } catch {
        if (!cancelled) {
          setDiagnosticsSummary(undefined);
          setParserAnalysis(undefined);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 2200);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [setDiagnosticsSummary, setParserAnalysis, target]);
}
