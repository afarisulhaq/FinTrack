"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "~/lib/utils";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** Auto-dismiss timeout in ms. 0 = sticky (user must close). */
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) => {
    const id =
      toast.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: Toast = {
      duration: 4000,
      ...toast,
      id,
    };
    set((state) => {
      // Cap to last 5 to avoid flooding the UI when offline actions pile up.
      const without = state.toasts.filter((t) => t.id !== id);
      return { toasts: [...without, next].slice(-5) };
    });
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Convenience helpers so call sites read like English:
 *   toast.success("Dompet dihapus");
 *   toast.error("Gagal menyimpan", err.message);
 */
export const toast = {
  success(title: string, description?: string) {
    return useToastStore
      .getState()
      .show({ kind: "success", title, description });
  },
  error(title: string, description?: string) {
    return useToastStore
      .getState()
      .show({ kind: "error", title, description, duration: 6000 });
  },
  warning(title: string, description?: string) {
    return useToastStore
      .getState()
      .show({ kind: "warning", title, description });
  },
  info(title: string, description?: string) {
    return useToastStore.getState().show({ kind: "info", title, description });
  },
};

// ─── UI component ─────────────────────────────────────────────────────────────

const KIND_STYLES: Record<
  ToastKind,
  { icon: typeof CheckCircle2; ring: string; bg: string; text: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: "ring-success/30",
    bg: "bg-success/10 border-success/30",
    text: "text-success",
  },
  error: {
    icon: XCircle,
    ring: "ring-danger/30",
    bg: "bg-danger/10 border-danger/30",
    text: "text-danger",
  },
  warning: {
    icon: AlertTriangle,
    ring: "ring-warning/30",
    bg: "bg-warning/10 border-warning/30",
    text: "text-warning",
  },
  info: {
    icon: Info,
    ring: "ring-primary/30",
    bg: "bg-primary/10 border-primary/30",
    text: "text-primary",
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const style = KIND_STYLES[toast.kind];
  const Icon = style.icon;

  useEffect(() => {
    if (!toast.duration) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-[min(360px,90vw)] items-start gap-3 rounded-xl border p-3 shadow-lg ring-1 backdrop-blur-sm",
        style.bg,
        style.ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.text)} />
      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-sm leading-snug font-semibold">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-text-secondary mt-0.5 text-xs leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="text-text-muted hover:text-text-primary hover:bg-bg-elevated -mr-1 ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:right-6 sm:bottom-6 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
