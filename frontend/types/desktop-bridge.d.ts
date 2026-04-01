import { DesktopAppStatus } from "@/types/schema";

declare global {
  interface Window {
    agentCityDesktop?: {
      getAppStatus: () => Promise<DesktopAppStatus>;
      openPath: (targetPath: string) => Promise<{ ok: boolean; message: string }>;
      openReportsDirectory: () => Promise<{ ok: boolean; path?: string; message?: string }>;
      saveTextReport: (payload: {
        defaultFileName?: string;
        content: string;
      }) => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
    };
  }
}

export {};
