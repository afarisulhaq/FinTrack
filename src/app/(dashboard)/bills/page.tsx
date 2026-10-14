"use client";

import { useState } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  PartyPopper,
} from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { IconPicker } from "~/components/ui/icon-picker";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { WalletSelect } from "~/components/ui/wallet-select";
import { confirm } from "~/components/ui/confirm-dialog";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { DatePicker } from "~/components/ui/date-picker";
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, daysUntil } from "~/lib/utils";
import type { Bill, BillStatus } from "~/lib/types";

type StatusFilter = "Semua" | "unpaid" | "paid" | "overdue";

const STATUS_LABELS: Record<BillStatus, string> = {
  unpaid: "Belum Dibayar",
  paid: "Lunas",
  overdue: "Terlambat",
};

export default function BillsPage() {
  const [paymentBillId, setPaymentBillId] = useState<string | null>(null);
  const [paymentWalletId, setPaymentWalletId] = useState("");
  const addBill = useFinanceStore((s) => s.addBill);
  const updateBillStatus = useFinanceStore((s) => s.updateBillStatus);
  const deleteBill = useFinanceStore((s) => s.deleteBill);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    walletId: "",
    amount: "",
    dueDate: "",
    category: "Utilitas",
    icon: "Lightbulb",
    isRecurring: false,
    recurringPeriod: "monthly" as "monthly" | "yearly",
  });

  const pager = useServerPagination<Bill, {
    unpaidTotal: number;
    monthTotal: number;
    weekTotal: number;
    counts: Record<string, number>;
  }>("/bills", {
    status: statusFilter === "Semua" ? undefined : statusFilter,
  }, { resource: "bills" });
  const { unpaidTotal, monthTotal, weekTotal } = pager.summary ?? {
    unpaidTotal: 0, monthTotal: 0, weekTotal: 0,
  };
  const upcomingPager = useServerPagination<Bill>(
    "/bills", { view: "upcoming" }, { resource: "bills" },
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
      walletId: form.walletId || undefined,
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
      walletId: "",
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
          icon={<AlertTriangle className="text-danger" />}
        />
        <StatCard
          title="Total Bulan Ini"
          value={formatCurrency(monthTotal)}
          icon={<Calendar className="text-primary" />}
        />
        <StatCard
          title="Jatuh Tempo Minggu Ini"
          value={formatCurrency(weekTotal)}
          icon={<Clock className="text-warning" />}
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
                    {pager.summary?.counts[t.key] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ServerListStatus {...pager} />
          <div className="space-y-3">
            {pager.items.map((bill) => {
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
                      <p className="text-text-primary text-base font-bold tabular-nums">
                        {formatCurrency(bill.amount)}
                      </p>
                      <p className="text-text-muted text-[10px] tabular-nums">
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {(bill.status !== "paid" || !bill.walletId) && (
                        <button
                          onClick={() => {
                            setPaymentWalletId(bill.walletId ?? "");
                            setPaymentBillId(bill.id);
                          }}
                          className="bg-success/10 text-success hover:bg-success/20 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                          title={
                            bill.status === "paid"
                              ? "Catat pembayaran ke dompet"
                              : "Bayar Sekarang"
                          }
                          aria-label={
                            bill.status === "paid"
                              ? "Catat pembayaran ke dompet"
                              : "Bayar Sekarang"
                          }
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Hapus tagihan?",
                              message:
                                "Tagihan dihapus. Pembayaran yang terhubung akan dikembalikan ke saldo dompet.",
                              variant: "danger",
                              confirmText: "Hapus tagihan",
                            })
                          )
                            deleteBill(bill.id);
                        }}
                        className="bg-danger/10 text-danger hover:bg-danger/20 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {pager.total === 0 && !pager.loading && !pager.error && (
              <Card className="py-12 text-center">
                <Bell className="text-text-muted mx-auto mb-3 h-8 w-8" />
                <p className="text-text-muted text-sm">
                  Tidak ada tagihan ditemukan
                </p>
              </Card>
            )}
          </div>
          <Pagination {...pager} label="tagihan" />
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
              <ServerListStatus {...upcomingPager} />
              <div className="relative">
                <div className="bg-border absolute top-0 bottom-0 left-4 w-px" />
                <div className="space-y-4">
                  {upcomingPager.items.map((bill) => {
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
                  {upcomingPager.total === 0 && !upcomingPager.loading && !upcomingPager.error && (
                    <p className="text-text-muted flex items-center gap-1.5 pl-8 text-sm">
                      <PartyPopper className="h-4 w-4" />
                      Semua tagihan sudah dibayar
                    </p>
                  )}
                </div>
              </div>
              <Pagination {...upcomingPager} label="jadwal tagihan" />
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
              currency
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => fld("amount", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Tanggal Jatuh Tempo"
              value={form.dueDate}
              onValueChange={(value) => fld("dueDate", value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Kategori
              </label>
              <select
                value={form.category}
                onChange={(e) => fld("category", e.target.value)}
                className="bg-bg-surface border-border text-text-primary focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <IconPicker
            value={form.icon}
            onChange={(icon) => fld("icon", icon)}
            quickIcons={BILL_ICONS}
          />
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
          <WalletSelect
            value={form.walletId}
            onChange={(value) => fld("walletId", value)}
            label="Dompet pembayaran"
            required={false}
          />
          <p className="text-text-secondary text-xs">
            Saldo berkurang saat pembayaran dicatat.
          </p>
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
      <Modal
        open={!!paymentBillId}
        onClose={() => setPaymentBillId(null)}
        title="Bayar Tagihan"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!paymentBillId || !paymentWalletId) return;
            updateBillStatus(paymentBillId, "paid", paymentWalletId);
            setPaymentBillId(null);
          }}
        >
          <p className="text-text-secondary text-sm">
            {pager.items.find((bill) => bill.id === paymentBillId)?.name} ·{" "}
            {formatCurrency(
              pager.items.find((bill) => bill.id === paymentBillId)?.amount ?? 0,
            )}
            . Saldo dompet akan berkurang sebesar tagihan.
          </p>
          <WalletSelect
            value={paymentWalletId}
            onChange={setPaymentWalletId}
            label="Dompet pembayaran"
          />
          <Button type="submit" disabled={!paymentWalletId}>
            Catat Pembayaran
          </Button>
        </form>
      </Modal>
    </PageWrapper>
  );
}
