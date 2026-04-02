"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { shortId } from "@/lib/utils";
import { TargetPreview } from "@/types/schema";

interface RepositoryImportWizardProps {
  open: boolean;
  importing?: boolean;
  onClose: () => void;
  onImported: (targetId: string) => Promise<void> | void;
}

export function RepositoryImportWizard({
  open,
  importing = false,
  onClose,
  onImported,
}: RepositoryImportWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [repoPath, setRepoPath] = useState("");
  const [label, setLabel] = useState("");
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<TargetPreview>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [createdTargetId, setCreatedTargetId] = useState<string>();

  useEffect(() => {
    if (!open) {
      setStep(1);
      setPreview(undefined);
      setError(undefined);
      setSubmitting(false);
      setCreatedTargetId(undefined);
    }
  }, [open]);

  if (!open) return null;

  const busy = submitting || importing;

  const handlePreview = async () => {
    if (!repoPath.trim()) {
      setError(t("wizard.pathRequired"));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const payload = await api.previewTarget({
        repo_path: repoPath.trim(),
        label: label.trim() || undefined,
        target_id: targetId.trim() || undefined,
      });
      setPreview(payload.preview);
      if (!targetId.trim()) {
        setTargetId(payload.preview.suggested_target_id);
      }
      if (!label.trim()) {
        setLabel(payload.preview.suggested_label);
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wizard.previewFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!repoPath.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await api.registerTarget({
        repo_path: repoPath.trim(),
        label: label.trim() || undefined,
        target_id: targetId.trim() || undefined,
      });
      setCreatedTargetId(response.target.id);
      await onImported(response.target.id);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wizard.registerFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = [
    t("wizard.step.selectRepository"),
    t("wizard.step.detectStack"),
    t("wizard.step.previewTopology"),
    t("wizard.step.startParsing"),
    t("wizard.step.openCity"),
  ] as const;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#02060bcc] p-4 backdrop-blur-[2px]">
      <section className="glass-panel w-full max-w-3xl rounded-md p-4 text-xs text-slate-300 shadow-glow">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div>
            <div className="panel-title text-sm uppercase tracking-wide text-slate-100">
              {t("wizard.title")}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {t("wizard.subtitle")}
            </div>
          </div>
          <button
            type="button"
            className="rounded border border-line bg-[#0d2035] px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400 disabled:opacity-60"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          {stepLabels.map((labelText, index) => {
            const current = index + 1 === step;
            const complete = index + 1 < step;
            return (
              <div
                key={labelText}
                className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${
                  current
                    ? "border-sky-400 bg-[#163452] text-sky-100"
                    : complete
                      ? "border-emerald-500/50 bg-[#113125] text-emerald-200"
                      : "border-line bg-[#0b1728] text-slate-500"
                }`}
              >
                {labelText}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  {t("wizard.repositoryPath")}
                </span>
                <input
                  value={repoPath}
                  onChange={(event) => setRepoPath(event.target.value)}
                  placeholder={t("wizard.repositoryPathPlaceholder")}
                  className="w-full rounded border border-line bg-[#081424] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t("wizard.displayLabel")}
                  </span>
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={t("wizard.displayLabelPlaceholder")}
                    className="w-full rounded border border-line bg-[#081424] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t("wizard.targetId")}
                  </span>
                  <input
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    placeholder={t("wizard.targetIdPlaceholder")}
                    className="w-full rounded border border-line bg-[#081424] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePreview}
                disabled={busy}
                className="rounded border border-line bg-[#12324f] px-3 py-1.5 text-xs text-slate-100 hover:bg-[#19446a] disabled:opacity-60"
              >
                {busy ? t("wizard.analyzing") : t("wizard.analyzeRepository")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-line bg-[#0a1728] p-3">
              <div className="panel-title text-xs uppercase tracking-wide text-slate-200">
                {t("wizard.stackDetection")}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] text-slate-400">{t("wizard.languages")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preview.language_hints.map((item) => (
                      <span key={item} className="rounded border border-line bg-[#10243a] px-1.5 py-0.5">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{t("wizard.frameworkHints")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preview.framework_hints.map((item) => (
                      <span key={item} className="rounded border border-line bg-[#10243a] px-1.5 py-0.5">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded border border-line bg-[#12324f] px-3 py-1.5 text-xs text-slate-100 hover:bg-[#19446a]"
              >
                {t("common.continue")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-line bg-[#0a1728] p-3">
              <div className="panel-title text-xs uppercase tracking-wide text-slate-200">
                {t("wizard.topologyPreview")}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300 md:grid-cols-3">
                <div>{t("wizard.source")}: {preview.source_type}</div>
                <div>{t("wizard.grade")}: {preview.parser_grade}</div>
                <div>{t("wizard.confidence")}: {preview.parser_confidence.toFixed(3)}</div>
                <div>{t("wizard.nodes")}: {preview.node_count}</div>
                <div>{t("wizard.edges")}: {preview.edge_count}</div>
                <div>{t("wizard.unresolved")}: {preview.unresolved_count}</div>
              </div>
              {preview.warnings.length > 0 && (
                <div className="mt-3 space-y-1 rounded border border-amber-500/35 bg-[#302617] p-2 text-[11px] text-amber-200">
                  {preview.warnings.map((warning) => (
                    <div key={warning}>- {warning}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded border border-line bg-[#0e2135] px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded border border-line bg-[#12324f] px-3 py-1.5 text-xs text-slate-100 hover:bg-[#19446a]"
              >
                {t("common.continue")}
              </button>
            </div>
          </div>
        )}

        {step === 4 && preview && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-line bg-[#0a1728] p-3 text-[11px] text-slate-300">
              <div>{t("wizard.repo")}: {preview.repo_path}</div>
              <div className="mt-1">{t("wizard.targetId")}: {targetId || preview.suggested_target_id}</div>
              <div className="mt-1">{t("wizard.label")}: {label || preview.suggested_label}</div>
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded border border-line bg-[#0e2135] px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
                disabled={busy}
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={busy}
                className="rounded border border-line bg-[#15412d] px-3 py-1.5 text-xs text-emerald-100 hover:bg-[#1b5b40] disabled:opacity-60"
              >
                {busy ? t("wizard.parsing") : t("wizard.startParseAttach")}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-emerald-500/40 bg-[#10261f] p-3 text-xs text-emerald-100">
              {t("wizard.importCompleted")}: {createdTargetId ? shortId(createdTargetId) : t("common.ready")}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-line bg-[#0e2135] px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded border border-rose-500/40 bg-[#2b1418] px-2 py-1.5 text-[11px] text-rose-200">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
