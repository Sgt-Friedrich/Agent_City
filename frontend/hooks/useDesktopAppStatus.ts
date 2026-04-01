"use client";

import { useEffect } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

export function useDesktopAppStatus(): void {
  const setDesktopStatus = useDashboardStore((state) => state.setDesktopStatus);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        if (window.agentCityDesktop?.getAppStatus) {
          const status = await window.agentCityDesktop.getAppStatus();
          if (!cancelled) {
            setDesktopStatus(status);
          }
        } else if (!cancelled) {
          setDesktopStatus({
            shellMode: "browser",
            backend: {
              url: "http://127.0.0.1:8000",
              ready: true,
              managed: false,
              pid: null,
              message: "browser_preview",
            },
            frontend: {
              url: "http://127.0.0.1:3000",
              ready: true,
              managed: false,
              pid: null,
              message: "browser_preview",
            },
            lastError: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled) {
          setDesktopStatus(undefined);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 2800);
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
  }, [setDesktopStatus]);
}
