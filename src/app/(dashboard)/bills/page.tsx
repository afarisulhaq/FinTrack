"use client";

import { useState, useMemo } from "react";
import {
  Bell, Plus, Trash2, Check, Clock, AlertTriangle, Calendar,
  CheckCircle2, XCircle,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, daysUntil } from "~/lib/utils";
import type { BillStatus } from "~/lib/types";

type StatusFilter = "Semua" | "unpaid" | "paid" | "overdue";

const STATUS_LABELS: Record<BillStatus, string> = {
  unpaid: "Belum Dibayar",
  paid: "Lunas",
  overdue: "Terlambat",
};

export default function BillsPage() {
  const bills = useFinanceStore((s) => s.bills);
  const addBill = useFinanceStore((s) => s.addBill);
  const updateBillStatus = useFinanceStore((s) => s.updateBillStatus);
  const deleteBill = useFinanceStore((s) => s.deleteBill);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "", amount: "", dueDate: "", category: "Utilitas",
    icon: "💰", isRecurring: false, recurringPeriod: "monthly" as "monthly" | "yearly",
  });

  const filtered = useMemo(
    () => statusFilter === "Semua" ? bills : bills.filter((b) => b.status === statusFilter),
    [bills, statusFilter]
  );

  const { unpaidTotal, monthTotal, weekTotal } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return bills.reduce(
      (acc, b) => {
        const due = new Date(b.dueDate);
        return {
          unpaidTotal: acc.unpaidTotal + (b.status !== "paid" ? b.amount : 0),
          monthTotal: acc.monthTotal + (due >= startOfMonth ? b.amount : 0),
          weekTotal: acc.weekTotal + (b.status !== "paid" && due <= endOfWeek && due >= now ? b.amount : 0),
        };
      },
      { unpaidTotal: 0, monthTotal: 0, weekTotal: 0 }
    );
  }, [bills]);

  // Upcoming bills sorted by date
  const upcoming = useMemo(
    () =>
      bills
        .filter((b) => b.status !== "paid")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 8),
    [bills]
  );

  function getDueLabel(dueDate: string, status: BillStatus) {
    if (status === "paid") return { text: "Lunas", color: "text-success" };
    const d = daysUntil(dueDate);
    if (d < 0) return { text: `Terlambat ${Math.abs(d)} hari`, color: "text-danger" };
    if (d === 0) return { text: "Jatuh tempo hari ini", color: "text-warning" };
    if (d <= 7) return { text: `${d} hari lagi`, color: "text-warning" };
    return { text: `${d} hari lagi`, color: "text-text-muted" };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amount || !form.dueDate) return;
    addBill({
      name: form.name,
      amount: parseFloat(form.amount),
      dueDate: new Date(form.dueDate).toISOString(),
      status: "unpaid",
      category: form.category,
      icon: form.icon,
      isRecurring: form.isRecurring,
      recurringPeriod: form.isRecurring ? form.recurringPeriod : undefined,
    });
    setForm({ name: "", amount: "", dueDate: "", category: "Utilitas", icon: "💰", isRecurring: false, recurringPeriod: "monthly" });
    setShowModal(false);
  }

  const fld = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    { key: "unpaid", label: "Belum Dibayar" },
    { key: "paid", label: "Lunas" },
    { key: "overdue", label: "Terlambat" },
  ];

  const CATEGORIES = ["Utilitas", "Hiburan", "Kesehatan", "Asuransi", "Internet", "Tempat Tinggal", "Lainnya"];
  const ICONS = ["⚡", "💧", "🎬", "🎵", "🌐", "🛡️", "💪", "🏥", "🗑️", "🏠", "📱", "💳", "💰"];

  return (
    <PageWrapper
      title="Tagihan"
      subtitle="Kelola tagihan dan pembayaran rutin"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Tambah Tagihan
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Belum Dibayar" value={formatCurrency(unpaidTotal)} icon={<AlertTriangle />} iconColor="#ef4444" />
        <StatCard title="Total Bulan Ini" value={formatCurrency(monthTotal)} icon={<Calendar />} iconColor="#6366f1" />
        <StatCard title="Jatuh Tempo Minggu Ini" value={formatCurrency(weekTotal)} icon={<Clock />} iconColor="#f59e0b" />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bills List */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Status Filter Tabs */}
          <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl w-fit">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === t.key
                    ? "bg-bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {t.label}
                {t.key !== "Semua" && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-bg-base">
                    {bills.filter((b) => b.status === t.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((bill) => {
              const { text: dueText, color: dueColor } = getDueLabel(bill.dueDate, bill.status);
              return (
                <Card key={bill.id} className="group">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center text-2xl">
                      {bill.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-text-primary text-sm">{bill.name}</h3>
                        <Badge
                          variant={bill.status === "paid" ? "success" : bill.status === "overdue" ? "danger" : "warning"}
                          size="sm"
                        >
                          {STATUS_LABELS[bill.status]}
                        </Badge>
                        {bill.isRecurring && (
                          <Badge variant="default" size="sm">
                            {bill.recurringPeriod === "monthly" ? "Bulanan" : "Tahunan"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-text-muted">{bill.category}</span>
                        <span className="text-text-muted">•</span>
                        <span className={dueColor + " font-medium"}>{dueText}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold text-text-primary">{formatCurrency(bill.amount)}</p>
                      <p className="text-[10px] text-text-muted">{formatDate(bill.dueDate)}</p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {bill.status !== "paid" && (
                        <button
                          onClick={() => updateBillStatus(bill.id, "paid")}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                          title="Bayar Sekarang"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteBill(bill.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <Card className="py-12 text-center">
                <Bell className="h-8 w-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">Tidak ada tagihan ditemukan</p>
              </Card>
            )}
          </div>
        </div>

        {/* Upcoming Timeline */}
        <div>
          <Card>
            <CardHeader>
              <span className="text-sm font-semibold text-text-primary">Jadwal Tagihan</span>
              <Badge variant="default" size="sm">30 hari ke depan</Badge>
            </CardHeader>
            <CardBody>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {upcoming.map((bill, idx) => {
                    const days = daysUntil(bill.dueDate);
                    const isOverdue = days < 0;
                    const isUrgent = days >= 0 && days <= 3;
                    return (
                      <div key={bill.id} className="flex items-start gap-3 pl-8 relative">
                        <div
                          className={`absolute left-[11px] w-3 h-3 rounded-full border-2 border-bg-base mt-0.5 ${
                            isOverdue ? "bg-danger" : isUrgent ? "bg-warning" : "bg-primary"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{bill.icon}</span>
                            <span className="text-sm font-medium text-text-primary truncate">{bill.name}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-xs font-medium ${isOverdue ? "text-danger" : isUrgent ? "text-warning" : "text-text-muted"}`}>
                              {isOverdue ? `Terlambat ${Math.abs(days)} hr` : days === 0 ? "Hari ini" : `${days} hari lagi`}
                            </span>
                            <span className="text-xs font-semibold text-text-primary">{formatCurrency(bill.amount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {upcoming.length === 0 && (
                    <p className="pl-8 text-sm text-text-muted">Semua tagihan sudah dibayar 🎉</p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Add Bill Modal ──────────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Tambah Tagihan Baru">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nama Tagihan" placeholder="cth. PLN Listrik" value={form.name} onChange={(e) => fld("name", e.target.value)} required />
            <Input label="Jumlah (Rp)" type="number" placeholder="0" value={form.amount} onChange={(e) => fld("amount", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tanggal Jatuh Tempo" type="date" value={form.dueDate} onChange={(e) => fld("dueDate", e.target.value)} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Kategori</label>
              <select value={form.category} onChange={(e) => fld("category", e.target.value)}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Ikon (Emoji)</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => fld("icon", icon)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                    form.icon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-bg-elevated hover:bg-bg-elevated/80"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
            <div>
              <p className="text-sm font-medium text-text-primary">Tagihan Berulang</p>
              <p className="text-xs text-text-muted">Otomatis muncul setiap periode</p>
            </div>
            <button
              type="button"
              onClick={() => fld("isRecurring", !form.isRecurring)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isRecurring ? "bg-primary" : "bg-bg-base"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.isRecurring ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {form.isRecurring && (
            <div className="flex gap-2">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => fld("recurringPeriod", p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.recurringPeriod === p ? "bg-primary text-white" : "bg-bg-elevated text-text-secondary"
                  }`}
                >
                  {p === "monthly" ? "Bulanan" : "Tahunan"}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit">Simpan Tagihan</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
