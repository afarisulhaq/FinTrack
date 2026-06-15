"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Trash2,
  Receipt,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, groupByDate } from "~/lib/utils";
import type { Transaction, TransactionType, Wallet } from "~/lib/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

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

interface CategoryOption {
  id?: string;
  name: string;
  icon: string;
  color: string;
  subCategoryId?: string;
  subCategoryName?: string;
}

const FALLBACK_INCOME_CATEGORIES: CategoryOption[] = [
  { name: "Gaji", icon: "💼", color: "#22c55e" },
  { name: "Freelance", icon: "💻", color: "#06b6d4" },
  { name: "Investasi", icon: "📈", color: "#a855f7" },
  { name: "Hadiah", icon: "🎁", color: "#f59e0b" },
  { name: "Lainnya", icon: "➕", color: "#94a3b8" },
];

const FALLBACK_EXPENSE_CATEGORIES: CategoryOption[] = [
  { name: "Makan", icon: "🍔", color: "#f97316" },
  { name: "Transport", icon: "🚗", color: "#3b82f6" },
  { name: "Belanja", icon: "🛍️", color: "#a855f7" },
  { name: "Hiburan", icon: "🎬", color: "#ec4899" },
  { name: "Kesehatan", icon: "🏥", color: "#22c55e" },
  { name: "Tagihan", icon: "💡", color: "#6366f1" },
  { name: "Kopi", icon: "☕", color: "#d97706" },
  { name: "Lainnya", icon: "➕", color: "#94a3b8" },
];

const FALLBACK_TRANSFER_CATEGORIES: CategoryOption[] = [
  { name: "Transfer", icon: "🔄", color: "#6366f1" },
];

/**
 * Build a list of master category chips for the transaction form.
 * Uses the store when available so any CRUD the user did on
 * `/categories` is reflected here, otherwise falls back to the legacy
 * hard-coded list (preserves behaviour for fresh installs / offline mode).
 */
function getCategoriesByType(
  type: TransactionType,
  storeCategories: Array<{
    id: string;
    type: string;
    name: string;
    icon: string;
    color: string;
  }>,
): CategoryOption[] {
  const fromStore = storeCategories
    .filter((c) => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    }));
  if (fromStore.length > 0) return fromStore;
  if (type === "income") return FALLBACK_INCOME_CATEGORIES;
  if (type === "expense") return FALLBACK_EXPENSE_CATEGORIES;
  return FALLBACK_TRANSFER_CATEGORIES;
}

// ─── Types ──────────────────────────────────────────────────────────────────────

type TxTypeFilter = "Semua" | TransactionType;

interface TxForm {
  type: TransactionType;
  amount: string;
  category: string;
  categoryIcon: string;
  /// FK to the master Category (from the store). When set, the picker
  /// also reveals the master’s sub-categories as a second row of chips.
  categoryId: string;
  /// FK to a sub-category (e.g. Gaji Pokok). Optional — the master is
  /// a valid pick on its own.
  subCategoryId: string;
  /// Free-text for a new sub-category that doesn’t exist yet. Used
  /// when the user types something new rather than picking a chip.
  newSubCategoryName: string;
  walletId: string;
  walletName: string;
  description: string;
  date: string;
}

