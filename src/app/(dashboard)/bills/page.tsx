"use client";

import { useState, useMemo } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
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
    name: "",
    amount: "",
    dueDate: "",
    category: "Utilitas",
    icon: "Lightbulb",
    isRecurring: false,
    recurringPeriod: "monthly" as "monthly" | "yearly",
  });

  const filtered = useMemo(
    () =>
      statusFilter === "Semua"
        ? bills
        : bills.filter((b) => b.status === statusFilter),
    [bills, statusFilter],
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
          weekTotal:
            acc.weekTotal +
            (b.status !== "paid" && due <= endOfWeek && due >= now
              ? b.amount
              : 0),
        };
      },
      { unpaidTotal: 0, monthTotal: 0, weekTotal: 0 },
    );
  }, [bills]);

  // Upcoming bills sorted by date
  const upcoming = useMemo(
    () =>
      bills
        .filter((b) => b.status !== "paid")
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        )
        .slice(0, 8),
    [bills],
  );

  function getDueLabel(dueDate: string, status: BillStatus) {
    if (status === "paid") return { text: "Lunas", color: "text-success" };
    const d = daysUntil(dueDate);
    if (d < 0)
      return { text: `Terlambat ${Math.abs(d)} hari`, color: "text-danger" };
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
    setForm({
      name: "",
      amount: "",
      dueDate: "",
      category: "Utilitas",
      icon: "Lightbulb",
      isRecurring: false,
      recurringPeriod: "monthly",
    });
    setShowModal(false);
  }

  const fld = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    { key: "unpaid", label: "Belum Dibayar" },
    { key: "paid", label: "Lunas" },
    { key: "overdue", label: "Terlambat" },
  ];

  const CATEGORIES = [
    "Utilitas",
    "Hiburan",
    "Kesehatan",
    "Asuransi",
    "Internet",
    "Tempat Tinggal",
    "Lainnya",
  ];
  const BILL_ICONS = [
    "Lightbulb",
    "Wifi",
    "Droplets",
    "Flame",
    "Smartphone",
    "Home",
    "Car",
    "CreditCard",
    "GraduationCap",
    "Shield",
  ];

  return (
    <PageWrapper
      title="Tagihan"
      subtitle="Kelola tagihan dan pembayaran rutin"
      actions={
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowModal(true)}
        >
          Tambah Tagihan
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Belum Dibayar"
          value={formatCurrency(unpaidTotal)}
          icon={<AlertTriangle />}
          iconColor="#ef4444"
        />
        <StatCard
          title="Total Bulan Ini"
          value={formatCurrency(monthTotal)}
          icon={<Calendar />}
          iconColor="#FFD147"
        />
        <StatCard
          title="Jatuh Tempo Minggu Ini"
          value={formatCurrency(weekTotal)}
          icon={<Clock />}
          iconColor="#f59e0b"
        />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Bills List */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {/* Status Filter Tabs */}
          <div className="bg-bg-elevated flex w-fit gap-1 rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === t.key
                    ? "bg-bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {t.label}
                {t.key !== "Semua" && (
                  <span className="bg-bg-base ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]">
                    {bills.filter((b) => b.status === t.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((bill) => {
              const { text: dueText, color: dueColor } = getDueLabel(
                bill.dueDate,
                bill.status,
              );
              return (
                <Card key={bill.id} className="group">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="bg-bg-elevated text-text-secondary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                      <DynamicIcon name={bill.icon} className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <h3 className="text-text-primary text-sm font-semibold">
                          {bill.name}
                        </h3>
                        <Badge
                          variant={
                            bill.status === "paid"
                              ? "success"
                              : bill.status === "overdue"
                                ? "danger"
                                : "warning"
                          }
                          size="sm"
                        >
                          {STATUS_LABELS[bill.status]}
                        </Badge>
                        {bill.isRecurring && (
                          <Badge variant="default" size="sm">
                            {bill.recurringPeriod === "monthly"
                              ? "Bulanan"
                              : "Tahunan"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-text-muted">{bill.category}</span>
                        <span className="text-text-muted">•</span>
                        <span className={dueColor + " font-medium"}>
                          {dueText}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="shrink-0 text-right">
                      <p className="text-text-primary text-base font-bold">
                        {formatCurrency(bill.amount)}
                      </p>
                      <p className="text-text-muted text-[10px]">
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {bill.status !== "paid" && (
                        <button
                          onClick={() => updateBillStatus(bill.id, "paid")}
                          className="bg-success/10 text-success hover:bg-success/20 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                          title="Bayar Sekarang"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteBill(bill.id)}
                        className="bg-danger/10 text-danger hover:bg-danger/20 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
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
                <Bell className="text-text-muted mx-auto mb-3 h-8 w-8" />
                <p className="text-text-muted text-sm">
                  Tidak ada tagihan ditemukan
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Upcoming Timeline */}
        <div>
          <Card>
            <CardHeader>
              <span className="text-text-primary text-sm font-semibold">
                Jadwal Tagihan
              </span>
              <Badge variant="default" size="sm">
                30 hari ke depan
              </Badge>
            </CardHeader>
            <CardBody>
              <div className="relative">
                <div className="bg-border absolute top-0 bottom-0 left-4 w-px" />
                <div className="space-y-4">
                  {upcoming.map((bill, idx) => {
                    const days = daysUntil(bill.dueDate);
                    const isOverdue = days < 0;
                    const isUrgent = days >= 0 && days <= 3;
                    return (
                      <div
                        key={bill.id}
                        className="relative flex items-start gap-3 pl-8"
                      >
                        <div
                          className={`border-bg-base absolute left-[11px] mt-0.5 h-3 w-3 rounded-full border-2 ${
                            isOverdue
                              ? "bg-danger"
                              : isUrgent
                                ? "bg-warning"
                                : "bg-primary"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-text-secondary">
                              <DynamicIcon
                                name={bill.icon}
                                className="h-4 w-4"
                              />
                            </span>
                            <span className="text-text-primary truncate text-sm font-medium">
                              {bill.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between">
                            <span
                              className={`text-xs font-medium ${isOverdue ? "text-danger" : isUrgent ? "text-warning" : "text-text-muted"}`}
                            >
                              {isOverdue
                                ? `Terlambat ${Math.abs(days)} hr`
                                : days === 0
                                  ? "Hari ini"
                                  : `${days} hari lagi`}
                            </span>
                            <span className="text-text-primary text-xs font-semibold">
                              {formatCurrency(bill.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {upcoming.length === 0 && (
                    <p className="text-text-muted pl-8 text-sm">
                      Semua tagihan sudah dibayar 🎉
                    </p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Add Bill Modal ──────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tambah Tagihan Baru"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Tagihan"
              placeholder="cth. PLN Listrik"
              value={form.name}
              onChange={(e) => fld("name", e.target.value)}
              required
            />
            <Input
              label="Jumlah (Rp)"
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => fld("amount", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tanggal Jatuh Tempo"
              type="date"
              value={form.dueDate}
              onChange={(e) => fld("dueDate", e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Kategori
              </label>
              <select
                value={form.category}
                onChange={(e) => fld("category", e.target.value)}
                className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Ikon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BILL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => fld("icon", icon)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                    form.icon === icon
                      ? "bg-primary/20 ring-primary text-primary ring-2"
                      : "bg-bg-elevated hover:bg-bg-elevated/80 text-text-secondary"
                  }`}
                >
                  <DynamicIcon name={icon} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="text-text-primary text-sm font-medium">
                Tagihan Berulang
              </p>
              <p className="text-text-muted text-xs">
                Otomatis muncul setiap periode
              </p>
            </div>
            <button
              type="button"
              onClick={() => fld("isRecurring", !form.isRecurring)}
              className={`relative h-5 w-10 rounded-full transition-colors ${form.isRecurring ? "bg-primary" : "bg-bg-base"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.isRecurring ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          {form.isRecurring && (
            <div className="flex gap-2">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => fld("recurringPeriod", p)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    form.recurringPeriod === p
                      ? "bg-primary text-white"
                      : "bg-bg-elevated text-text-secondary"
                  }`}
                >
                  {p === "monthly" ? "Bulanan" : "Tahunan"}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button type="submit">Simpan Tagihan</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
