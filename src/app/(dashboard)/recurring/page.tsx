"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Calendar,
  TrendingDown,
  TrendingUp,
  Activity,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, cn } from "~/lib/utils";
import type {
  RecurringTransaction,
  RecurringPeriod,
  TransactionType,
  Wallet,
} from "~/lib/types";

// ─── Category definitions (matches transactions page) ─────────────────────────

interface CategoryOption {
  name: string;
  icon: string;
  color: string;
}

const INCOME_CATEGORIES: CategoryOption[] = [
  { name: "Gaji", icon: "💼", color: "#22c55e" },
  { name: "Freelance", icon: "💻", color: "#06b6d4" },
  { name: "Investasi", icon: "📈", color: "#a855f7" },
  { name: "Hadiah", icon: "🎁", color: "#f59e0b" },
  { name: "Lainnya", icon: "➕", color: "#94a3b8" },
];

const EXPENSE_CATEGORIES: CategoryOption[] = [
  { name: "Makan", icon: "🍔", color: "#f97316" },
  { name: "Transport", icon: "🚗", color: "#3b82f6" },
  { name: "Belanja", icon: "🛍️", color: "#a855f7" },
  { name: "Hiburan", icon: "🎬", color: "#ec4899" },
  { name: "Kesehatan", icon: "🏥", color: "#22c55e" },
  { name: "Tagihan", icon: "💡", color: "#6366f1" },
  { name: "Kopi", icon: "☕", color: "#d97706" },
  { name: "Lainnya", icon: "➕", color: "#94a3b8" },
];

const TRANSFER_CATEGORIES: CategoryOption[] = [
  { name: "Transfer", icon: "🔄", color: "#6366f1" },
];

function getCategoriesByType(type: TransactionType): CategoryOption[] {
  if (type === "income") return INCOME_CATEGORIES;
  if (type === "expense") return EXPENSE_CATEGORIES;
  return TRANSFER_CATEGORIES;
}

const CATEGORY_COLORS: Record<string, string> = {
  Gaji: "#22c55e",
  Freelance: "#06b6d4",
  Investasi: "#a855f7",
  Hadiah: "#f59e0b",
  Makan: "#f97316",
  Transport: "#3b82f6",
  Belanja: "#a855f7",
  Hiburan: "#ec4899",
  Kesehatan: "#22c55e",
  Tagihan: "#6366f1",
  Kopi: "#d97706",
  Transfer: "#6366f1",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#6366f1";
}

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<RecurringPeriod, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

function toMonthly(amount: number, period: RecurringPeriod): number {
  if (period === "daily") return amount * 30;
  if (period === "weekly") return amount * 4.33;
  if (period === "monthly") return amount;
  if (period === "yearly") return amount / 12;
  return amount;
}

// ─── Wallet flattener ─────────────────────────────────────────────────────────

function flattenWallets(wallets: Wallet[]): Wallet[] {
  const seen = new Set<string>();
  const result: Wallet[] = [];
  function visit(w: Wallet) {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    result.push(w);
    w.children?.forEach(visit);
  }
  wallets.forEach(visit);
  return result;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full",
        "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        checked ? "bg-success" : "bg-border"
      )}
    >
      <span
        className={cn(
          "inline-block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-1"
        )}
      />
    </button>
  );
}

// ─── Form types ───────────────────────────────────────────────────────────────

interface RecurringForm {
  name: string;
  type: TransactionType;
  amount: string;
  category: string;
  categoryIcon: string;
  walletId: string;
  period: RecurringPeriod;
  nextDate: string;
  isActive: boolean;
}

const DEFAULT_FORM: RecurringForm = {
  name: "",
  type: "expense",
  amount: "",
  category: "Makan",
  categoryIcon: "🍔",
  walletId: "",
  period: "monthly",
  nextDate: new Date().toISOString().split("T")[0],
  isActive: true,
};

// ─── Filter type ──────────────────────────────────────────────────────────────

type FilterTab =
  | "Semua"
  | "Aktif"
  | "Nonaktif"
  | "Pengeluaran"
  | "Pemasukan";

