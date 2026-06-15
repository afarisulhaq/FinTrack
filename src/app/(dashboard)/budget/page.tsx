"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, PiggyBank, AlertTriangle } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";

import { Input } from "~/components/ui/input";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, percentage, getBudgetColor } from "~/lib/utils";
import type { Budget, Wallet } from "~/lib/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

type BudgetPeriod = "daily" | "weekly" | "monthly";

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Bulanan",
  weekly: "Mingguan",
  daily: "Harian",
};

const PERIOD_TABS: { key: BudgetPeriod; label: string }[] = [
  { key: "monthly", label: "Bulanan" },
  { key: "weekly", label: "Mingguan" },
  { key: "daily", label: "Harian" },
];

const QUICK_EMOJIS = [
  "🍔",
  "🚗",
  "🛍️",
  "🎬",
  "🏥",
  "💡",
  "☕",
  "🏠",
  "📱",
  "🎮",
  "✈️",
  "💪",
];

// ─── Types ──────────────────────────────────────────────────────────────────────

interface BudgetForm {
  /// Master Category id (from the categories store). When this is set,
  /// the form behaves as a sub-category picker; `category` is synced on save.
  categoryId: string;
  /// Sub-category id (jenis anggaran) — optional, but when a budget has
  /// a sub-category the "jenis" is what shows on the card.
  subCategoryId: string;
  /// Free-form name for the "jenis anggaran" when there's no matching
  /// sub-category yet. On save we auto-create the sub-category under the
  /// picked master.
  newSubCategoryName: string;
  category: string;
  categoryIcon: string;
  limit: string;
  period: BudgetPeriod;
  color: string;
  walletId: string;
}

