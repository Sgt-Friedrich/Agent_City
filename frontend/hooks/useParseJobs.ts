"use client";

import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useParseJobs(): void {
  const target = useDashboardStore((state) => state.target);
  const setTarget = useDashboardStore((state) => state.setTarget);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setParseJobs = useDashboardStore((state) => state.setParseJobs);
  const setIngestDirectory = useDashboardStore((state) => state.setIngestDirectory);

  const seenCompletedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const payload = await api.getParseJobs();
        if (stopped) return;

        setParseJobs(payload.items);
        setIngestDirectory(payload.drop_directory);

        const latestCompleted = payload.items.find(
          (job) =>
            job.status === "completed" &&
            job.target_id &&
            !seenCompletedRef.current.has(job.id),
        );

        if (latestCompleted?.target_id) {
          seenCompletedRef.current.add(latestCompleted.id);
          if (latestCompleted.target_id !== target) {
            setTarget(latestCompleted.target_id);
            setViewMode("overview");
          }
        }
      } catch {
        // Keep polling resilient during backend startup and temporary failures.
      } finally {
        if (!stopped) {
          timer = window.setTimeout(poll, 1500);
        }
      }
    }

    poll();

    return () => {
      stopped = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [setIngestDirectory, setParseJobs, setTarget, setViewMode, target]);
}