const FILTER_TABS: FilterTab[] = [
  "Semua",
  "Aktif",
  "Nonaktif",
  "Pengeluaran",
  "Pemasukan",
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const recurringTransactions = useFinanceStore(
    (s) => s.recurringTransactions
  );
  const wallets = useFinanceStore((s) => s.wallets);
  const addRecurringTransaction = useFinanceStore(
    (s) => s.addRecurringTransaction
  );
  const updateRecurringTransaction = useFinanceStore(
    (s) => s.updateRecurringTransaction
  );
  const toggleRecurringTransaction = useFinanceStore(
    (s) => s.toggleRecurringTransaction
  );
  const deleteRecurringTransaction = useFinanceStore(
    (s) => s.deleteRecurringTransaction
  );

  // ── Local state ────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterTab>("Semua");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringForm>(DEFAULT_FORM);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const allWallets = useMemo(() => flattenWallets(wallets), [wallets]);

  const walletMap = useMemo(
    () => new Map(allWallets.map((w) => [w.id, w.name])),
    [allWallets]
  );

  function fld<K extends keyof RecurringForm>(k: K, v: RecurringForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let monthlyExpense = 0;
    let monthlyIncome = 0;
    let activeCount = 0;

    for (const rt of recurringTransactions) {
      if (rt.isActive) {
        activeCount++;
        const m = toMonthly(rt.amount, rt.period);
        if (rt.type === "expense") monthlyExpense += m;
        else if (rt.type === "income") monthlyIncome += m;
      }
    }

    return { monthlyExpense, monthlyIncome, activeCount };
  }, [recurringTransactions]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return recurringTransactions.filter((rt) => {
      if (activeFilter === "Aktif") return rt.isActive;
      if (activeFilter === "Nonaktif") return !rt.isActive;
      if (activeFilter === "Pengeluaran") return rt.type === "expense";
      if (activeFilter === "Pemasukan") return rt.type === "income";
      return true;
    });
  }, [recurringTransactions, activeFilter]);

  // ── Calendar data (group by week in current month) ─────────────────────────
  const calendarData = useMemo(() => {
    interface CalItem {
      id: string;
      name: string;
      amount: number;
      type: TransactionType;
      day: number;
    }

    const active = recurringTransactions.filter((rt) => rt.isActive);
    const items: CalItem[] = active.map((rt) => ({
      id: rt.id,
      name: rt.name,
      amount: rt.amount,
      type: rt.type,
      day: new Date(rt.nextDate).getDate(),
    }));

    items.sort((a, b) => a.day - b.day);

    const byWeek: Record<number, CalItem[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const item of items) {
      const week = Math.min(Math.ceil(item.day / 7), 4) as 1 | 2 | 3 | 4;
      byWeek[week].push(item);
    }

    const monthlyNetExpense = active
      .filter((rt) => rt.type === "expense")
      .reduce((s, rt) => s + toMonthly(rt.amount, rt.period), 0);
    const monthlyNetIncome = active
      .filter((rt) => rt.type === "income")
      .reduce((s, rt) => s + toMonthly(rt.amount, rt.period), 0);

    return { byWeek, monthlyNetExpense, monthlyNetIncome };
  }, [recurringTransactions]);

  // ── Modal handlers ─────────────────────────────────────────────────────────
  function openAddModal() {
    const firstWallet = allWallets[0];
    setForm({
      ...DEFAULT_FORM,
      walletId: firstWallet?.id ?? "",
      nextDate: new Date().toISOString().split("T")[0],
    });
    setEditingId(null);
    setShowModal(true);
  }

  function openEditModal(rt: RecurringTransaction) {
    setForm({
      name: rt.name,
      type: rt.type,
      amount: String(rt.amount),
      category: rt.category,
      categoryIcon: rt.categoryIcon,
      walletId: rt.walletId,
      period: rt.period,
      nextDate: rt.nextDate.split("T")[0],
      isActive: rt.isActive,
    });
    setEditingId(rt.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function handleTypeChange(t: TransactionType) {
    const cats = getCategoriesByType(t);
    setForm((prev) => ({
      ...prev,
      type: t,
      category: cats[0].name,
      categoryIcon: cats[0].icon,
    }));
  }

  function handleCategorySelect(cat: CategoryOption) {
    fld("category", cat.name);
    fld("categoryIcon", cat.icon);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amount) || amount <= 0 || !form.walletId)
      return;

    const payload = {
      name: form.name.trim(),
      type: form.type,
      amount,
      category: form.category,
      categoryIcon: form.categoryIcon,
      walletId: form.walletId,
      period: form.period,
      nextDate: new Date(form.nextDate).toISOString(),
      isActive: form.isActive,
    };

    if (editingId) {
      updateRecurringTransaction(editingId, payload);
    } else {
      addRecurringTransaction(payload);
    }
    closeModal();
  }

  function handleDelete(id: string) {
    deleteRecurringTransaction(id);
    setConfirmDeleteId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentMonthName = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <PageWrapper
      title="Transaksi Berulang"
      subtitle="Kelola pendapatan & pengeluaran rutin kamu"
      actions={
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openAddModal}
        >
          Tambah
        </Button>
      }
    >
      {/* ══ Section 1: Summary StatCards ════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Pengeluaran Bulanan"
          value={formatCurrency(stats.monthlyExpense, true)}
          subtitle="Estimasi per bulan"
          icon={<TrendingDown className="w-5 h-5" />}
          iconColor="#ef4444"
        />
        <StatCard
          title="Pemasukan Bulanan"
          value={formatCurrency(stats.monthlyIncome, true)}
          subtitle="Estimasi per bulan"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Aktif / Total"
          value={`${stats.activeCount} / ${recurringTransactions.length}`}
          subtitle="Transaksi berulang"
          icon={<Activity className="w-5 h-5" />}
          iconColor="#6366f1"
        />
      </div>

      {/* ══ Section 2: Filter Tabs ═══════════════════════════════════════════ */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
              activeFilter === tab
                ? "bg-primary text-white shadow-sm"
                : "bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/40"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ══ Section 3: Recurring List ════════════════════════════════════════ */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <RefreshCw className="w-10 h-10 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">
                Belum ada transaksi berulang
              </p>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={openAddModal}
              >
                Tambah Sekarang
              </Button>
            </div>
          </Card>
        ) : (
          filtered.map((rt) => {
            const catColor = getCategoryColor(rt.category);
            const walletName = walletMap.get(rt.walletId) ?? rt.walletId;
            const isConfirmDelete = confirmDeleteId === rt.id;

            return (
              <div
                key={rt.id}
                className={cn(
                  "bg-bg-surface border rounded-xl p-4 transition-all duration-150",
                  rt.isActive ? "border-border" : "border-border/50 opacity-60"
                )}
              >
                {!isConfirmDelete ? (
                  <div className="flex items-center gap-3">
                    {/* Category icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: `${catColor}18` }}
                    >
                      {rt.categoryIcon}
                    </div>

                    {/* Name + details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-text-primary text-sm">
                          {rt.name}
                        </span>
                        <Badge variant="default" size="sm">
                          {PERIOD_LABELS[rt.period]}
                        </Badge>
                        {!rt.isActive && (
                          <Badge variant="danger" size="sm">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            rt.type === "income"
                              ? "text-success"
                              : rt.type === "expense"
                                ? "text-danger"
                                : "text-primary"
                          )}
                        >
                          {rt.type === "income" ? "+" : "-"}
                          {formatCurrency(rt.amount, true)}
                        </span>
                        <span className="text-xs text-text-muted">
                          {walletName}
                        </span>
                      </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-xs text-text-muted whitespace-nowrap">
                        Berikutnya:{" "}
                        <span className="text-text-secondary font-medium">
                          {formatDate(rt.nextDate, "short")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={rt.isActive}
                          onChange={() => toggleRecurringTransaction(rt.id)}
                        />
                        <button
                          onClick={() => openEditModal(rt)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(rt.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Inline delete confirmation */
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-text-primary">
                      Yakin hapus{" "}
                      <span className="font-semibold">{rt.name}</span>?
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(rt.id)}
                      >
                        Ya, Hapus
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ══ Section 4: Calendar Preview ══════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-text-primary">
              Kalender {currentMonthName}
            </h3>
          </div>
        </CardHeader>
        <CardBody>
          {([1, 2, 3, 4] as const).every(
            (w) => calendarData.byWeek[w].length === 0
          ) ? (
            <p className="text-sm text-text-muted text-center py-6">
              Tidak ada transaksi berulang aktif bulan ini
            </p>
          ) : (
            <div className="space-y-4">
              {([1, 2, 3, 4] as const).map((week) => {
                const items = calendarData.byWeek[week];
                if (items.length === 0) return null;
                const startDay = (week - 1) * 7 + 1;
                const endDay = week * 7;

                return (
                  <div key={week}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                        Minggu {week}
                      </span>
                      <span className="text-xs text-text-muted">
                        (Tgl {startDay}–{endDay})
                      </span>
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-bg-elevated"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                item.type === "income"
                                  ? "bg-success"
                                  : item.type === "expense"
                                    ? "bg-danger"
                                    : "bg-primary"
                              )}
                            />
                            <span className="text-sm text-text-primary truncate">
                              {item.name}
                            </span>
                            <span className="text-xs text-text-muted shrink-0">
                              tgl {item.day}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-semibold shrink-0 tabular-nums",
                              item.type === "income"
                                ? "text-success"
                                : "text-danger"
                            )}
                          >
                            {item.type === "income" ? "+" : "-"}
                            {formatCurrency(item.amount, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Monthly total */}
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-secondary">
                  Total Estimasi Bulan Ini
                </span>
                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-xs text-text-muted">Pengeluaran</div>
                    <div className="text-sm font-bold text-danger">
                      -{formatCurrency(calendarData.monthlyNetExpense, true)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-muted">Pemasukan</div>
                    <div className="text-sm font-bold text-success">
                      +{formatCurrency(calendarData.monthlyNetIncome, true)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ══ Add / Edit Modal ═════════════════════════════════════════════════ */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit Transaksi Berulang" : "Tambah Transaksi Berulang"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <Input
            label="Nama"
            placeholder="Contoh: Bayar Netflix"
            value={form.name}
            onChange={(e) => fld("name", e.target.value)}
            required
          />

          {/* Type toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Tipe</span>
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(
                [
                  { key: "expense" as TransactionType, label: "Pengeluaran" },
                  { key: "income" as TransactionType, label: "Pemasukan" },
                  { key: "transfer" as TransactionType, label: "Transfer" },
                ] as { key: TransactionType; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChange(key)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium transition-colors duration-150",
                    form.type === key
                      ? key === "income"
                        ? "bg-success text-white"
                        : key === "expense"
                          ? "bg-danger text-white"
                          : "bg-primary text-white"
                      : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <Input
            label="Jumlah (Rp)"
            type="number"
            placeholder="0"
            min={0}
            value={form.amount}
            onChange={(e) => fld("amount", e.target.value)}
            required
          />

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">
              Kategori
            </span>
            <div className="flex flex-wrap gap-2">
              {getCategoriesByType(form.type).map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150",
                    form.category === cat.name
                      ? "border-transparent text-white"
                      : "bg-bg-elevated border-border text-text-secondary hover:text-text-primary"
                  )}
                  style={
                    form.category === cat.name
                      ? { backgroundColor: cat.color }
                      : undefined
                  }
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">
              Dompet
            </span>
            <select
              value={form.walletId}
              onChange={(e) => fld("walletId", e.target.value)}
              required
              className={cn(
                "w-full h-10 px-3 rounded-lg border text-sm",
                "bg-bg-surface border-border text-text-primary",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "transition-all duration-200"
              )}
            >
              <option value="" disabled>
                Pilih dompet…
              </option>
              {allWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">
              Periode
            </span>
            <div className="grid grid-cols-4 gap-2">
              {(
                ["daily", "weekly", "monthly", "yearly"] as RecurringPeriod[]
              ).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => fld("period", p)}
                  className={cn(
                    "py-2 rounded-lg text-sm font-medium border transition-all duration-150",
                    form.period === p
                      ? "bg-primary border-primary text-white"
                      : "bg-bg-elevated border-border text-text-secondary hover:text-text-primary hover:border-primary/40"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Next date */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">
              Tanggal Pertama / Berikutnya
            </span>
            <input
              type="date"
              value={form.nextDate}
              onChange={(e) => fld("nextDate", e.target.value)}
              required
              className={cn(
                "w-full h-10 px-3 rounded-lg border text-sm",
                "bg-bg-surface border-border text-text-primary",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "transition-all duration-200"
              )}
            />
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg">
            <span className="text-sm font-medium text-text-primary">
              Aktifkan transaksi ini
            </span>
            <Toggle
              checked={form.isActive}
              onChange={() => fld("isActive", !form.isActive)}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1">
              {editingId ? "Simpan Perubahan" : "Tambah Transaksi"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              className="flex-1"
            >
              Batal
            </Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
