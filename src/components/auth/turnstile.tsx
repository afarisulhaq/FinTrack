"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileProps {
  /** Cloudflare Turnstile site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  siteKey: string;
  /** Called whenever a fresh, valid token is issued. */
  onVerify: (token: string) => void;
  /** Called when the token expires or the user fails the challenge. */
  onExpire?: () => void;
  className?: string;
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Renders the Cloudflare Turnstile widget and forwards the resulting
 * one-time token to the parent. The widget script is injected once,
 * lazily, on first mount.
 *
 * The parent is expected to send the token to the server (which
 * re-verifies it against Cloudflare's siteverify API). We do NOT
 * trust the widget alone — but the widget blocks obvious bots from
 * even reaching the API, and the server-side check is the source
 * of truth.
 */
export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(
    typeof window !== "undefined" && Boolean(window.turnstile),
  );

  useEffect(() => {
    if (scriptReady) return;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () => {
          /* surface to user in the host form */
        },
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    document.head.appendChild(script);
  }, [scriptReady]);

  useEffect(() => {
    if (!scriptReady) return;
    if (!containerRef.current) return;
    if (widgetIdRef.current) return; // already rendered
    if (!window.turnstile) return;
    const id = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onVerify(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onExpire?.(),
      theme: "auto",
      size: "flexible",
    });
    widgetIdRef.current = id;
  }, [scriptReady, siteKey, onVerify, onExpire]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget may already be gone on unmount */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div className={className}>
      <div className="text-text-muted mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <ShieldCheck className="h-3.5 w-3.5" />
        Verifikasi keamanan
      </div>
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}

/** Imperative helper to reset the widget (e.g. after a server error). */
export function resetTurnstile(widgetId?: string) {
  if (typeof window === "undefined" || !window.turnstile) return;
  try {
    window.turnstile.reset(widgetId);
  } catch {
    /* widget may be gone */
  }
}
