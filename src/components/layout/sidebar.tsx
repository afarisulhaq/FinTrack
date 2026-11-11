"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  TrendingUp,
  Calculator,
  Eye,
  Receipt,
  PiggyBank,
  Handshake,
  CreditCard,
  Heart,
  Users,
  RefreshCw,
  StickyNote,
  BarChart3,
  Bot,
  Repeat2,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  DollarSign,
  Coins,
  Landmark,
  Zap,
  Sparkles,
  FolderTree,
  Store,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "~/lib/utils";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { useAuthStore } from "~/store/useAuthStore";
import { useSafeToSpend } from "~/lib/use-safe-to-spend";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: "bills";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Keuangan",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Dompet", icon: Wallet, href: "/wallets" },
      { label: "Transaksi", icon: ArrowLeftRight, href: "/transactions" },
      { label: "Bisnis", icon: Store, href: "/businesses" },
      { label: "Anggaran", icon: PieChart, href: "/budget" },
    ],
  },
  {
    title: "Investasi",
    items: [
      { label: "Portofolio", icon: TrendingUp, href: "/investments" },
      { label: "Avg Down Calculator", icon: Calculator, href: "/avg-calculator" },
      { label: "Market Watch", icon: Eye, href: "/market-watch" },
    ],
  },
  {
    title: "Manajemen",
    items: [
      { label: "Kategori", icon: FolderTree, href: "/categories" },
      { label: "Tagihan", icon: Receipt, href: "/bills", badge: "bills" },
      { label: "Tabungan", icon: PiggyBank, href: "/savings" },
      { label: "Utang & Piutang", icon: Handshake, href: "/debts" },
      { label: "Kartu", icon: CreditCard, href: "/cards" },
      { label: "Wishlist", icon: Heart, href: "/wishlist" },
      { label: "Split Bill", icon: Users, href: "/split-bills" },
    ],
  },
  {
    title: "Lainnya",
    items: [
      { label: "Transaksi Berulang", icon: Repeat2, href: "/recurring" },
      { label: "Reimbursement", icon: RefreshCw, href: "/reimbursement" },
      { label: "Catatan", icon: StickyNote, href: "/notes" },
      { label: "Statistik", icon: BarChart3, href: "/statistics" },
      { label: "Langganan", icon: CreditCard, href: "/subscription" },
    ],
  },
  {
    title: "Fitur",
    items: [
      { label: "Gamifikasi", icon: Trophy, href: "/gamification" },
      { label: "AI Bot", icon: Bot, href: "/ai-bot" },
    ],
  },
];

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Wallet,
  PieChart,
  BarChart3,
  DollarSign,
  Coins,
  Landmark,
  CreditCard,
  PiggyBank,
  Shield,
  Zap,
  Sparkles,
};

function initials(name?: string) {
  return (name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleLabel(role?: string) {
  if (role === "admin") return "Admin";
  if (role === "member") return "Anggota";
  return "Pemilik";
}

function NavLink({
  item,
  isActive,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-11 shrink-0 items-center gap-3 rounded-[14px] px-3 text-sm font-semibold transition-colors duration-150",
        collapsed && "justify-center px-0",
        isActive
          ? "text-on-primary [background:var(--gradient-primary)] [box-shadow:0_10px_24px_-12px_var(--primary-glow)]"
          : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {count ? (
            <span
              className={cn(
                "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                isActive
                  ? "bg-black/20 text-on-primary"
                  : "bg-primary/12 text-primary",
              )}
            >
              {count}
            </span>
          ) : null}
        </>
      )}
      {collapsed && (
        <div className="bg-bg-surface/95 text-text-primary pointer-events-none absolute left-full z-50 ml-3 translate-x-1 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap opacity-0 backdrop-blur-xl transition-all duration-150 [box-shadow:inset_0_0_0_1px_var(--glass-rim),var(--shadow-elevated)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
          {item.label}
        </div>
      )}
    </Link>
  );
}