const DEFAULT_TX_FORM: TxForm = {
  type: "expense",
  amount: "",
  category: "",
  categoryIcon: "🎯",
  categoryId: "",
  subCategoryId: "",
  newSubCategoryName: "",
  walletId: "",
  walletName: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getDateHeader(key: string): string {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = yest.toISOString().split("T")[0];

  if (key === todayStr) return "Hari ini";
  if (key === yesterdayStr) return "Kemarin";
  return formatDate(key + "T12:00:00");
}

function getDayNet(txList: Transaction[]): number {
  return txList.reduce((sum, tx) => {
    if (tx.type === "income") return sum + tx.amount;
    if (tx.type === "expense") return sum - tx.amount;
    return sum;
  }, 0);
}

/** Flatten wallets: parent wallets + embedded children + flat children */
function flattenWallets(wallets: Wallet[]): Wallet[] {
  const seen = new Set<string>();
  const result: Wallet[] = [];
  for (const w of wallets) {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      result.push(w);
    }
    if (w.children) {
      for (const c of w.children) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          result.push(c);
        }
      }
    }
  }
  return result;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const wallets = useFinanceStore((s) => s.wallets);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const ensureSubCategory = useFinanceStore((s) => s.ensureSubCategory);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("Semua");
  const [categoryFilter, setCategoryFilter] = useState("Semua Kategori");
  const [walletFilter, setWalletFilter] = useState("Semua Dompet");

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TxForm>(DEFAULT_TX_FORM);

  const fld = <K extends keyof TxForm>(k: K, v: TxForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allWallets = useMemo(() => flattenWallets(wallets), [wallets]);

  /** Current month income / expense / net */
  const monthStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).getTime();
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const t = new Date(tx.date).getTime();
      if (t < start || t > end) continue;
      if (tx.type === "income") income += tx.amount;
      else if (tx.type === "expense") expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  /** Unique categories for filter dropdown */
  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((tx) => tx.category));
    return Array.from(cats).sort();
  }, [transactions]);

  /** Filtered + sorted transactions */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions
      .filter((tx) => {
        if (typeFilter !== "Semua" && tx.type !== typeFilter) return false;
        if (
          categoryFilter !== "Semua Kategori" &&
          tx.category !== categoryFilter
        )
          return false;
        if (walletFilter !== "Semua Dompet" && tx.walletId !== walletFilter)
          return false;
        if (
          q &&
          !tx.description.toLowerCase().includes(q) &&
          !tx.category.toLowerCase().includes(q) &&
          !tx.walletName.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, typeFilter, categoryFilter, walletFilter, search]);

  /** Group filtered transactions by date */
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openModal() {
    const firstWallet = allWallets[0];
    setForm({
      ...DEFAULT_TX_FORM,
      date: new Date().toISOString().split("T")[0],
      walletId: firstWallet?.id ?? "",
      walletName: firstWallet?.name ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(DEFAULT_TX_FORM);
  }

  function handleTypeChange(t: TransactionType) {
    // Reset the category side of the form so the user is forced to pick
    // a fresh chip for the new type (avoids "Gaji" leaking into an
    // expense transaction just because the form was already valid).
    fld("type", t);
    fld("category", "");
    fld("categoryIcon", "🎯");
    fld("categoryId", "");
    fld("subCategoryId", "");
    fld("newSubCategoryName", "");
  }

  function handleCategorySelect(cat: CategoryOption) {
    fld("category", cat.name);
    fld("categoryIcon", cat.icon);
    if (cat.id) fld("categoryId", cat.id);
    // Clear sub-category whenever a new master is picked.
    fld("subCategoryId", "");
    fld("newSubCategoryName", "");
  }

  function handleSubCategorySelect(sub: {
    id: string;
    name: string;
    icon: string;
  }) {
    fld("subCategoryId", sub.id);
    fld("newSubCategoryName", sub.name);
    // Sub-categories inherit the parent’s icon unless the user picked a
    // custom one — keeps the row visually consistent.
    fld("categoryIcon", sub.icon || form.categoryIcon);
  }

  function handleWalletChange(walletId: string) {
    const w = allWallets.find((x) => x.id === walletId);
    fld("walletId", walletId);
    fld("walletName", w?.name ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.walletId) return;
    // If the user typed a brand-new sub-category, create it on the fly
    // (as a sub of the picked master). This keeps the master/sub
    // structure consistent and means the next transaction can re-pick
    // the sub from a chip instead of re-typing.
    if (
      form.categoryId &&
      form.newSubCategoryName.trim() &&
      !form.subCategoryId
    ) {
      void ensureSubCategory(
        form.categoryId,
        form.newSubCategoryName.trim(),
        form.categoryIcon,
        undefined,
      );
    }
    addTransaction({
      type: form.type,
      amount: parseFloat(form.amount),
      category: form.category,
      categoryIcon: form.categoryIcon,
      categoryId: form.categoryId || undefined,
      subCategoryId: form.subCategoryId || undefined,
      walletId: form.walletId,
      walletName: form.walletName,
      description: form.description || form.category,
      date: new Date(
        form.date + "T" + new Date().toTimeString().slice(0, 8),
      ).toISOString(),
    });
    closeModal();
  }

  const TYPE_TABS: { key: TxTypeFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    { key: "income", label: "Pemasukan" },
    { key: "expense", label: "Pengeluaran" },
    { key: "transfer", label: "Transfer" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper
      title="Transaksi"
      subtitle="Riwayat pemasukan dan pengeluaran"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openModal}>
          Tambah Transaksi
        </Button>
      }
    >
      {/* ── Summary (current month) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Pemasukan Bulan Ini"
          value={formatCurrency(monthStats.income, true)}
          icon={<TrendingUp size={20} />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Pengeluaran Bulan Ini"
          value={formatCurrency(monthStats.expense, true)}
          icon={<TrendingDown size={20} />}
          iconColor="#ef4444"
        />
        <StatCard
          title="Saldo Bersih"
          value={formatCurrency(Math.abs(monthStats.net), true)}
          subtitle={monthStats.net >= 0 ? "Surplus" : "Defisit"}
          icon={<ArrowLeftRight size={20} />}
          iconColor={monthStats.net >= 0 ? "#6366f1" : "#ef4444"}
        />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-3">
          {/* Top row: search + dropdowns */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Cari transaksi..."
                leftIcon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-bg-elevated border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none sm:w-44"
            >
              <option value="Semua Kategori">Semua Kategori</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="bg-bg-elevated border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none sm:w-44"
            >
              <option value="Semua Dompet">Semua Dompet</option>
              {allWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name}
                </option>
              ))}
            </select>
          </div>
          {/* Type filter tabs */}
          <div className="bg-bg-elevated flex w-fit gap-1 rounded-xl p-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === t.key
                    ? "bg-bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Transaction list ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, txList]) => {
          const net = getDayNet(txList);
          return (
            <div key={dateKey} className="space-y-2">
              {/* Date header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-text-secondary text-sm font-semibold">
                  {getDateHeader(dateKey)}
                </span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    net > 0
                      ? "text-success"
                      : net < 0
                        ? "text-danger"
                        : "text-text-muted"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net, true)}
                </span>
              </div>

              {/* Transactions */}
              <div className="space-y-2">
                {txList.map((tx) => (
                  <Card key={tx.id} className="group">
                    <div className="flex items-center gap-3">
                      {/* Category icon */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{
                          backgroundColor: `${getCategoryColor(tx.category)}22`,
                        }}
                      >
                        {tx.categoryIcon}
                      </div>

                      {/* Description + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate text-sm font-semibold">
                          {tx.description}
                        </p>
                        <p className="text-text-muted mt-0.5 truncate text-xs">
                          {tx.category} · {tx.walletName}
                        </p>
                      </div>

                      {/* Amount + time */}
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            tx.type === "income"
                              ? "text-success"
                              : tx.type === "expense"
                                ? "text-danger"
                                : "text-text-secondary"
                          }`}
                        >
                          {tx.type === "income"
                            ? "+"
                            : tx.type === "expense"
                              ? "−"
                              : ""}
                          {formatCurrency(tx.amount)}
                        </p>
                        <p className="text-text-muted mt-0.5 text-[10px]">
                          {formatTime(tx.date)}
                        </p>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="text-text-muted hover:text-danger hover:bg-danger/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-0 transition-colors group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Card className="py-16 text-center">
            <Receipt className="text-text-muted mx-auto mb-3 h-10 w-10" />
            <p className="text-text-muted text-sm">
              {transactions.length === 0
                ? "Belum ada transaksi"
                : "Tidak ada transaksi yang cocok"}
            </p>
          </Card>
        )}
      </div>

      {/* ── Add Transaction Modal ─────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title="Tambah Transaksi"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="bg-bg-elevated flex gap-1 rounded-xl p-1">
            {(["income", "expense", "transfer"] as TransactionType[]).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    form.type === t
                      ? t === "income"
                        ? "bg-success/20 text-success ring-success/30 ring-1"
                        : t === "expense"
                          ? "bg-danger/20 text-danger ring-danger/30 ring-1"
                          : "bg-primary/20 text-primary ring-primary/30 ring-1"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t === "income"
                    ? "Pemasukan"
                    : t === "expense"
                      ? "Pengeluaran"
                      : "Transfer"}
                </button>
              ),
            )}
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Jumlah (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.amount}
              onChange={(e) => fld("amount", e.target.value)}
              required
              className="border-border bg-bg-elevated text-text-primary placeholder:text-text-muted focus:ring-primary/50 focus:border-primary h-14 w-full rounded-xl border px-4 text-2xl font-bold focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Category — master + sub-categories */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Kategori{" "}
              <span className="text-text-muted font-normal">
                — pilih dari master yang sudah dibuat di halaman
                <a
                  href="/categories"
                  className="text-primary ml-1 underline underline-offset-2"
                >
                  Kategori
                </a>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {getCategoriesByType(form.type, categories).map((cat) => (
                <button
                  key={cat.id ?? cat.name}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className="bg-bg-elevated hover:bg-bg-elevated/70 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={
                    form.categoryId === cat.id ||
                    (form.category === cat.name && !form.categoryId)
                      ? {
                          backgroundColor: `${cat.color}25`,
                          color: cat.color,
                          outline: `2px solid ${cat.color}60`,
                          outlineOffset: "1px",
                        }
                      : {}
                  }
                >
                  <span>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Sub-category row — only shows when a master is picked AND
                that master has sub-categories in the store. */}
            {form.categoryId &&
              (() => {
                const master = categories.find((c) => c.id === form.categoryId);
                const subs = master?.subCategories ?? [];
                if (subs.length === 0) return null;
                return (
                  <div className="flex flex-col gap-1">
                    <span className="text-text-muted text-[11px]">
                      Sub-kategori (opsional)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((s) => {
                        const active = form.subCategoryId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSubCategorySelect(s)}
                            className="bg-bg-elevated/60 hover:bg-bg-elevated flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
                            style={
                              active
                                ? {
                                    backgroundColor: `${s.color}25`,
                                    color: s.color,
                                    outline: `1.5px solid ${s.color}50`,
                                  }
                                : {}
                            }
                          >
                            <span>{s.icon}</span>
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            {/* Sub-category free text — appears once a master is picked so
                users can add a new “jenis” without leaving the form. */}
            {form.categoryId && (
              <Input
                placeholder="Atau ketik sub baru (mis. “Tunjangan Makan”) — otomatis tersimpan di master"
                value={form.newSubCategoryName}
                onChange={(e) => {
                  fld("newSubCategoryName", e.target.value);
                  fld("subCategoryId", "");
                }}
                className="h-8 text-xs"
              />
            )}

            {/* Legacy free-text fallback for when no master is picked. */}
            {!form.categoryId && (
              <Input
                placeholder="Atau ketik kategori khusus (mis. “Sepeda”) untuk dicocokkan dengan anggaran"
                value={form.category}
                onChange={(e) => {
                  fld("category", e.target.value);
                  fld("categoryIcon", "🎯");
                }}
                className="h-8 text-xs"
              />
            )}

            {form.category &&
              budgets.some(
                (b) => b.category.toLowerCase() === form.category.toLowerCase(),
              ) && (
                <p className="text-success text-[11px]">
                  ✓ Kategori ini terhubung ke anggaran “{form.category}”.
                  Nominal akan otomatis dihitung ke sisa anggaran.
                </p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Wallet */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Dompet
              </label>
              <select
                value={form.walletId}
                onChange={(e) => handleWalletChange(e.target.value)}
                required
                className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="">Pilih dompet...</option>
                {allWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <Input
              label="Tanggal"
              type="date"
              value={form.date}
              onChange={(e) => fld("date", e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <Input
            label="Keterangan"
            placeholder="cth. Makan siang di warteg"
            value={form.description}
            onChange={(e) => fld("description", e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button type="submit">Simpan Transaksi</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
