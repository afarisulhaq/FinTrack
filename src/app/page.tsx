"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Wallet,
  TrendingUp,
  MessageSquare,
  Target,
  PiggyBank,
  CreditCard,
  Receipt,
  Users,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  Bot,
  SplitSquareVertical,
  Gamepad2,
  Smartphone,
} from "lucide-react";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { applyBrand } from "~/lib/brand";
import { useSessionRedirect } from "~/lib/use-session-redirect";

// ── Constants ──────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Fitur", href: "#fitur" },
  { label: "Harga", href: "#harga" },
  { label: "FAQ", href: "#faq" },
] as const;

const HERO_FEATURES = [
  {
    icon: Wallet,
    title: "Multi-Dompet & Rekening",
    desc: "Struktur dompet hierarki seperti Bank Jago. Pisahkan dana sesuai kebutuhan.",
  },
  {
    icon: TrendingUp,
    title: "Investasi Real-Time",
    desc: "Pantau portofolio saham, crypto, & emas. Update harga otomatis dari Yahoo Finance.",
  },
  {
    icon: Bot,
    title: "AI Chat Bot",
    desc: "Catat transaksi via WhatsApp/Telegram. Foto struk? AI langsung ekstrak nominalnya.",
  },
  {
    icon: SplitSquareVertical,
    title: "Split Bill QRIS",
    desc: "Buat tagihan grup, share link pembayaran QRIS ke peserta. Otomatis terlacak.",
  },
];

const FEATURES_SECTIONS = [
  {
    title: "Manajemen Keuangan Inti",
    items: [
      { icon: Wallet, label: "Multi-Wallet & Nested Pockets" },
      { icon: LayoutDashboard, label: "Dashboard Net Worth & Arus Kas" },
      { icon: Target, label: "Anggaran per Kategori" },
      { icon: PiggyBank, label: "Target Tabungan & Saving Goals" },
      { icon: Receipt, label: "Tagihan Berulang (Bills)" },
      { icon: CreditCard, label: "Pelacakan Kartu Kredit" },
    ],
  },
  {
    title: "Investasi & Portofolio",
    items: [
      { icon: TrendingUp, label: "Multi-Broker Portfolio" },
      { icon: BarChart3, label: "Pie Chart Alokasi Aset" },
      { icon: TrendingUp, label: "Real-Time P/L Floating" },
      { icon: BarChart3, label: "Riwayat Jual & Realisasi" },
    ],
  },
  {
    title: "Otomatisasi & Kolaborasi",
    items: [
      { icon: Bot, label: "AI Bot WhatsApp / Telegram" },
      { icon: MessageSquare, label: "OCR Nota & NLP Text" },
      { icon: SplitSquareVertical, label: "Split Bill dengan QRIS" },
      { icon: Users, label: "Multi-User & Role Management" },
    ],
  },
] as const;

const FAQS = [
  {
    q: "Apakah data saya aman?",
    a: "Sangat aman. Semua data disimpan di database Postgres dengan enkripsi AES-256. Token API investasi dan password di-hash dengan bcrypt. Kami tidak pernah membagikan data ke pihak ketiga.",
  },
  {
    q: "Bagaimana cara kerja bot WhatsApp?",
    a: "Cukup hubungkan nomor WhatsApp kamu di Pengaturan → Notifikasi. Setelah itu kamu bisa kirim teks seperti 'beli kopi 25rb pakai dompet harian' atau foto struk belanja, dan AI kami otomatis mencatatnya.",
  },
  {
    q: "Apa itu Split Bill QRIS?",
    a: "Fitur untuk membuat tagihan grup (misal: makan siang bersama). Setiap peserta mendapat link pembayaran unik yang bisa dibayar via QRIS. Status pembayaran terpantau real-time tanpa perlu ribet ngitung manual.",
  },
  {
    q: "Bisa dipakai untuk keluarga?",
    a: "Bisa! Dengan fitur Multi-User, kamu bisa tambah pasangan atau anak sebagai Member dengan hak akses terbatas: cocok untuk keuangan keluarga atau bisnis kecil.",
  },
  {
    q: "Apakah FinTrack berbayar?",
    a: "Saat ini FinTrack bisa digunakan gratis. Paket berbayar dan pembayaran langganan belum tersedia. Harga dan ketentuan paket akan diumumkan saat layanan langganan siap.",
  },
  {
    q: "Data investasi dari mana?",
    a: "Harga saham diambil dari Yahoo Finance API (real-time dengan delay 15 menit untuk data gratis). Crypto dari CoinGecko. Emas dari sumber terpercaya.",
  },
] as const;

