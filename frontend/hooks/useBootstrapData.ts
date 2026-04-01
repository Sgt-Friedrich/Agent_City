"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useBootstrapData(): { loading: boolean; error?: string } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const target = useDashboardStore((state) => state.target);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setTargets = useDashboardStore((state) => state.setTargets);
  const setTopology = useDashboardStore((state) => state.setTopology);
  const setTraces = useDashboardStore((state) => state.setTraces);
  const setMetrics = useDashboardStore((state) => state.setMetrics);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const [targets, topology, traces, metrics] = await Promise.all([
          api.getTargets(),
          api.getTopology(target),
          api.getTraces(target),
          api.getMetricsSummary(target),
        ]);

        if (cancelled) return;
        const validTargetIds = new Set(targets.items.map((item) => item.id));
        if (targets.items.length > 0 && !validTargetIds.has(target)) {
          setTarget(targets.items[0].id);
          return;
        }
        setTargets(targets.items);
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
  }, [setMetrics, setTarget, setTargets, setTopology, setTraces, target]);

  return { loading, error };
}
