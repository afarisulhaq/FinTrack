"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "~/lib/push-notifications";

/**
 * Registers the service worker once on mount.
 * Drop this component into any layout that should be PWA-enabled.
 */
export function SwRegister() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
