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
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "agent_city_locale",
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);

