"use client";

import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useLocaleStore } from "@/store/useLocaleStore";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useControlPlaneData(): void {
  const setRepositories = useDashboardStore((state) => state.setRepositories);
  const setControlJobs = useDashboardStore((state) => state.setControlJobs);
  const setRuntimeStatus = useDashboardStore((state) => state.setRuntimeStatus);
  const setAppSettings = useDashboardStore((state) => state.setAppSettings);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const localeBootstrappedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const [repos, jobs, runtime, settings] = await Promise.all([
          api.getRepositories(),
          api.getJobs(),
          api.getRuntimeStatus(),
          api.getSettings(),
        ]);
        if (cancelled) return;
        setRepositories(repos.items);
        setControlJobs(jobs.items);
        setRuntimeStatus(runtime.runtime);
        setAppSettings(settings.settings);
        if (!localeBootstrappedRef.current) {
          if (settings.settings.language && settings.settings.language !== locale) {
            setLocale(settings.settings.language);
          }
          localeBootstrappedRef.current = true;
        }
      } catch {
        if (!cancelled) {
          setRuntimeStatus(undefined);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 2400);
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
  }, [locale, setAppSettings, setControlJobs, setLocale, setRepositories, setRuntimeStatus]);
}
