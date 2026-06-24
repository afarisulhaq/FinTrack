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
  Check,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  Bot,
  SplitSquareVertical,
  Gamepad2,
  Smartphone,
} from "lucide-react";

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
    desc: "Struktur dompet hierarki seperti Bank Jago — pisahkan dana sesuai kebutuhan.",
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
    desc: "Buat tagihan grup, share link pembayaran QRIS ke peserta — otomatis terlacak.",
  },
] as const;

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

const PRICING = [
  {
    name: "Starter",
    price: "Gratis",
    period: "selamanya",
    desc: "Cukup untuk pribadi mulai catat keuangan.",
    popular: false,
    features: [
      "Dompet & transaksi tak terbatas",
      "Dashboard keuangan dasar",
      "10 transaksi/bulan via bot WhatsApp",
      "Target tabungan",
      "Ekspor CSV bulanan",
    ],
    cta: "Mulai Gratis",
    href: "/register",
  },
  {
    name: "Pro",
    price: "Rp 29rb",
    period: "/bulan",
    desc: "Untuk pengguna aktif dengan portofolio & tim.",
    popular: true,
    features: [
      "Semua fitur Starter",
      "Investasi real-time + Yahoo Finance",
      "Bot WhatsApp/Telegram tak terbatas",
      "Split Bill QRIS + public payment",
      "Multi-user (owner + 3 member)",
      "Laporan PDF otomatis",
    ],
    cta: "Coba Gratis 7 Hari",
    href: "/register?plan=pro",
  },
  {
    name: "Enterprise",
    price: "Rp 99rb",
    period: "/bulan",
    desc: "Untuk bisnis & keluarga besar.",
    popular: false,
    features: [
      "Semua fitur Pro",
      "User & role tak terbatas",
      "AI prediksi anggaran",
      "Export data legal (PDF/CSV/Excel)",
      "Prioritas support via WhatsApp",
      "White-label branding",
    ],
    cta: "Hubungi Kami",
    href: "mailto:support@fintrack.app",
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
    a: "Bisa! Dengan fitur Multi-User, kamu bisa tambah pasangan atau anak sebagai Member dengan hak akses terbatas — cocok untuk keuangan keluarga atau bisnis kecil.",
  },
  {
    q: "Apakah ada uji coba gratis?",
    a: "Ya, kamu bisa coba semua fitur Pro gratis selama 7 hari tanpa komitmen. Tidak perlu kartu kredit.",
  },
  {
    q: "Data investasi dari mana?",
    a: "Harga saham diambil dari Yahoo Finance API (real-time dengan delay 15 menit untuk data gratis). Crypto dari CoinGecko. Emas dari sumber terpercaya.",
  },
] as const;

// ── Components ────────────────────────────────────────────────────────────

function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const iconSize = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const boxSize = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const textSize = size === "lg" ? "text-xl" : "text-sm";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className={`${boxSize} flex items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] shadow-lg shadow-[#6366f1]/25`}
      >
        <BarChart3 className={`${iconSize} text-white`} />
      </div>
      <span
        className={`${textSize} bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text font-extrabold tracking-tight text-transparent`}
      >
        FinTrack
      </span>
    </Link>
  );
}

function AnimatedGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className ?? ""}`}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] hover:shadow-[#6366f1]/40"
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
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4f46e5]"
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
        <AnimatedGlow className="-top-40 -left-40 h-[500px] w-[500px] bg-[#6366f1]/20" />
        <AnimatedGlow className="top-1/3 -right-40 h-[400px] w-[400px] bg-[#8b5cf6]/15" />
        <AnimatedGlow className="bottom-0 left-1/3 h-[300px] w-[300px] bg-[#6366f1]/10" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-3.5 py-1 text-xs font-medium text-[#818cf8]">
              <Sparkles className="h-3.5 w-3.5" />
              All-in-One Wealth & Expense Management
            </div>

            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Kelola Semua Keuanganmu{" "}
              <span className="bg-gradient-to-r from-[#6366f1] via-[#818cf8] to-[#a78bfa] bg-clip-text text-transparent">
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] hover:shadow-[#6366f1]/40 sm:w-auto"
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
                className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-all hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1]/10 text-[#818cf8]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {desc}
                </p>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="mt-14 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-10 sm:grid-cols-4">
            {[
              { value: "Rp 2,4T+", label: "Transaksi Dicatat" },
              { value: "50.000+", label: "Pengguna Aktif" },
              { value: "99.9%", label: "Uptime Server" },
              { value: "4.9★", label: "Rating Pengguna" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-xl font-extrabold text-transparent sm:text-2xl">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {label}
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
            <p className="mb-3 text-xs font-semibold tracking-widest text-[#818cf8] uppercase">
              Fitur Lengkap
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Semua yang kamu butuhkan untuk{" "}
              <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                finansial sehat
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              Dari catat pengeluaran harian sampai pantau portofolio investasi —
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
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 transition-all hover:border-[#6366f1]/20"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#818cf8]">
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
              <p className="mb-3 text-xs font-semibold tracking-widest text-[#818cf8] uppercase">
                Cara Kerja
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Dari chat WhatsApp sampai{" "}
                <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                  laporan otomatis
                </span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                FinTrack dirancang agar kamu tidak perlu berpindah aplikasi.
                Cukup kirim pesan ke bot, foto struk, atau buka dashboard —
                semua terpantau.
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1] text-[10px] font-bold text-white">
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
              <AnimatedGlow className="-top-20 -right-20 h-[300px] w-[300px] bg-[#6366f1]/10" />
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
                        className="h-16 w-full rounded-t-md bg-gradient-to-t from-[#6366f1]/40 to-[#818cf8]/60"
                        style={{ height: `${h * 0.6 + 20}px` }}
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
                      color: "#6366f1",
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
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold tracking-widest text-[#818cf8] uppercase">
              Harga
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Investasi kecil untuk{" "}
              <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                masa depan finansial
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              Pilih paket yang sesuai. Semua paket bisa upgrade kapan saja.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 transition-all hover:shadow-lg ${
                  p.popular
                    ? "border-[#6366f1]/40 bg-[#6366f1]/[0.04] shadow-[#6366f1]/10"
                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-3 py-0.5 text-[10px] font-bold text-white shadow-lg">
                    POPULER
                  </div>
                )}

                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {p.desc}
                </p>

                <div className="mt-5 mb-5">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  {p.period && (
                    <span className="ml-1 text-sm text-[var(--text-muted)]">
                      {p.period}
                    </span>
                  )}
                </div>

                <ul className="mb-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
                      <span className="text-[var(--text-secondary)]">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    p.popular
                      ? "bg-[#6366f1] text-white shadow-lg shadow-[#6366f1]/25 hover:bg-[#4f46e5]"
                      : "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)]"
                  }`}
                >
                  {p.cta}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold tracking-widest text-[#818cf8] uppercase">
              FAQ
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pertanyaan yang{" "}
              <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                sering ditanyakan
              </span>
            </h2>
          </div>

          <div className="mt-10 space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-colors hover:border-[#6366f1]/20"
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
          <div className="relative isolate overflow-hidden rounded-3xl border border-[#6366f1]/20 bg-gradient-to-br from-[#1a1d27] via-[#1e1b4b] to-[#0f1117] px-6 py-14 text-center shadow-2xl shadow-[#6366f1]/10 sm:px-14">
            <AnimatedGlow className="-top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 bg-[#6366f1]/15" />

            <div className="relative z-10">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Siap{" "}
                <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                  menguasai
                </span>{" "}
                keuanganmu?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
                Gabung 50.000+ pengguna yang sudah merapikan keuangan dengan
                FinTrack. Gratis selamanya, tanpa kartu kredit.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/register"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] sm:w-auto"
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
            &copy; {new Date().getFullYear()} FinTrack. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
