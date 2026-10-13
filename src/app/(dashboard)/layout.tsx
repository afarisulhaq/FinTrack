"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "~/components/layout/sidebar";
import AuthGuard from "~/components/auth/auth-guard";
import { ToastContainer } from "~/components/ui/toast";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAuthStore } from "~/store/useAuthStore";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { applyBrand } from "~/lib/brand";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const token = useAuthStore((state) => state.token);
  const refreshAll = useFinanceStore((state) => state.refreshAll);
  const dataToken = useFinanceStore((state) => state.dataToken);
  const syncError = useFinanceStore((state) => state.syncError);
  // Read once at render — `useAppConfigStore` already persists the
  // config to localStorage, so a refresh preserves the footer text
  // without needing a server round-trip on every navigation.
  const footerText = useAppConfigStore((s) => s.config.footerText);
  const [isMobile, setIsMobile] = useState(false);
  const brandPrimary = useAppConfigStore((s) => s.config.primaryColor);
  const brandAccent = useAppConfigStore((s) => s.config.accentColor);

  useEffect(() => {
    applyBrand(brandPrimary, brandAccent);
  }, [brandPrimary, brandAccent]);

  const fetchData = useCallback(() => {
    if (!token || token === "dev-fallback-token") return;
    void refreshAll({ silent: true });
  }, [token, refreshAll]);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const retryFailedBootstrap = () => {
      if (useFinanceStore.getState().syncError) fetchData();
    };
    window.addEventListener("online", retryFailedBootstrap);
    return () => window.removeEventListener("online", retryFailedBootstrap);
  }, [fetchData]);

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
            {syncError && (
              <div
                role="status"
                className="border-border bg-bg-surface text-text-secondary mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <p className="flex-1">
                  {syncError} Data yang sudah dimuat tetap ditampilkan.
                </p>
                <button
                  type="button"
                  onClick={fetchData}
                  className="text-text-primary border-border focus-visible:ring-primary rounded-lg border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Coba sinkronkan
                </button>
              </div>
            )}
            {dataToken !== token && token && token !== "dev-fallback-token" ? (
              <div role="status" className="text-text-secondary p-6 text-sm">
                {syncError
                  ? "Data belum berhasil dimuat. Coba sinkronkan kembali."
                  : "Memuat data keuangan..."}
              </div>
            ) : (
              children
            )}
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
