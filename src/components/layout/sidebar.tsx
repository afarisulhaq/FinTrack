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
      { label: "Anggaran", icon: PieChart, href: "/budget" },
    ],
  },
  {
    title: "Investasi",
    items: [
      { label: "Portofolio", icon: TrendingUp, href: "/investments" },
      { label: "Avg Down Calc", icon: Calculator, href: "/avg-calculator" },
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
      { label: "Berulang", icon: Repeat2, href: "/recurring" },
      { label: "Reimburse", icon: RefreshCw, href: "/reimbursement" },
      { label: "Catatan", icon: StickyNote, href: "/notes" },
      { label: "Statistik", icon: BarChart3, href: "/statistics" },
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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        collapsed && "justify-center",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-text-muted hover:bg-bg-surface hover:text-text-secondary",
      )}
    >
      {isActive && (
        <span className="bg-primary absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          isActive ? "text-primary" : "text-current",
        )}
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}
      {collapsed && (
        <div className="bg-bg-elevated border-border text-text-primary pointer-events-none absolute left-full z-50 ml-3 translate-x-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
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
        "bg-bg-base border-border fixed top-0 left-0 z-50 flex h-screen flex-col border-r transition-[width,transform] duration-300 ease-in-out",
        widthClass,
        mobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full md:translate-x-0",
      )}
    >
      <div
        className={cn(
          "border-border flex h-16 shrink-0 items-center border-b px-4",
          collapsed ? "md:justify-center" : "gap-2.5",
        )}
      >
        {config.logoType !== "text" && (
          <div className="bg-primary/20 border-primary/25 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
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
          className="hover:bg-bg-surface text-text-muted ml-auto flex h-8 w-8 items-center justify-center rounded-lg md:hidden"
          onClick={closeMobile}
          aria-label="Tutup sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-3">
            {!collapsed && (
              <p className="text-text-muted/50 px-3 pb-1 text-[10px] font-semibold tracking-widest uppercase">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
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

      <div className="border-border shrink-0 space-y-0.5 border-t px-2 py-3">
        <NavLink
          item={{ label: "Settings", icon: Settings, href: "/settings" }}
          isActive={isActive("/settings")}
          collapsed={collapsed}
          onNavigate={closeMobile}
        />
        <button
          onClick={signOut}
          className={cn(
            "hover:bg-bg-surface flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
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
            "text-text-muted hover:bg-bg-surface hover:text-text-secondary hidden w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors md:flex",
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
