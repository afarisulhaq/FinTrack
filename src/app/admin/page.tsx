"use client";

import Link from "next/link";
import { Activity, ArrowLeftRight, Server, Users, Settings, UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "~/components/ui/card";
import { StatCard } from "~/components/ui/stat-card";
import { Badge } from "~/components/ui/badge";
import { useAuthStore } from "~/store/useAuthStore";

const activityData = [
  { day: "Sen", users: 31 }, { day: "Sel", users: 43 }, { day: "Rab", users: 38 }, { day: "Kam", users: 52 }, { day: "Jum", users: 47 }, { day: "Sab", users: 29 }, { day: "Min", users: 34 },
];

const recentUsers = [
  ["Rina Maharani", "rina@email.com", "Owner", "07 Jun 2026", "Aktif"],
  ["Fajar Nugroho", "fajar@email.com", "Member", "06 Jun 2026", "Aktif"],
  ["Dewi Anggraini", "dewi@email.com", "Owner", "05 Jun 2026", "Aktif"],
  ["Agus Saputra", "agus@email.com", "Member", "04 Jun 2026", "Nonaktif"],
  ["Maya Lestari", "maya@email.com", "Owner", "03 Jun 2026", "Aktif"],
];

export default function AdminDashboardPage() {
  const user = useAuthStore((state) => state.user);
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Admin Dashboard</h2><p className="text-text-muted text-sm">Selamat datang, {user?.name}</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Pengguna" value="127" subtitle="+12 bulan ini" icon={<Users className="h-5 w-5" />} iconColor="#f59e0b" />
        <StatCard title="Aktif Hari Ini" value="43" subtitle="33.8% dari total" icon={<Activity className="h-5 w-5" />} iconColor="#22c55e" />
        <StatCard title="Total Transaksi" value="4.821" subtitle="Semua pengguna" icon={<ArrowLeftRight className="h-5 w-5" />} iconColor="#6366f1" />
        <StatCard title="Uptime Sistem" value="99.8%" subtitle="30 hari terakhir" icon={<Server className="h-5 w-5" />} iconColor="#38bdf8" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2"><CardHeader><h3 className="font-semibold">User Activity 7 Hari</h3></CardHeader><CardBody><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityData}><XAxis dataKey="day" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12 }} /><Bar dataKey="users" fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">System Health</h3></CardHeader><CardBody><div className="space-y-3">{[["Database", "Online", true], ["API Server", "Online", true], ["WhatsApp Bot", "Degraded", false], ["Telegram Bot", "Online", true]].map(([name, status, ok]) => <div key={String(name)} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated"><span className="text-sm">{name}</span><span className={ok ? "text-success" : "text-warning"}>{ok ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}{status}</span></div>)}</div></CardBody></Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2"><CardHeader><h3 className="font-semibold">Registrasi Terbaru</h3></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-text-muted border-b border-border"><th className="py-3">Nama</th><th>Email</th><th>Role</th><th>Bergabung</th><th>Status</th></tr></thead><tbody>{recentUsers.map((row) => <tr key={row[1]} className="border-b border-border/60"><td className="py-3 font-medium">{row[0]}</td><td className="text-text-muted">{row[1]}</td><td>{row[2]}</td><td className="text-text-muted">{row[3]}</td><td><Badge variant={row[4] === "Aktif" ? "success" : "default"}>{row[4]}</Badge></td></tr>)}</tbody></table></div></CardBody></Card>
        <Card><CardHeader><h3 className="font-semibold">Quick Links</h3></CardHeader><CardBody><div className="space-y-3"><Link href="/admin/users" className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20 text-warning"><UserPlus className="h-5 w-5" />Manajemen User</Link><Link href="/admin/app-settings" className="flex items-center gap-3 p-4 rounded-xl bg-bg-elevated border border-border text-text-secondary hover:text-text-primary"><Settings className="h-5 w-5" />Pengaturan App</Link></div></CardBody></Card>
      </div>
    </div>
  );
}
