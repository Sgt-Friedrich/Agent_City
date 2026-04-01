"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useBootstrapData(): { loading: boolean; error?: string } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const setTopology = useDashboardStore((state) => state.setTopology);
  const setTraces = useDashboardStore((state) => state.setTraces);
  const setMetrics = useDashboardStore((state) => state.setMetrics);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const [topology, traces, metrics] = await Promise.all([
          api.getTopology(),
          api.getTraces(),
          api.getMetricsSummary(),
        ]);

        if (cancelled) return;
        setTopology(topology);
        setTraces(traces.items);
        setMetrics(metrics);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "bootstrap failed";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [setMetrics, setTopology, setTraces]);

  return { loading, error };
}
