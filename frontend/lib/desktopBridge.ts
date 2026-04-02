"use client";

import { DesktopAppStatus } from "@/types/schema";

type OpenPathResult = {
  ok: boolean;
  message: string;
};

type OpenReportsDirectoryResult = {
  ok: boolean;
  path?: string;
  message?: string;
};

type SaveTextReportResult = {
  ok: boolean;
  canceled?: boolean;
  path?: string;
};

type DesktopBridgeElectron = {
  getAppStatus: () => Promise<DesktopAppStatus>;
  openPath: (targetPath: string) => Promise<OpenPathResult>;
  openReportsDirectory: () => Promise<OpenReportsDirectoryResult>;
  saveTextReport: (payload: {
    defaultFileName?: string;
    content: string;
  }) => Promise<SaveTextReportResult>;
};

type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

function getElectronBridge(): DesktopBridgeElectron | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.agentCityDesktop;
}

let invokePromise: Promise<TauriInvoke | undefined> | undefined;

async function getTauriInvoke(): Promise<TauriInvoke | undefined> {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (!invokePromise) {
    invokePromise = import("@tauri-apps/api/tauri")
      .then((module) => module.invoke as TauriInvoke)
      .catch(() => undefined);
  }

  return invokePromise;
}

export function browserPreviewStatus(): DesktopAppStatus {
  return {
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
  };
}

export async function getDesktopAppStatus(): Promise<DesktopAppStatus> {
  const electronBridge = getElectronBridge();
  if (electronBridge?.getAppStatus) {
    return electronBridge.getAppStatus();
  }

  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<DesktopAppStatus>("get_app_status");
    } catch {
      return browserPreviewStatus();
    }
  }

  return browserPreviewStatus();
}

export async function openReportsDirectory(): Promise<OpenReportsDirectoryResult> {
  const electronBridge = getElectronBridge();
  if (electronBridge?.openReportsDirectory) {
    return electronBridge.openReportsDirectory();
  }

  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<OpenReportsDirectoryResult>("open_reports_directory");
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to open docs directory";
      return { ok: false, message };
    }
  }

  return { ok: false, message: "desktop shell not attached" };
}

export async function saveDesktopTextReport(payload: {
  defaultFileName?: string;
  content: string;
}): Promise<SaveTextReportResult> {
  const electronBridge = getElectronBridge();
  if (electronBridge?.saveTextReport) {
    return electronBridge.saveTextReport(payload);
  }

  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<SaveTextReportResult>("save_text_report", { payload });
    } catch {
      return { ok: false, canceled: false };
    }
  }

  return { ok: false, canceled: false };
}

export async function openDesktopPath(targetPath: string): Promise<OpenPathResult> {
  const electronBridge = getElectronBridge();
  if (electronBridge?.openPath) {
    return electronBridge.openPath(targetPath);
  }

  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<OpenPathResult>("open_path", { targetPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to open path";
      return { ok: false, message };
    }
  }

  return { ok: false, message: "desktop shell not attached" };
}
