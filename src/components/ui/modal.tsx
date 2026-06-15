"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
} as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: keyof typeof sizeMap;
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  key="modal-overlay"
                  className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                />
              </Dialog.Overlay>

              <Dialog.Content asChild onEscapeKeyDown={onClose}>
                <motion.div
                  key="modal-content"
                  className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none focus:outline-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <motion.div
                    className={cn(
                      "pointer-events-auto w-full",
                      sizeMap[size],
                      "max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl",
                      "border border-border bg-bg-surface shadow-[0_28px_90px_-20px_rgba(0,0,0,0.95)]",
                      "ring-1 ring-white/5 flex flex-col",
                    )}
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 16 }}
                    transition={{
                      type: "spring",
                      duration: 0.28,
                      bounce: 0.18,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-border bg-bg-elevated/35 px-5 py-4 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <Dialog.Title className="text-base sm:text-lg font-semibold text-text-primary leading-snug">
                          {title}
                        </Dialog.Title>
                        {description && (
                          <Dialog.Description className="mt-1 text-sm text-text-secondary leading-relaxed">
                            {description}
                          </Dialog.Description>
                        )}
                      </div>
                      <Dialog.Close asChild>
                        <button
                          className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          aria-label="Close modal"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                      {children}
                    </div>
                  </motion.div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Modal };
