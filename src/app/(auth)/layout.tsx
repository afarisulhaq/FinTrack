"use client";

import type { ReactNode } from "react";
import { BarChart3, Wallet, TrendingUp, MessageSquare } from "lucide-react";
import { useAppConfigStore } from "~/store/useAppConfigStore";

const FEATURES = [
  {
    icon: Wallet,
    title: "Lacak semua dompet & transaksi",
    desc: "Pantau saldo dan histori transaksi secara real-time",
  },
  {
    icon: TrendingUp,
    title: "Analisis investasi real-time",
    desc: "Portofolio saham, reksa dana, dan aset kripto",
  },
  {
    icon: MessageSquare,
    title: "AI Bot WhatsApp & Telegram",
    desc: "Catat transaksi dan tanya anggaran via chat bot AI",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  // Brand name + tagline are owned by the admin settings. The default
  // ("FinTrack" / "Kelola keuangan pribadimu") lives in
  // useAppConfigStore.DEFAULT_CONFIG and can be overridden per
  // deployment via Pengaturan App.
  const { config } = useAppConfigStore();

  return (
    <div className="bg-bg-base relative flex min-h-screen overflow-hidden">
      {/* ── Left decorative panel ───────────────────────────────── */}
      <div
        className="relative hidden flex-col items-start justify-center overflow-hidden px-16 py-12 lg:flex lg:w-[45%]"
        style={{ background: "var(--auth-panel-gradient)" }}
      >
        {/* Ambient blobs */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-8%",
            right: "-8%",
            width: "480px",
            height: "480px",
            background:
              "radial-gradient(circle, var(--auth-blob-1) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "5%",
            left: "-12%",
            width: "420px",
            height: "420px",
            background:
              "radial-gradient(circle, var(--auth-blob-2) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "38%",
            right: "12%",
            width: "220px",
            height: "220px",
            background:
              "radial-gradient(circle, var(--auth-blob-3) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "65%",
            right: "35%",
            width: "160px",
            height: "160px",
            background:
              "radial-gradient(circle, var(--auth-blob-4) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <div className="mb-14 flex items-center gap-3">
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "var(--gradient-primary)",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 24px var(--primary-glow)",
              }}
            >
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span
              className="text-3xl font-extrabold tracking-tight"
              style={{
                background: "var(--gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {config.appName}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-text-primary mb-5 text-[2.4rem] leading-[1.15] font-extrabold">
            {config.tagline}{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              dengan cerdas
            </span>
          </h1>

          <p className="text-text-secondary mb-12 text-base leading-relaxed">
            Pantau semua aset, pengeluaran, dan investasimu di satu tempat yang
            aman dan intuitif.
          </p>

          {/* Feature highlights */}
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    minWidth: "42px",
                    background: "var(--auth-tile-bg)",
                    border: "1px solid var(--auth-tile-border)",
                    borderRadius: "11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: "var(--auth-icon-color)" }}
                  />
                </div>
                <div>
                  <p className="text-text-primary text-sm leading-snug font-semibold">
                    {title}
                  </p>
                  <p className="text-text-muted mt-1 text-xs leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Stat badges */}
          <div className="mt-14 flex items-center gap-4">
            {[
              { value: "50k+", label: "Pengguna Aktif" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9★", label: "Rating" },
            ].map(({ value, label }) => (
              <div
                key={label}
                style={{
                  background: "var(--auth-stat-bg)",
                  border: "1px solid var(--auth-stat-border)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--auth-icon-color)" }}
                >
                  {value}
                </p>
                <p className="text-text-muted text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right edge separator */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "1px",
            background: "var(--auth-panel-divider)",
          }}
        />
      </div>

      {/* ── Right panel — form area ────────────────────────────── */}
      <div className="bg-bg-base relative z-20 flex min-h-screen flex-1 items-center justify-center p-6 sm:p-10 lg:p-12">
        {children}
      </div>
    </div>
  );
}
