"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "~/components/layout/sidebar";
import AuthGuard from "~/components/auth/auth-guard";
import { ToastContainer } from "~/components/ui/toast";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAuthStore } from "~/store/useAuthStore";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { applyBrand } from "~/lib/brand";
import { api } from "~/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const token = useAuthStore((state) => state.token);
  const hydrateFromBackend = useFinanceStore(
    (state) => state.hydrateFromBackend,
  );
  const refreshCategories = useFinanceStore((s) => s.refreshCategories);
  // Read once at render — `useAppConfigStore` already persists the
  // config to localStorage, so a refresh preserves the footer text
  // without needing a server round-trip on every navigation.
  const footerText = useAppConfigStore((s) => s.config.footerText);
  const [isMobile, setIsMobile] = useState(false);
  const brandPrimary = useAppConfigStore((s) => s.config.primaryColor);
  const brandAccent = useAppConfigStore((s) => s.config.accentColor);
  const syncing = useRef(false);

  useEffect(() => {
    applyBrand(brandPrimary, brandAccent);
  }, [brandPrimary, brandAccent]);

  /** Reusable bootstrap fetcher */
  const fetchData = useCallback(() => {
    if (!token || token === "dev-fallback-token") return;
    if (syncing.current) return;
    syncing.current = true;
    api
      .bootstrap<Parameters<typeof hydrateFromBackend>[0]>(token)
      .then((data) => {
        hydrateFromBackend(data);
      })
      .catch((error) => {
        console.warn("Backend bootstrap failed", error);
        useFinanceStore.setState({
          syncError: "Tidak bisa memuat data dari server. Silakan coba lagi.",
        });
      })
      .finally(() => {
        syncing.current = false;
      });
  }, [token, hydrateFromBackend]);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;

    fetchData();
    // Categories live in their own table; make sure pickers across the
    // app (budget, transactions, …) have fresh data even if no master
    // CRUD has happened yet.
    void refreshCategories();
  }, [fetchData, token, refreshCategories]);

  // Refetch when the tab regains focus (user switched back from another
  // tab/window/app). Catches the "I made a change on my phone, now I'm
  // back on the laptop" case without burning requests in the background.
  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchData, token]);

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <AuthGuard>
      <div className="bg-bg-base min-h-screen overflow-hidden">
        <Sidebar />
        {mobileOpen && isMobile && (
          <button
            aria-label="Tutup menu"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeMobile}
          />
        )}
        <main
          className="min-h-screen overflow-x-hidden overflow-y-auto transition-[margin-left] duration-300"
          style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        >
          <div className="min-h-screen">
            {children}
            {footerText && (
              <footer className="text-text-muted border-border/60 mt-10 border-t pt-4 pb-6 text-center text-[11px]">
                {footerText}
              </footer>
            )}
          </div>
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </AuthGuard>
  );
}
