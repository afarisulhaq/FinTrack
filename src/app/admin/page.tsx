"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeftRight,
  Server,
  Users,
  Settings,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "~/components/ui/card";
import { StatCard } from "~/components/ui/stat-card";
import { Badge } from "~/components/ui/badge";
import { useAuthStore } from "~/store/useAuthStore";
import { api } from "~/lib/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "owner" | "member";
  status: "active" | "inactive" | "pending";
  createdAt: string;
}

interface BotStatus {
  ok: boolean;
  status: string;
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateID(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function AdminDashboardPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [whatsapp, setWhatsapp] = useState<BotStatus | null>(null);
  const [telegram, setTelegram] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        // Fan out: users + transactions + bot status. Each is
        // independent so a failure on one doesn't take the others
        // down. The dashboard degrades to a partial view if a
        // single endpoint is down.
        const [usersResult, txResult, botResult] = await Promise.allSettled([
          api.get<AdminUser[]>("/users", token),
          api.get<unknown[]>("/transactions", token),
          api.get<{ whatsapp: { status: string }; telegram: { status: string } }>(
            "/bot/status",
            token,
          ),
        ]);

        if (cancelled) return;

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value);
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }

        if (txResult.status === "fulfilled") {
          setTxCount(txResult.value.length);
        } else {
          setTxCount(null);
        }

        if (botResult.status === "fulfilled") {
          const w = botResult.value.whatsapp?.status ?? "unknown";
          const t = botResult.value.telegram?.status ?? "unknown";
          setWhatsapp({ ok: w === "connected", status: humanize(w) });
          setTelegram({ ok: t === "connected", status: humanize(t) });
        } else {
          setWhatsapp({ ok: false, status: "Tidak diketahui" });
          setTelegram({ ok: false, status: "Tidak diketahui" });
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Gagal memuat dashboard",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── Derived stats ──────────────────────────────────────────────────
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const now = startOfDay(new Date());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = users.filter((u) => {
    const d = new Date(u.createdAt);
    return d >= monthStart;
  }).length;
  const activePercent =
    totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

  // Registrasi per hari, 7 hari terakhir (termasuk hari ini).
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(daysAgo(6 - i));
    const dayEnd = new Date(day);
    dayEnd.setDate(day.getDate() + 1);
    const count = users.filter((u) => {
      const d = new Date(u.createdAt);
      return d >= day && d < dayEnd;
    }).length;
    return {
      day: DAY_LABELS[day.getDay()],
      users: count,
    };
  });

  const recentUsers = users
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-text-muted text-sm">
          Selamat datang, {user?.name ?? "Admin"}
          {loading && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              memuat data…
            </span>
          )}
        </p>
      </div>

      {loadError && (
        <div className="border-warning/30 bg-warning/10 text-text-secondary rounded-xl border px-4 py-2.5 text-sm">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Pengguna"
          value={loading ? "…" : formatNumber(totalUsers)}
          subtitle={
            loading
              ? "…"
              : `+${formatNumber(newThisMonth)} bulan ini`
          }
          icon={<Users className="h-5 w-5" />}
          iconColor="#f59e0b"
        />
        <StatCard
          title="Pengguna Aktif"
          value={loading ? "…" : formatNumber(activeUsers)}
          subtitle={
            loading ? "…" : `${activePercent}% dari total`
          }
          icon={<Activity className="h-5 w-5" />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Total Transaksi"
          value={
            txCount === null
              ? "—"
              : loading
                ? "…"
                : formatNumber(txCount)
          }
          subtitle={txCount === null ? "tidak tersedia" : "Semua pengguna"}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconColor="#6366f1"
        />
        <StatCard
          title="API Server"
          value={
            apiOnline === null
              ? "—"
              : apiOnline
                ? "Online"
                : "Offline"
          }
          subtitle={
            apiOnline === null
              ? "memeriksa…"
              : apiOnline
                ? "Respons terakhir OK"
                : "Gagal merespons"
          }
          icon={<Server className="h-5 w-5" />}
          iconColor="#38bdf8"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <h3 className="font-semibold">Registrasi 7 Hari Terakhir</h3>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7}>
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1d27",
                      border: "1px solid #2d3148",
                      borderRadius: 12,
                    }}
                  />
                  <Bar
                    dataKey="users"
                    fill="#f59e0b"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">System Health</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <HealthRow
                name="API Server"
                status={apiOnline === null ? "Memeriksa…" : apiOnline ? "Online" : "Offline"}
                ok={apiOnline === true}
              />
              <HealthRow
                name="Database"
                status={
                  apiOnline === null
                    ? "Memeriksa…"
                    : totalUsers > 0 || users.length === 0
                      ? "Online"
                      : "Tidak diketahui"
                }
                ok={apiOnline === true}
              />
              <HealthRow
                name="WhatsApp Bot"
                status={whatsapp?.status ?? "Memeriksa…"}
                ok={whatsapp?.ok ?? false}
              />
              <HealthRow
                name="Telegram Bot"
                status={telegram?.status ?? "Memeriksa…"}
                ok={telegram?.ok ?? false}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <h3 className="font-semibold">Registrasi Terbaru</h3>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="text-text-muted flex items-center gap-2 py-6 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat…
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-text-muted py-6 text-sm">
                Belum ada pengguna terdaftar. Setelah admin menyetujui
                pendaftaran baru, mereka akan muncul di sini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-text-muted border-b text-left">
                      <th className="py-3">Nama</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Bergabung</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-border/60 border-b"
                      >
                        <td className="py-3 font-medium">{u.name}</td>
                        <td className="text-text-muted">{u.email}</td>
                        <td className="capitalize">{u.role}</td>
                        <td className="text-text-muted">
                          {formatDateID(u.createdAt)}
                        </td>
                        <td>
                          <Badge
                            variant={
                              u.status === "active"
                                ? "success"
                                : u.status === "pending"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {u.status === "active"
                              ? "Aktif"
                              : u.status === "pending"
                                ? "Menunggu"
                                : "Nonaktif"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Quick Links</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <Link
                href="/admin/users"
                className="border-warning/20 text-warning bg-warning/10 flex items-center gap-3 rounded-xl border p-4"
              >
                <UserPlus className="h-5 w-5" />
                Manajemen User
              </Link>
              <Link
                href="/admin/app-settings"
                className="border-border text-text-secondary hover:text-text-primary bg-bg-elevated flex items-center gap-3 rounded-xl border p-4"
              >
                <Settings className="h-5 w-5" />
                Pengaturan App
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function humanize(status: string): string {
  switch (status) {
    case "connected":
      return "Terhubung";
    case "disconnected":
      return "Terputus";
    case "connecting":
    case "qr_ready":
      return "Menghubungkan";
    case "error":
      return "Error";
    default:
      return "Tidak diketahui";
  }
}

function HealthRow({
  name,
  status,
  ok,
}: {
  name: string;
  status: string;
  ok: boolean;
}) {
  return (
    <div
      className="bg-bg-elevated flex items-center justify-between rounded-lg p-3"
    >
      <span className="text-sm">{name}</span>
      <span className={ok ? "text-success" : "text-warning"}>
        {ok ? (
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
        ) : (
          <AlertTriangle className="mr-1 inline h-4 w-4" />
        )}
        {status}
      </span>
    </div>
  );
}
