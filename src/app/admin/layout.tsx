"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Users,
  Settings,
  ArrowLeft,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useAuthStore } from "~/store/useAuthStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin", icon: BarChart3 },
  { label: "Manajemen User", href: "/admin/users", icon: Users },
  { label: "Pengaturan App", href: "/admin/app-settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, logout } = useAuthStore();
  const { config } = useAppConfigStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) router.replace("/login");
    else if (user?.role !== "admin") router.replace("/dashboard");
  }, [hasHydrated, isAuthenticated, router, user?.role]);

  if (!hasHydrated || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="bg-bg-base text-text-muted flex min-h-screen items-center justify-center">
        Memeriksa akses admin...
      </div>
    );
  }

  function signOut() {
    logout();
    router.push("/login");
  }

  return (
    <div className="bg-bg-base text-text-primary flex min-h-screen">
      <aside className="bg-bg-base border-border fixed top-0 left-0 z-40 flex h-screen w-64 flex-col border-r">
        <div className="border-border flex h-16 items-center gap-3 border-b px-5">
          <div className="bg-warning/15 border-warning/30 flex h-9 w-9 items-center justify-center rounded-xl border">
            <Shield className="text-warning h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">{config.appName} Admin</p>
            <p className="text-text-muted text-[11px]">System Control</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-warning/15 text-warning"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-surface",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="border-border my-3 border-t" />
          <Link
            href="/dashboard"
            className="text-text-muted hover:text-text-primary hover:bg-bg-surface flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke App
          </Link>
        </nav>
        <div className="border-border border-t p-3">
          <div className="bg-bg-surface border-border mb-2 rounded-xl border p-3">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="text-text-muted truncate text-[11px]">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="text-danger hover:bg-danger/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="ml-64 min-h-screen flex-1">
        <header className="border-border bg-bg-base/95 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 backdrop-blur">
          <div>
            <h1 className="text-base font-bold">Admin Panel</h1>
            <p className="text-text-muted text-xs">
              Kelola pengguna, konfigurasi aplikasi, dan sistem.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="bg-bg-surface border-border text-text-secondary hover:text-text-primary rounded-lg border p-2"
            title="Keluar dari Admin"
            aria-label="Keluar dari Admin"
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </header>
        <div className="p-6">{children}</div>
      </main>
      <ConfirmDialog />
    </div>
  );
}