/** The footer strip: what is left of today once committed bills are set aside. */
function SafeToSpend() {
  const safe = useSafeToSpend();
  const currency = useAppConfigStore((s) => s.config.currency);

  const note = !safe
    ? "Menghitung sisa bulan ini…"
    : safe.unpaidCount === 0
      ? `Tidak ada tagihan tertunda, ${safe.daysLeft} hari lagi bulan ini.`
      : `${formatCurrency(safe.committed, true, currency)} tagihan ${
          safe.nextDueInDays === null
            ? "menunggu dibayar"
            : safe.nextDueInDays === 0
              ? "jatuh tempo hari ini"
              : `jatuh tempo ${safe.nextDueInDays} hari lagi`
        }.`;

  return (
    <Link
      href="/bills"
      className="bg-surface-card mt-auto block shrink-0 rounded-[18px] px-3.5 py-3.5 transition-shadow [box-shadow:inset_0_0_0_1px_var(--glass-rim)] hover:[box-shadow:inset_0_0_0_1px_var(--border-strong)]"
    >
      <span className="text-text-muted block text-[11px] font-semibold">
        Aman dibelanjakan hari ini
      </span>
      <span className="text-primary mt-1 mb-1 block text-2xl font-semibold tracking-tight tabular-nums">
        {safe ? formatCurrency(safe.perDay, true, currency) : "-"}
      </span>
      <span className="text-text-muted block text-[10px] leading-[1.35] font-semibold">
        {note}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } =
    useSidebarStore();
  const { config } = useAppConfigStore();
  const { user, logout } = useAuthStore();
  const safe = useSafeToSpend();
  const LogoIcon = ICON_MAP[config.logoIcon] ?? TrendingUp;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function signOut() {
    logout();
    router.push("/login");
  }

  return (
    <motion.aside
      initial={false}
      animate={{ x: mobileOpen ? 0 : undefined }}
      className={cn(
        "text-text-primary fixed top-0 left-0 z-50 flex h-screen flex-col gap-1.5 px-3.5 pt-[18px] pb-3.5 transition-[width,transform] duration-300 ease-in-out",
        "bg-surface-card [box-shadow:inset_-1px_0_0_var(--glass-rim),var(--shadow-card)]",
        collapsed ? "md:w-[76px]" : "md:w-[244px]",
        mobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 pr-0.5 pb-3.5 pl-1">
        <Link
          href="/dashboard"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 md:min-h-0"
        >
          <span className="text-on-primary grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-xl [background:var(--gradient-primary)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.38),0_8px_20px_-8px_var(--primary-glow)]">
            {config.logoType === "image" && config.logoImageUrl ? (
              <img
                src={config.logoImageUrl}
                alt={config.appName}
                className="h-full w-full object-cover"
              />
            ) : (
              <LogoIcon className="h-[22px] w-[22px]" />
            )}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[21px] leading-none font-bold tracking-[-0.02em]">
                {config.appName}
              </span>
              <span className="text-text-muted mt-1 block truncate text-[10px] font-semibold">
                {config.tagline || user?.name || "Keuangan pribadi"}
              </span>
            </span>
          )}
        </Link>
        <button
          onClick={closeMobile}
          className="bg-text-primary/[0.06] text-text-primary grid h-11 w-11 shrink-0 place-items-center rounded-md [box-shadow:inset_0_0_0_1px_var(--border)] md:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={toggleCollapsed}
          className="bg-text-primary/[0.06] text-text-primary hidden h-8 w-8 shrink-0 place-items-center rounded-[10px] [box-shadow:inset_0_0_0_1px_var(--border)] hover:bg-bg-elevated md:grid"
          aria-label={collapsed ? "Lebarkan menu" : "Sempitkan menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-[18px] w-[18px]" />
          ) : (
            <ChevronLeft className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group, index) => (
          <div
            key={group.title}
            className={cn(
              "flex flex-col gap-0.5",
              index > 0 &&
                "before:bg-border relative mt-3.5 pt-2.5 before:absolute before:inset-x-3 before:top-0 before:h-px before:content-['']",
            )}
          >
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
                count={
                  item.badge === "bills" ? (safe?.unpaidCount ?? 0) : undefined
                }
                onNavigate={closeMobile}
              />
            ))}
          </div>
        ))}
        <div className="before:bg-border relative mt-3.5 pt-2.5 before:absolute before:inset-x-3 before:top-0 before:h-px before:content-['']">
          <NavLink
            item={{ label: "Pengaturan", icon: Settings, href: "/settings" }}
            isActive={isActive("/settings")}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
        </div>
      </nav>

      {!collapsed && <SafeToSpend />}

      <button
        onClick={signOut}
        className={cn(
          "mt-1 flex w-full shrink-0 items-center gap-2.5 rounded-2xl p-2 text-left transition-colors hover:bg-bg-elevated",
          collapsed && "justify-center",
        )}
      >
        <span className="text-primary grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/12 text-[11px] font-bold">
          {initials(user?.name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
                {user?.name ?? "Pengguna"}
              </span>
              <span className="text-text-muted block truncate text-[10px]">
                {roleLabel(user?.role)} · {user?.email ?? "user@email.com"}
              </span>
            </span>
            <LogOut className="text-text-muted h-4 w-4 shrink-0" />
          </>
        )}
      </button>
    </motion.aside>
  );
}
