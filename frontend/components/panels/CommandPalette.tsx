"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";

interface CommandPaletteProps {
  onOpenImportWizard: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  keywords: string[];
  shortcut: string;
  run: () => void | Promise<void>;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function CommandPalette({ onOpenImportWizard }: CommandPaletteProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("");

  const target = useDashboardStore((state) => state.target);
  const setViewMode = useDashboardStore((state) => state.setViewMode);
  const setDiagnosticMode = useDashboardStore((state) => state.setDiagnosticMode);
  const setDiagnosticFocus = useDashboardStore((state) => state.setDiagnosticFocus);
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const upsertControlJob = useDashboardStore((state) => state.upsertControlJob);

  const commands = useMemo<CommandItem[]>(() => {
    return [
      {
        id: "overview",
        title: `${t("common.open")} ${t("nav.overview")}`,
        keywords: ["overview", "city", "topology"],
        shortcut: "Alt+1",
        run: () => setViewMode("overview"),
      },
      {
        id: "live",
        title: `${t("common.open")} ${t("nav.live")}`,
        keywords: ["live", "flows"],
        shortcut: "Alt+2",
        run: () => setViewMode("live"),
      },
      {
        id: "replay",
        title: `${t("common.open")} ${t("nav.replay")}`,
        keywords: ["replay", "trace"],
        shortcut: "Alt+3",
        run: () => setViewMode("replay"),
      },
      {
        id: "diagnostics",
        title: `${t("common.open")} ${t("nav.diagnostics")} (${t("filter.mode.errors")})`,
        keywords: ["diagnostics", "error", "hotspot"],
        shortcut: "Alt+4",
        run: () => {
          setViewMode("diagnostics");
          setDiagnosticMode("errors");
          setDiagnosticFocus("errors");
          setSearchQuery("status:error has:error");
        },
      },
      {
        id: "parser",
        title: `${t("common.open")} ${t("nav.parser")}`,
        keywords: ["parser", "analysis", "confidence"],
        shortcut: "Alt+5",
        run: () => setViewMode("parser_analysis"),
      },
      {
        id: "repositories",
        title: `${t("common.open")} ${t("nav.repositories")}`,
        keywords: ["repo", "repositories", "import"],
        shortcut: "Alt+6",
        run: () => setViewMode("repositories"),
      },
      {
        id: "jobs",
        title: `${t("common.open")} ${t("nav.jobs")}`,
        keywords: ["jobs", "task", "queue"],
        shortcut: "Alt+7",
        run: () => setViewMode("jobs"),
      },
      {
        id: "reports",
        title: `${t("common.open")} ${t("nav.reports")}`,
        keywords: ["report", "export"],
        shortcut: "Alt+8",
        run: () => setViewMode("reports"),
      },
      {
        id: "settings",
        title: `${t("common.open")} ${t("nav.settings")}`,
        keywords: ["settings", "language", "locale"],
        shortcut: "Alt+9",
        run: () => setViewMode("settings"),
      },
      {
        id: "import",
        title: t("header.addRepository"),
        keywords: ["import", "repository", "parse"],
        shortcut: "Ctrl+Shift+I",
        run: () => onOpenImportWizard(),
      },
      {
        id: "job-regression",
        title: t("control.runParserRegression"),
        keywords: ["parser", "regression", "test"],
        shortcut: "Ctrl+Shift+P",
        run: async () => {
          const response = await api.runJob({ type: "parser_regression", target, payload: {} });
          upsertControlJob(response.job);
          setMessage(`job queued: ${response.job.id}`);
        },
      },
      {
        id: "job-frontend-check",
        title: t("control.runFrontendCheck"),
        keywords: ["frontend", "self-check", "playwright"],
        shortcut: "Ctrl+Shift+F",
        run: async () => {
          const response = await api.runJob({ type: "frontend_self_check", target, payload: {} });
          upsertControlJob(response.job);
          setMessage(`job queued: ${response.job.id}`);
        },
      },
    ];
  }, [
    onOpenImportWizard,
    setDiagnosticFocus,
    setDiagnosticMode,
    setSearchQuery,
    setViewMode,
    target,
    t,
    upsertControlJob,
  ]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.shortcut.toLowerCase().includes(q) ||
        item.keywords.some((keyword) => keyword.includes(q)),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const metaOrCtrl = event.metaKey || event.ctrlKey;
      if (metaOrCtrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (!open && !isTypingTarget(event.target)) {
        if (event.altKey && /^([1-9])$/.test(event.key)) {
          event.preventDefault();
          const index = Number(event.key) - 1;
          const cmd = commands[index];
          if (cmd) void cmd.run();
          return;
        }
        if (metaOrCtrl && event.shiftKey && event.key.toLowerCase() === "i") {
          event.preventDefault();
          onOpenImportWizard();
        }
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((prev) => Math.min(prev + 1, Math.max(filteredCommands.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const cmd = filteredCommands[cursor];
        if (!cmd) return;
        Promise.resolve(cmd.run())
          .catch((error) => setMessage(error instanceof Error ? error.message : "command failed"))
          .finally(() => setOpen(false));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commands, cursor, filteredCommands, onOpenImportWizard, open]);

  useEffect(() => {
    setCursor(0);
  }, [query, open]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="command-palette-toggle"
        className="rounded border border-line bg-[#0f2035] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400"
        onClick={() => setOpen(true)}
        title="Open command palette (Ctrl+K)"
      >
        {t("command.open")}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#02060bb3]" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[12%] z-50 w-[min(720px,92vw)] -translate-x-1/2 rounded border border-line bg-[#081423] p-2 shadow-glow">
        <input
          data-testid="command-palette-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("command.placeholder")}
          autoFocus
          className="w-full rounded border border-line bg-[#0a1a2d] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
        />
        <div className="mt-2 max-h-[52vh] space-y-1 overflow-auto">
          {filteredCommands.map((cmd, index) => (
            <button
              key={cmd.id}
              type="button"
              className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-left ${
                index === cursor
                  ? "border-sky-400 bg-[#12314e] text-slate-100"
                  : "border-line bg-[#0b192b] text-slate-300 hover:border-slate-400"
              }`}
              onMouseEnter={() => setCursor(index)}
              onClick={() => {
                Promise.resolve(cmd.run())
                  .catch((error) => setMessage(error instanceof Error ? error.message : "command failed"))
                  .finally(() => setOpen(false));
              }}
            >
              <span className="text-sm">{cmd.title}</span>
              <span className="rounded border border-line bg-[#0d2238] px-1.5 py-0.5 text-[10px] text-slate-400">
                {cmd.shortcut}
              </span>
            </button>
          ))}
          {filteredCommands.length === 0 && (
            <div className="rounded border border-line bg-[#0b192b] px-2 py-2 text-xs text-slate-500">
              {t("command.empty")}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>{t("command.hint")}</span>
          {message ? <span className="text-emerald-300">{message}</span> : null}
        </div>
      </div>
    </>
  );
}
