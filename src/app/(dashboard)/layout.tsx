"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar } from "~/components/layout/sidebar";
import AuthGuard from "~/components/auth/auth-guard";
import { ToastContainer } from "~/components/ui/toast";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAuthStore } from "~/store/useAuthStore";
import { useFinanceStore } from "~/store/useFinanceStore";
import { api } from "~/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { collapsed, mobileOpen, closeMobile } = useSidebarStore();
  const token = useAuthStore((state) => state.token);
  const hydrateFromBackend = useFinanceStore(
    (state) => state.hydrateFromBackend,
  );
  const refreshCategories = useFinanceStore((s) => s.refreshCategories);
  const [isMobile, setIsMobile] = useState(false);

  /** Reusable bootstrap fetcher */
  const fetchData = useCallback(() => {
    if (!token || token === "dev-fallback-token") return;
    api
      .bootstrap<Parameters<typeof hydrateFromBackend>[0]>(token)
      .then((data) => {
        hydrateFromBackend(data);
      })
      .catch((error) => console.warn("Backend bootstrap failed", error));
  }, [token, hydrateFromBackend]);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Initial data load. Refresh is event-driven after this (see the
  // pathname + visibility effects below) — no background polling.
  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;

    fetchData();
    // Categories live in their own table; make sure pickers across the
    // app (budget, transactions, …) have fresh data even if no master
    // CRUD has happened yet.
    void refreshCategories();
  }, [fetchData, token, refreshCategories]);

  // Refetch on every menu change. This is the primary sync mechanism:
  // the user just navigated somewhere, so they probably want fresh data
  // on that page. The store's `mergeById` will keep any in-flight
  // optimistic edits, so this won't clobber unsaved work.
  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;
    fetchData();
  }, [pathname, fetchData, token]);

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
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="min-h-screen"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </AuthGuard>
  );
}