const EMPTY_FORM: BudgetForm = {
  categoryId: "",
  subCategoryId: "",
  newSubCategoryName: "",
  category: "",
  categoryIcon: "🎯",
  limit: "",
  period: "monthly",
  color: "#6366f1",
  walletId: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Flatten wallets: parent wallets + embedded children */
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

export default function BudgetPage() {
  const wallets = useFinanceStore((s) => s.wallets);
  const budgets = useFinanceStore((s) => s.budgets);
  const categories = useFinanceStore((s) => s.categories);
  const addBudget = useFinanceStore((s) => s.addBudget);
  const updateBudget = useFinanceStore((s) => s.updateBudget);
  const deleteBudget = useFinanceStore((s) => s.deleteBudget);
  const ensureCategory = useFinanceStore((s) => s.ensureCategory);
  const ensureSubCategory = useFinanceStore((s) => s.ensureSubCategory);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>(EMPTY_FORM);

  const fld = <K extends keyof BudgetForm>(k: K, v: BudgetForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allWallets = useMemo(() => flattenWallets(wallets), [wallets]);

  const filteredBudgets = useMemo(
    () => budgets.filter((b) => b.period === period),
    [budgets, period],
  );

  const { totalLimit, totalSpent, overspentCount } = useMemo(() => {
    return filteredBudgets.reduce(
      (acc, b) => ({
        totalLimit: acc.totalLimit + b.limit,
        totalSpent: acc.totalSpent + b.spent,
        overspentCount: acc.overspentCount + (b.spent > b.limit ? 1 : 0),
      }),
      { totalLimit: 0, totalSpent: 0, overspentCount: 0 },
    );
  }, [filteredBudgets]);

  const totalPct = percentage(totalSpent, totalLimit);

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, period });
    setShowModal(true);
  }

  function openEdit(budget: Budget) {
    setEditingId(budget.id);
    // Try to find the matching master + sub from the store. Fall back to
    // the legacy string `category` so old budgets (no FK) still load.
    const master = budget.categoryId
      ? categories.find((c) => c.id === budget.categoryId)
      : categories.find(
          (c) => c.name.toLowerCase() === budget.category.toLowerCase(),
        );
    const sub = budget.subCategoryId
      ? master?.subCategories.find((s) => s.id === budget.subCategoryId)
      : undefined;
    setForm({
      categoryId: master?.id ?? "",
      subCategoryId: sub?.id ?? "",
      newSubCategoryName: sub?.name ?? "",
      category: budget.category,
      categoryIcon: budget.categoryIcon,
      limit: String(budget.limit),
      period: budget.period,
      color: budget.color,
      walletId: budget.walletId ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  /**
   * Resolve a friendly display name for the picked master/sub. Used by
   * the form submit to keep the legacy `category` string in sync (the
   * server's `applyTransactionBudgetDelta` matches by this string).
   */
  function pickMasterName(): { name: string; icon: string; color: string } {
    if (form.categoryId) {
      const m = categories.find((c) => c.id === form.categoryId);
      if (m) return { name: m.name, icon: m.icon, color: m.color };
    }
    return { name: form.category, icon: form.categoryIcon, color: form.color };
  }

  function pickSubName(): {
    name: string;
    icon: string;
    color: string;
  } | null {
    if (!form.categoryId) return null;
    if (form.subCategoryId) {
      const master = categories.find((c) => c.id === form.categoryId);
      const s = master?.subCategories.find((x) => x.id === form.subCategoryId);
      if (s) return { name: s.name, icon: s.icon, color: s.color };
    }
    const name = form.newSubCategoryName.trim();
    if (!name) return null;
    return {
      name,
      icon: form.categoryIcon,
      color: form.color,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.limit) return;

    // Resolve master + sub (auto-create on the fly if the user typed a
    // new sub-category name). The id fields are sent to the server so
    // Transaction lookups can join back via FK.
    let masterId = form.categoryId;
    let subId = form.subCategoryId;
    let displayName = form.category.trim();
    let displayIcon = form.categoryIcon;
    let displayColor = form.color;

    if (masterId) {
      const master = categories.find((c) => c.id === masterId);
      if (master) {
        displayName = master.name;
        displayIcon = form.categoryIcon || master.icon;
        displayColor = form.color || master.color;
      }
    } else if (displayName) {
      // No master picked — treat the free-text name as the master (legacy
      // behaviour). ensureCategory returns existing or creates a new one.
      const created = await ensureCategory(
        displayName,
        "expense",
        form.categoryIcon,
        form.color,
      );
      if (created) {
        masterId = created.id;
        displayName = created.name;
        displayIcon = created.icon;
        displayColor = created.color;
      }
    }

    const sub = pickSubName();
    if (sub && masterId) {
      const ensured = await ensureSubCategory(
        masterId,
        sub.name,
        sub.icon,
        sub.color,
      );
      if (ensured) subId = ensured.id;
    }

    if (editingId) {
      updateBudget(editingId, {
        category: displayName,
        categoryIcon: displayIcon,
        limit: parseFloat(form.limit),
        period: form.period,
        color: displayColor,
        walletId: form.walletId || undefined,
        categoryId: masterId || undefined,
        subCategoryId: subId || undefined,
      });
    } else {
      addBudget({
        category: displayName,
        categoryIcon: displayIcon,
        limit: parseFloat(form.limit),
        spent: 0,
        period: form.period,
        color: displayColor,
        walletId: form.walletId || undefined,
        categoryId: masterId || undefined,
        subCategoryId: subId || undefined,
      });
    }
    closeModal();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper
      title="Anggaran"
      subtitle="Pantau dan kelola anggaran keuangan"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
          Tambah Anggaran
        </Button>
      }
    >
      {/* ── Overall Summary ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-4">
          {/* Alert */}
          {overspentCount > 0 && (
            <div className="bg-danger/10 border-danger/20 flex items-center gap-2 rounded-lg border px-3 py-2">
              <AlertTriangle className="text-danger h-4 w-4 shrink-0" />
              <span className="text-danger text-sm font-medium">
                ⚠️ {overspentCount} kategori melebihi anggaran
              </span>
            </div>
          )}

          {/* Big progress bar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-primary font-semibold">
                Total Penggunaan Anggaran
              </span>
              <span
                className="font-bold tabular-nums"
                style={{ color: getBudgetColor(totalPct) }}
              >
                {totalPct}%
              </span>
            </div>
            <ProgressBar value={totalSpent} max={totalLimit || 1} animated />
          </div>

          {/* 3 stats */}
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div className="bg-bg-elevated flex flex-col gap-1 rounded-xl p-3">
              <span className="text-text-muted text-xs tracking-wide uppercase">
                Total Budget
              </span>
              <span className="text-text-primary text-base font-bold">
                {formatCurrency(totalLimit, true)}
              </span>
            </div>
            <div className="bg-bg-elevated flex flex-col gap-1 rounded-xl p-3">
              <span className="text-text-muted text-xs tracking-wide uppercase">
                Terpakai
              </span>
              <span
                className="text-base font-bold tabular-nums"
                style={{ color: getBudgetColor(totalPct) }}
              >
                {formatCurrency(totalSpent, true)}
              </span>
            </div>
            <div className="bg-bg-elevated flex flex-col gap-1 rounded-xl p-3">
              <span className="text-text-muted text-xs tracking-wide uppercase">
                Sisa
              </span>
              <span
                className={`text-base font-bold tabular-nums ${
                  totalLimit - totalSpent < 0 ? "text-danger" : "text-success"
                }`}
              >
                {formatCurrency(Math.max(0, totalLimit - totalSpent), true)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Period tabs ──────────────────────────────────────────────────── */}
      <div className="bg-bg-elevated flex w-fit gap-1 rounded-xl p-1">
        {PERIOD_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPeriod(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              period === t.key
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
            <span className="bg-bg-base text-text-muted ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]">
              {budgets.filter((b) => b.period === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Budget cards grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredBudgets.map((budget) => {
          const pct = percentage(budget.spent, budget.limit);
          const isOverspent = budget.spent > budget.limit;
          const isWarning = !isOverspent && pct >= 80;

          return (
            <Card key={budget.id} className="group flex flex-col gap-4">
              {/* Card header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${budget.color}22` }}
                  >
                    {budget.categoryIcon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-text-primary truncate text-sm font-bold">
                      {budget.category}
                      {(() => {
                        if (!budget.subCategoryId) return null;
                        const master = budget.categoryId
                          ? categories.find((c) => c.id === budget.categoryId)
                          : categories.find(
                              (c) =>
                                c.name.toLowerCase() ===
                                budget.category.toLowerCase(),
                            );
                        const sub = master?.subCategories.find(
                          (s) => s.id === budget.subCategoryId,
                        );
                        if (!sub) return null;
                        return (
                          <span className="text-text-muted ml-1 font-normal">
                            · {sub.icon} {sub.name}
                          </span>
                        );
                      })()}
                    </h3>
                    <Badge variant="default" size="sm" className="mt-1">
                      {PERIOD_LABELS[budget.period]}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(budget)}
                    className="bg-bg-elevated text-text-secondary hover:text-primary hover:bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    title="Edit anggaran"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteBudget(budget.id)}
                    className="bg-bg-elevated text-text-secondary hover:text-danger hover:bg-danger/10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    title="Hapus anggaran"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Spent / limit */}
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-xl font-bold tabular-nums"
                  style={{ color: getBudgetColor(pct) }}
                >
                  {formatCurrency(budget.spent, true)}
                </span>
                <span className="text-text-muted text-sm">
                  / {formatCurrency(budget.limit, true)}
                </span>
              </div>

              {/* Progress bar */}
              <ProgressBar
                value={budget.spent}
                max={budget.limit}
                size="sm"
                animated
              />

              {/* Footer: pct + alert badge */}
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-xs">{pct}% terpakai</span>
                {isOverspent ? (
                  <Badge variant="danger" size="sm">
                    🚨 Melebihi Batas
                  </Badge>
                ) : isWarning ? (
                  <Badge variant="warning" size="sm">
                    ⚠️ {Math.round(pct)}% Terpakai
                  </Badge>
                ) : null}
              </div>

              {/* Wallet tag if present */}
              {budget.walletId &&
                (() => {
                  const w = allWallets.find((x) => x.id === budget.walletId);
                  return w ? (
                    <div className="-mt-1 flex items-center gap-1">
                      <span className="text-text-muted text-xs">
                        {w.icon} {w.name}
                      </span>
                    </div>
                  ) : null;
                })()}
            </Card>
          );
        })}

        {filteredBudgets.length === 0 && (
          <div className="lg:col-span-2">
            <Card className="py-16 text-center">
              <PiggyBank className="text-text-muted mx-auto mb-3 h-10 w-10" />
              <p className="text-text-muted text-sm">
                Belum ada anggaran {PERIOD_LABELS[period].toLowerCase()}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={openAdd}
                >
                  Tambah Anggaran
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── Budget Analysis ───────────────────────────────────────────────── */}
      {filteredBudgets.length > 0 && (
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Analisis Anggaran
            </span>
            <Badge variant="default" size="sm">
              {PERIOD_LABELS[period]}
            </Badge>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {filteredBudgets
                .slice()
                .sort((a, b) => b.limit - a.limit)
                .map((budget) => {
                  const sharePct = percentage(budget.limit, totalLimit);
                  const spentPct = percentage(budget.spent, budget.limit);
                  return (
                    <div key={budget.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0">
                            {budget.categoryIcon}
                          </span>
                          <span className="text-text-secondary truncate font-medium">
                            {budget.category}
                            {(() => {
                              if (!budget.subCategoryId) return null;
                              const master = budget.categoryId
                                ? categories.find(
                                    (c) => c.id === budget.categoryId,
                                  )
                                : categories.find(
                                    (c) =>
                                      c.name.toLowerCase() ===
                                      budget.category.toLowerCase(),
                                  );
                              const sub = master?.subCategories.find(
                                (s) => s.id === budget.subCategoryId,
                              );
                              if (!sub) return null;
                              return (
                                <span className="text-text-muted ml-1 font-normal">
                                  · {sub.name}
                                </span>
                              );
                            })()}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-3">
                          <span className="text-text-muted tabular-nums">
                            {formatCurrency(budget.limit, true)}
                          </span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: budget.color }}
                          >
                            {sharePct}%
                          </span>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${getBudgetColor(spentPct)}22`,
                              color: getBudgetColor(spentPct),
                            }}
                          >
                            {spentPct}% terpakai
                          </span>
                        </div>
                      </div>
                      <div className="bg-bg-elevated h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${sharePct}%`,
                            backgroundColor: budget.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Add / Edit Budget Modal ────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit Anggaran" : "Tambah Anggaran"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Batas Anggaran (Rp)"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.limit}
              onChange={(e) => fld("limit", e.target.value)}
              required
            />
            {/* Spacer keeps the 2-col rhythm aligned; the picker is full-width below. */}
            <div />
          </div>

          {/* Master category picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Kategori (master){" "}
              <span className="text-text-muted font-normal">
                — payung anggaran
              </span>
            </label>
            {categories.filter((c) => c.type === "expense").length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {categories
                  .filter((c) => c.type === "expense")
                  .sort(
                    (a, b) =>
                      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
                  )
                  .map((c) => {
                    const active = form.categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          fld("categoryId", c.id);
                          fld("subCategoryId", "");
                          fld("category", c.name);
                          fld("categoryIcon", c.icon);
                          fld("color", c.color);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all`}
                        style={
                          active
                            ? {
                                backgroundColor: `${c.color}25`,
                                color: c.color,
                                outline: `2px solid ${c.color}60`,
                                outlineOffset: "1px",
                              }
                            : { backgroundColor: "var(--bg-elevated, #1a1d27)" }
                        }
                      >
                        <span>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
              </div>
            ) : (
              <p className="text-text-muted text-[11px] italic">
                Belum ada master kategori. Buka{" "}
                <a
                  href="/categories"
                  className="text-primary underline underline-offset-2"
                >
                  halaman Kategori
                </a>{" "}
                untuk menambah, atau ketik manual di bawah.
              </p>
            )}
            <Input
              placeholder="Atau ketik kategori khusus..."
              value={form.category}
              onChange={(e) => {
                fld("category", e.target.value);
                fld("categoryId", "");
                fld("subCategoryId", "");
              }}
            />
          </div>

          {/* Sub-category picker (only when a master is picked) */}
          {form.categoryId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Jenis Anggaran{" "}
                <span className="text-text-muted font-normal">
                  — sub-kategori (mis. Gaji Pokok, Bonus)
                </span>
              </label>
              {(() => {
                const master = categories.find((c) => c.id === form.categoryId);
                const subs = master?.subCategories ?? [];
                if (subs.length > 0) {
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((s) => {
                        const active = form.subCategoryId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              fld("subCategoryId", s.id);
                              fld("newSubCategoryName", s.name);
                              fld("categoryIcon", s.icon);
                              fld("color", s.color);
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                            style={
                              active
                                ? {
                                    backgroundColor: `${s.color}25`,
                                    color: s.color,
                                    outline: `2px solid ${s.color}60`,
                                    outlineOffset: "1px",
                                  }
                                : {
                                    backgroundColor:
                                      "var(--bg-elevated, #1a1d27)",
                                  }
                            }
                          >
                            <span>{s.icon}</span>
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              })()}
              <Input
                placeholder="Atau ketik jenis baru — otomatis dibuat di master"
                value={form.newSubCategoryName}
                onChange={(e) => {
                  fld("newSubCategoryName", e.target.value);
                  fld("subCategoryId", "");
                }}
              />
            </div>
          )}

          {/* Emoji picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Ikon Kategori
            </label>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => fld("categoryIcon", emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                    form.categoryIcon === emoji
                      ? "bg-primary/20 ring-primary ring-2"
                      : "bg-bg-elevated hover:bg-bg-elevated/80"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <Input
              placeholder="Atau ketik emoji kustom..."
              value={form.categoryIcon}
              onChange={(e) => fld("categoryIcon", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Period */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Periode
              </label>
              <select
                value={form.period}
                onChange={(e) => fld("period", e.target.value as BudgetPeriod)}
                className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="monthly">Bulanan</option>
                <option value="weekly">Mingguan</option>
                <option value="daily">Harian</option>
              </select>
            </div>

            {/* Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Warna
              </label>
              <div className="flex h-10 items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => fld("color", e.target.value)}
                  className="border-border bg-bg-surface h-9 w-14 cursor-pointer rounded-lg border p-1"
                />
                <span className="text-text-muted font-mono text-sm">
                  {form.color}
                </span>
              </div>
            </div>
          </div>

          {/* Wallet (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Dompet{" "}
              <span className="text-text-muted font-normal">(opsional)</span>
            </label>
            <select
              value={form.walletId}
              onChange={(e) => fld("walletId", e.target.value)}
              className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="">— Semua Dompet —</option>
              {allWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {form.category && form.limit && (
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{
                backgroundColor: `${form.color}12`,
                borderColor: `${form.color}30`,
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ backgroundColor: `${form.color}22` }}
              >
                {form.categoryIcon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-semibold">
                  {form.category}
                  {(form.subCategoryId || form.newSubCategoryName.trim()) && (
                    <span className="text-text-muted font-normal">
                      {" "}
                      ·{" "}
                      {form.subCategoryId
                        ? categories
                            .find((c) => c.id === form.categoryId)
                            ?.subCategories.find(
                              (s) => s.id === form.subCategoryId,
                            )?.name
                        : form.newSubCategoryName.trim()}
                      <span className="ml-1 text-[10px]"> (baru)</span>
                    </span>
                  )}
                </p>
                <p className="text-text-muted text-xs">
                  Budget {PERIOD_LABELS[form.period].toLowerCase()}:{" "}
                  {formatCurrency(parseFloat(form.limit) || 0)}
                </p>
              </div>
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: form.color }}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button type="submit">
              {editingId ? "Simpan Perubahan" : "Tambah Anggaran"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
