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
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { useAuthStore } from "~/store/useAuthStore";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
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
      { label: "Tagihan", icon: Receipt, href: "/bills" },
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

// Flattened list for collapsed tooltip lookup
const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 md:min-h-0",
        collapsed && "justify-center px-2 py-2.5",
        isActive
          ? "bg-primary/12 text-primary font-semibold"
          : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
      )}
    >
      {isActive && !collapsed && (
        <span className="bg-primary absolute top-1/2 left-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full max-md:hidden" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive
            ? "text-primary"
            : "text-text-muted group-hover:text-text-primary",
        )}
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
      {collapsed && (
        <div className="bg-bg-surface/95 text-text-primary pointer-events-none absolute left-full z-50 ml-3 translate-x-1 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap opacity-0 backdrop-blur-xl transition-all duration-150 [box-shadow:inset_0_0_0_1px_var(--glass-rim),var(--shadow-elevated)] group-hover:translate-x-0 group-hover:opacity-100">
          {item.label}
        </div>
      )}
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
  const LogoIcon = ICON_MAP[config.logoIcon] ?? TrendingUp;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function signOut() {
    logout();
    router.push("/login");
  }

  const widthClass = collapsed ? "md:w-16" : "md:w-60";

  return (
    <motion.aside
      initial={false}
      animate={{ x: mobileOpen ? 0 : undefined }}
      className={cn(
        "text-text-primary fixed top-0 left-0 z-50 flex h-screen flex-col transition-[width,transform] duration-300 ease-in-out",
        "bg-surface-card shadow-card [box-shadow:inset_-1px_0_0_var(--glass-rim),var(--shadow-card)]",
        widthClass,
        mobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full md:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center px-4",
          collapsed ? "md:justify-center" : "gap-2.5",
        )}
      >
        {config.logoType !== "text" && (
          <div className="bg-primary/20 border-primary/25 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
            {config.logoType === "image" && config.logoImageUrl ? (
              <img
                src={config.logoImageUrl}
                alt={config.appName}
                className="h-full w-full object-cover"
              />
            ) : (
              <LogoIcon className="text-primary h-5 w-5" />
            )}
          </div>
        )}
        {!collapsed && (
          <span className="text-text-primary truncate text-[15px] font-bold tracking-tight">
            {config.appName}
          </span>
        )}
        <button
          className="hover:bg-bg-surface text-text-muted ml-auto flex h-11 w-11 items-center justify-center rounded-md md:hidden"
          onClick={closeMobile}
          aria-label="Tutup sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <p className="text-text-muted px-3 pb-1.5 text-[10px] font-semibold tracking-wider uppercase select-none">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  collapsed={collapsed}
                  onNavigate={closeMobile}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 px-2.5 py-3">
        <NavLink
          item={{ label: "Pengaturan", icon: Settings, href: "/settings" }}
          isActive={isActive("/settings")}
          collapsed={collapsed}
          onNavigate={closeMobile}
        />
        <button
          onClick={signOut}
          className={cn(
            "hover:bg-bg-surface flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors md:min-h-0",
            collapsed && "md:justify-center",
          )}
        >
          <div className="bg-primary/20 border-primary/30 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
            <span className="text-primary text-xs font-bold">
              {initials(user?.name)}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-text-primary truncate text-xs leading-tight font-semibold">
                {user?.name ?? "User"}
              </p>
              <p className="text-text-muted truncate text-[10px] leading-tight">
                {user?.email ?? "user@email.com"}
              </p>
            </div>
          )}
        </button>
        <button
          onClick={toggleCollapsed}
          className={cn(
            "text-text-muted hover:bg-bg-surface hover:text-text-secondary hidden min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors md:flex md:min-h-0",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
