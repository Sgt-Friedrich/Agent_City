"use client";

import { useEffect } from "react";

import { getDesktopAppStatus } from "@/lib/desktopBridge";
import { useDashboardStore } from "@/store/useDashboardStore";

export function useDesktopAppStatus(): void {
  const setDesktopStatus = useDashboardStore((state) => state.setDesktopStatus);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const status = await getDesktopAppStatus();
        if (!cancelled) {
          setDesktopStatus(status);
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
