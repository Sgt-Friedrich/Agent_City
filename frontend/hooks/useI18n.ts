"use client";

import { useMemo } from "react";

import { localeOptions, MessageKey, messages } from "@/i18n/messages";
import { useLocaleStore } from "@/store/useLocaleStore";

export function useI18n() {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const dictionary = useMemo(() => messages[locale] ?? messages.en, [locale]);
  const fallback = messages.en;
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  const t = (key: MessageKey): string => dictionary[key] ?? fallback[key] ?? key;
  const formatDateTime = (value?: string | Date | null): string => {
    if (!value) return t("common.na");
    const parsed = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(parsed.getTime())) return t("common.na");
    return parsed.toLocaleString(localeTag);
  };
  const formatNumber = (value?: number | null, maximumFractionDigits = 2): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return t("common.na");
    return new Intl.NumberFormat(localeTag, { maximumFractionDigits }).format(value);
  };

  return {
    locale,
    setLocale,
    localeTag,
    t,
    formatDateTime,
    formatNumber,
    localeOptions,
  };
}
