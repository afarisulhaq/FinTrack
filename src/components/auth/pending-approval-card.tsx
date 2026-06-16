"use client";

import { CheckCircle2, Clock, Mail } from "lucide-react";
import Link from "next/link";
import type { RegisterResult } from "~/store/useAuthStore";
import { Button } from "~/components/ui/button";

interface PendingApprovalCardProps {
  result: RegisterResult;
  onBackToLogin: () => void;
}

/**
 * Shown on /register after a successful submission when the server
 * requires admin approval (the default in production). The user
 * can't log in until an admin flips their status from `pending` to
 * `active` in /admin/users, so this card stays in place of the form.
 */
export function PendingApprovalCard({
  result,
  onBackToLogin,
}: PendingApprovalCardProps) {
  const email = result.user?.email;

  return (
    <div
      className="border-border bg-bg-surface relative z-50 w-full max-w-md rounded-2xl border p-6 sm:p-8"
      style={{
        boxShadow: "var(--auth-card-shadow)",
        opacity: 1,
        visibility: "visible",
      }}
    >
      <div className="mb-5 flex justify-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "var(--success-bg, rgba(34, 197, 94, 0.12))",
            color: "var(--success, #22c55e)",
          }}
        >
          <CheckCircle2 className="h-7 w-7" />
        </div>
      </div>

      <h1 className="text-text-primary mb-2 text-center text-2xl font-bold">
        Pendaftaran Berhasil
      </h1>
      <p className="text-text-secondary mb-6 text-center text-sm leading-relaxed">
        Akun kamu sudah dibuat dan sedang menunggu persetujuan admin.
        Kamu akan bisa masuk setelah admin mengaktifkannya.
      </p>

      {email && (
        <div className="border-border bg-bg-base mb-6 flex items-center gap-3 rounded-xl border px-4 py-3">
          <Mail className="text-text-muted h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-text-muted text-xs">Akun terdaftar</p>
            <p className="text-text-primary truncate text-sm font-medium">
              {email}
            </p>
          </div>
        </div>
      )}

      <div
        className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--warning-bg, rgba(245, 158, 11, 0.08))",
          border: "1px solid var(--warning-border, rgba(245, 158, 11, 0.25))",
        }}
      >
        <Clock
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: "var(--warning, #f59e0b)" }}
        />
        <p className="text-text-secondary text-xs leading-relaxed">
          Proses approval biasanya memakan waktu kurang dari 24 jam. Hubungi
          admin jika kamu merasa pendaftaranmu sudah terlalu lama tertunda.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          className="h-12 w-full"
          size="lg"
          onClick={onBackToLogin}
        >
          Kembali ke Halaman Login
        </Button>
        <Link
          href="/login"
          className="text-text-muted hover:text-text-secondary block py-2 text-center text-xs"
        >
          Sudah disetujui? Coba masuk →
        </Link>
      </div>
    </div>
  );
}
