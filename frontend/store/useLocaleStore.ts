"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { LocaleCode } from "@/i18n/messages";

interface LocaleState {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale: locale === "zh" ? "zh" : "en" }),
    }),
    {
      name: "agent_city_locale",
      partialize: (state) => ({ locale: state.locale }),
      merge: (persisted, current) => {
        const candidate = (persisted as Partial<LocaleState> | undefined)?.locale;
        const locale: LocaleCode = candidate === "zh" ? "zh" : "en";
        return { ...current, locale };
      },
    },
  ),
);
