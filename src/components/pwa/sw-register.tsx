"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "~/lib/push-notifications";
import { useAppConfigStore, type AppConfig } from "~/store/useAppConfigStore";
import { applyBrand } from "~/lib/brand";
/**
 * Registers the service worker once on mount.
 * Drop this component into any layout that should be PWA-enabled.
 */
export function SwRegister() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  const config = useAppConfigStore((state) => state.config);
  const hydrateFromBackend = useAppConfigStore(
    (state) => state.hydrateFromBackend,
  );
  useEffect(() => {
    fetch("/api/app-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((res: { data?: Partial<AppConfig> } | null) => {
        if (res?.data) {
          hydrateFromBackend(res.data);
        }
      })
      .catch(() => {});
  }, [hydrateFromBackend]);

  useEffect(() => {
    applyBrand(config.primaryColor, config.accentColor);
  }, [config.primaryColor, config.accentColor]);
  return null;
}
