"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AppConfig {
  appName: string;
  tagline: string;
  logoType: "icon" | "text" | "image";
  logoIcon: string;
  logoImageUrl: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  dateFormat: string;
  faviconUrl: string;
  footerText: string;
  qrisStatic?: string;
}

interface AppConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  hydrateFromBackend: (backendConfig: Partial<AppConfig>) => void;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  appName: "FinTrack",
  tagline: "Kelola keuangan pribadimu",
  logoType: "icon",
  logoIcon: "TrendingUp",
  logoImageUrl: "",
  primaryColor: "#6366f1",
  accentColor: "#8b5cf6",
  currency: "IDR",
  dateFormat: "dd/MM/yyyy",
  faviconUrl: "",
  footerText: "© 2026 FinTrack",
  qrisStatic: "",
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useAppConfigStore = create<AppConfigStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,

      updateConfig: (updates) =>
        set((state) => ({ config: { ...state.config, ...updates } })),

      resetConfig: () => set({ config: DEFAULT_CONFIG }),

      hydrateFromBackend: (backendConfig) =>
        set((state) => {
          // Only overwrite local fields with backend values that are
          // actually present (not undefined / null / empty string).
          // Without this guard, a missing qrisStatic on the server
          // (e.g. the user set it in a previous session but it never
          // reached the DB) would be wiped from local state every
          // time the app boots, and the public pay page would have
          // nothing to render.
          const merged = { ...state.config };
          for (const [k, v] of Object.entries(backendConfig)) {
            if (v !== undefined && v !== null && v !== "") {
              merged[k as keyof typeof merged] = v as never;
            }
          }
          return { config: merged };
        }),
    }),
    {
      name: "fintrack_app_config",
      storage: createJSONStorage(() => localStorage),
      // Only persist the config slice
      partialize: (state) => ({ config: state.config }),
    },
  ),
);
