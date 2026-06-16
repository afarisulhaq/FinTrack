// src/components/ui/confirm-dialog.tsx
//
// A global, promise-based confirmation modal. Replaces native
// `window.confirm()` with the app's design system.
//
// Usage from any client component:
//
//   const ok = await confirm({
//     title: "Hapus dompet?",
//     message: "Tindakan ini tidak bisa dibatalkan.",
//     variant: "danger", // "danger" | "warning" | "info"
//     confirmText: "Hapus", // optional, default per variant
//     cancelText: "Batal",  // optional
//   });
//   if (ok) { ... }
//
// Mount <ConfirmDialog /> once at the layout level (next to
// <ToastContainer />). Itself is a single Radix Dialog driven by a
// Zustand store; only one dialog can be open at a time.

"use client";

import { create } from "zustand";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";
import { cn } from "~/lib/utils";

export type ConfirmVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  close: (value: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    }),
  close: (value) => {
    // Capture the resolver BEFORE clearing state so the awaiting
    // caller's promise is settled exactly once, even if the Modal's
    // own `onOpenChange` fires again as the dialog animates closed.
    const { resolve } = get();
    resolve?.(value);
    set({ open: false, options: null, resolve: null });
  },
}));

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}

const VARIANT_STYLES: Record<
  ConfirmVariant,
  { Icon: typeof AlertCircle; ring: string; bg: string; text: string }
> = {
  danger: {
    Icon: AlertCircle,
    ring: "ring-danger/30",
    bg: "bg-danger/10",
    text: "text-danger",
  },
  warning: {
    Icon: AlertTriangle,
    ring: "ring-warning/30",
    bg: "bg-warning/10",
    text: "text-warning",
  },
  info: {
    Icon: Info,
    ring: "ring-primary/30",
    bg: "bg-primary/10",
    text: "text-primary",
  },
};

const DEFAULT_CONFIRM_TEXT: Record<ConfirmVariant, string> = {
  danger: "Hapus",
  warning: "Lanjut",
  info: "Konfirmasi",
};

const DEFAULT_CANCEL_TEXT = "Batal";

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const close = useConfirmStore((s) => s.close);

  if (!options) return null;

  const variant = options.variant ?? "danger";
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.Icon;
  const confirmText = options.confirmText ?? DEFAULT_CONFIRM_TEXT[variant];
  const cancelText = options.cancelText ?? DEFAULT_CANCEL_TEXT;

  return (
    <Modal
      open={open}
      onClose={() => close(false)}
      title={options.title}
      size="sm"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
            styles.bg,
            styles.ring,
            styles.text,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-text-secondary flex-1 pt-1 text-sm leading-relaxed">
          {options.message}
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => close(false)}>
          {cancelText}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "default"}
          onClick={() => close(true)}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