// ── Components ────────────────────────────────────────────────────────────

function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { config } = useAppConfigStore();
  const iconSize = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const boxSize = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const textSize = size === "lg" ? "text-xl" : "text-sm";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className={`${boxSize} flex items-center justify-center rounded-xl`}
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "0 4px 14px var(--primary-glow)",
        }}
      >
        <DynamicIcon
          name={config.logoIcon || "TrendingUp"}
          className={`${iconSize} text-on-primary`}
        />
      </div>
      <span
        className={`${textSize} font-extrabold tracking-tight`}
        style={{
          background: "var(--gradient-primary)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {config.appName}
      </span>
    </Link>
  );
}

function AnimatedGlow({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className ?? ""}`}
      style={style}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  useSessionRedirect();
  const { config } = useAppConfigStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    applyBrand(config.primaryColor, config.accentColor);
  }, [config.primaryColor, config.accentColor]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-[var(--border)]/50 bg-[var(--bg-base)]/80 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="bg-primary text-on-primary hover:bg-primary-hover shadow-primary/25 hover:shadow-primary/40 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition-all"
              >
                Daftar Gratis
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[var(--text-primary)] md:hidden"
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-5 md:hidden">
            <nav className="flex flex-col gap-4">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {l.label}
                </Link>
              ))}
              <hr className="border-[var(--border)]" />
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="bg-primary text-on-primary hover:bg-primary-hover inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                Daftar Gratis
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
        {/* Glow blobs */}
        <AnimatedGlow
          className="-top-40 -left-40 h-[500px] w-[500px]"
          style={{
            backgroundColor:
              "color-mix(in oklab, var(--primary) 20%, transparent)",
          }}
        />
        <AnimatedGlow
          className="top-1/3 -right-40 h-[400px] w-[400px]"
          style={{
            backgroundColor:
              "color-mix(in oklab, var(--accent-color, var(--primary)) 15%, transparent)",
          }}
        />
        <AnimatedGlow
          className="bottom-0 left-1/3 h-[300px] w-[300px]"
          style={{
            backgroundColor:
              "color-mix(in oklab, var(--primary) 10%, transparent)",
          }}
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="border-primary/30 bg-primary/10 text-primary mb-6 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              All-in-One Wealth & Expense Management
            </div>

            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Kelola Semua Keuanganmu{" "}
              <span
                style={{
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                dengan Cerdas
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
              Pantau dompet, investasi, tagihan, dan anggaran dalam satu
              dashboard. Ditambah AI bot yang siap bantu catat transaksi via
              WhatsApp.
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="bg-primary text-on-primary hover:bg-primary-hover shadow-primary/25 hover:shadow-primary/40 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all sm:w-auto"
              >
                Mulai Gratis
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="#fitur"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] sm:w-auto"
              >
                Lihat Fitur
              </Link>
            </div>
          </div>

          {/* Hero feature cards */}
          <div className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HERO_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="hover:border-primary/30 hover:shadow-primary/5 group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-all hover:shadow-lg"
              >
                <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section
        id="fitur"
        className="border-y border-[var(--border)]/50 py-16 sm:py-24"
        style={{ background: "var(--gradient-surface)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
              Fitur Lengkap
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Semua yang kamu butuhkan untuk{" "}
              <span
                style={{
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                finansial sehat
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              Dari catat pengeluaran harian sampai pantau portofolio investasi:
              semua terintegrasi dalam satu platform.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="mb-4 text-sm font-bold tracking-tight">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.items.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="hover:border-primary/20 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 transition-all"
                    >
                      <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works / Showcase ─────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: text */}
            <div>
              <p className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
                Cara Kerja
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Dari chat WhatsApp sampai{" "}
                <span
                  style={{
                    background: "var(--gradient-primary)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  laporan otomatis
                </span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                {config.appName} dirancang agar kamu tidak perlu berpindah
                aplikasi. Cukup kirim pesan ke bot, foto struk, atau buka
                dashboard: semua terpantau.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  {
                    step: "01",
                    title: "Hubungkan Dompet & Akun",
                    desc: "Tambah rekening bank, e-wallet, dan akun investasi dalam satu dashboard.",
                  },
                  {
                    step: "02",
                    title: "Catat via Chat atau Manual",
                    desc: "Kirim 'kopi 25rb' ke WhatsApp bot atau input langsung di aplikasi.",
                  },
                  {
                    step: "03",
                    title: "Pantau & Evaluasi",
                    desc: "Lihat net worth, realisasi investasi, dan laporan otomatis tiap bulan.",
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-4">
                    <div className="bg-primary text-on-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold">
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: dashboard preview card */}
            <div className="relative">
              <AnimatedGlow
                className="-top-20 -right-20 h-[300px] w-[300px]"
                style={{
                  backgroundColor:
                    "color-mix(in oklab, var(--primary) 10%, transparent)",
                }}
              />
              <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-xl shadow-black/30">
                {/* Mock top bar */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      Net Worth
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#22c55e]">
                    +Rp 2,4jt
                  </div>
                </div>

                {/* Mock chart bars */}
                <div className="mb-5 flex items-end gap-2">
                  {[40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 95].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="h-16 w-full rounded-t-md"
                        style={{
                          height: `${h * 0.6 + 20}px`,
                          background:
                            "linear-gradient(to top, color-mix(in oklab, var(--primary) 35%, transparent), color-mix(in oklab, var(--primary) 75%, transparent))",
                        }}
                      />
                    ),
                  )}
                </div>

                {/* Mock wallet cards */}
                <div className="space-y-2">
                  {[
                    {
                      name: "Bank BCA",
                      balance: "Rp 12.450.000",
                      color: "var(--primary)",
                    },
                    {
                      name: "Kantong Jajan",
                      balance: "Rp 850.000",
                      color: "#22c55e",
                    },
                    {
                      name: "Investasi Saham",
                      balance: "Rp 8.320.000",
                      color: "#f59e0b",
                    },
                  ].map(({ name, balance, color }) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-medium">{name}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">
                        {balance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section
        id="harga"
        className="border-y border-[var(--border)]/50 py-16 sm:py-24"
        style={{ background: "var(--gradient-surface)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto grid max-w-4xl gap-8 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-10 md:grid-cols-[1.5fr_1fr] md:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
                Harga
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Gunakan {config.appName} gratis saat ini
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                Mulai catat transaksi, kelola dompet, dan pantau target tabungan
                tanpa biaya langganan.
              </p>
              <Link
                href="/register"
                className="bg-primary text-on-primary hover:bg-primary-hover mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)] sm:w-auto"
              >
                Buat akun gratis
              </Link>
            </div>
            <div className="border-t border-[var(--border)] pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
              <h3 className="text-base font-semibold">
                Paket berbayar belum tersedia
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                Harga dan ketentuan paket akan diumumkan saat layanan langganan
                siap. Saat ini belum ada pembayaran atau perpanjangan langganan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
              FAQ
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pertanyaan yang{" "}
              <span
                style={{
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                sering ditanyakan
              </span>
            </h2>
          </div>

          <div className="mt-10 space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="hover:border-primary/20 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold">{faq.q}</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${
                      openFaq === i ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-[var(--border)] px-5 py-4">
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            className="relative isolate overflow-hidden rounded-3xl border px-6 py-14 text-center shadow-2xl sm:px-14"
            style={{
              borderColor:
                "color-mix(in oklab, var(--primary) 25%, transparent)",
              background:
                "linear-gradient(135deg, #181a1d 0%, color-mix(in oklab, var(--primary) 12%, #121417) 50%, #101114 100%)",
              boxShadow:
                "0 25px 50px -12px color-mix(in oklab, var(--primary) 15%, transparent)",
            }}
          >
            <AnimatedGlow
              className="-top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--primary) 15%, transparent)",
              }}
            />

            <div className="relative z-10">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Siap{" "}
                <span
                  style={{
                    background: "var(--gradient-primary)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  menguasai
                </span>{" "}
                keuanganmu?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
                Catat pemasukan dan pengeluaranmu di {config.appName}, lalu
                pantau saldo setiap dompet. Saat ini bisa digunakan gratis.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/register"
                  className="bg-primary text-on-primary hover:bg-primary-hover shadow-primary/25 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all sm:w-auto"
                >
                  Daftar Gratis
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] sm:w-auto"
                >
                  Masuk ke Akun
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]/50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo size="sm" />
            <div className="flex items-center gap-5">
              {[
                { label: "Tentang", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Kebijakan Privasi", href: "#" },
                { label: "Syarat & Ketentuan", href: "#" },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] text-[var(--text-muted)] sm:text-left">
            &copy; {new Date().getFullYear()} {config.appName}.{" "}
            {config.footerText || "All rights reserved."}
          </p>
        </div>
      </footer>
    </div>
  );
}
