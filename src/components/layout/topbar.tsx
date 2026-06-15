"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Search,
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Menu,
  Shield,
  RefreshCw,
  Loader2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "~/lib/utils";
import { useSidebarStore } from "~/store/useSidebarStore";
import { useAuthStore } from "~/store/useAuthStore";
import { useFinanceStore } from "~/store/useFinanceStore";
import { toast } from "~/components/ui/toast";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

function initials(name?: string) {
  return (name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Topbar({ title, subtitle }: TopbarProps) {
  const router = useRouter();
  const [hasUnread] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const toggleMobile = useSidebarStore((state) => state.toggleMobile);
  const { user, logout } = useAuthStore();
  const refreshAll = useFinanceStore((s) => s.refreshAll);
  const lastSyncedAt = useFinanceStore((s) => s.lastSyncedAt);

  // Re-render every 30s so the "last sync" relative time stays fresh
  // without re-fetching from the server.
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const syncLabel = (() => {
    if (!lastSyncedAt) return "Belum sync";
    const sec = Math.max(0, Math.floor((Date.now() - lastSyncedAt) / 1000));
    if (sec < 5) return "Baru saja";
    if (sec < 60) return `${sec} detik lalu`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} menit lalu`;
    const hr = Math.floor(min / 60);
    return `${hr} jam lalu`;
  })();

  // The actual `.dark` class on <html> is set by the layout's
  // theme-init <Script> (strategy="beforeInteractive") before React
  // hydrates, so it is already correct on first paint. We read the
  // DOM directly at click time — no React state needed for the icon,
  // which eliminates the mount-time flicker you get with a useState
  // default that disagrees with the user's stored preference.
  function toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    const next = !isCurrentlyDark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("fintrack_theme", next ? "dark" : "light");
  }

  function signOut() {
    logout();
    router.push("/login");
  }

  async function handleSync() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const ok = await refreshAll();
      if (ok) toast.success("Data disinkronkan");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <header className="bg-bg-base border-border sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
      <button
        onClick={toggleMobile}
        className="text-text-muted hover:bg-bg-elevated hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:hidden"
        aria-label="Buka menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-text-primary truncate text-[15px] leading-tight font-semibold">
          {title}
        </h1>
        {subtitle && (
          <p className="text-text-muted mt-0.5 truncate text-xs leading-tight">
            {subtitle}
          </p>
        )}
      </div>

      <div className="bg-bg-surface border-border group focus-within:border-primary/50 hidden h-9 w-64 items-center gap-2 rounded-lg border px-3 transition-colors md:flex">
        <Search className="text-text-muted h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          placeholder="Search anything..."
          className="text-text-primary placeholder:text-text-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
          readOnly
        />
        <kbd className="text-text-muted bg-bg-elevated border-border shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1">
        <span
          className="text-text-muted hidden text-xs sm:inline"
          title={
            lastSyncedAt
              ? `Sinkron terakhir: ${new Date(lastSyncedAt).toLocaleTimeString(
                  "id-ID",
                )}`
              : "Belum pernah sinkron"
          }
        >
          {syncLabel}
        </span>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            isSyncing
              ? "text-primary bg-primary/10 cursor-wait"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-primary",
          )}
          aria-label="Sinkronkan data dengan server"
          title="Sinkronkan data dengan server"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
        <button
          className="text-text-muted hover:bg-bg-elevated hover:text-text-primary relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="bg-primary ring-bg-base absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2" />
          )}
        </button>
        <button
          onClick={toggleTheme}
          className="text-text-muted hover:bg-bg-elevated hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="hover:bg-bg-elevated focus-visible:ring-primary/50 ml-1 flex h-9 items-center gap-2 rounded-lg pr-2 pl-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <div className="bg-primary/20 border-primary/30 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
                <span className="text-primary text-xs font-bold">
                  {initials(user?.name)}
                </span>
              </div>
              <span className="text-text-primary hidden max-w-[120px] truncate text-sm leading-none font-medium sm:block">
                {user?.name?.split(" ")[0] ?? "User"}
              </span>
              <ChevronDown className="text-text-muted h-3.5 w-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="bg-bg-surface border-border animate-fade-in z-50 min-w-[220px] rounded-xl border p-1.5 shadow-[0_8px_30px_-4px_rgb(0_0_0/0.5)]"
            >
              <div className="border-border mb-1 border-b px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/20 border-primary/30 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                    <span className="text-primary text-sm font-bold">
                      {initials(user?.name)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-text-primary truncate text-sm font-semibold">
                      {user?.name ?? "User"}
                    </p>
                    <p className="text-text-muted truncate text-xs">
                      {user?.email ?? "user@email.com"}
                    </p>
                  </div>
                </div>
              </div>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="text-text-secondary hover:bg-bg-elevated hover:text-text-primary flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none"
                >
                  <User className="h-3.5 w-3.5 shrink-0" />
                  Profile
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="text-text-secondary hover:bg-bg-elevated hover:text-text-primary flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" />
                  Settings
                </Link>
              </DropdownMenu.Item>
              {user?.role === "admin" && (
                <DropdownMenu.Item asChild>
                  <Link
                    href="/admin"
                    className="text-warning hover:bg-warning/10 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    Admin Panel
                  </Link>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="border-border my-1.5 border-t" />
              <DropdownMenu.Item
                onSelect={signOut}
                className="text-danger hover:bg-danger/10 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export { Topbar };
