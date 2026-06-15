"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  Tag,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { cn } from "~/lib/utils";
import type { Category, CategoryKind, SubCategory } from "~/lib/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

type TabKey = "expense" | "income";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "expense", label: "Pengeluaran", icon: "💸" },
  { key: "income", label: "Pemasukan", icon: "💰" },
];

const QUICK_ICONS = [
  "📁",
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
  "💼",
  "💻",
  "📈",
  "🎁",
  "📚",
  "🛒",
  "💊",
];

const QUICK_COLORS = [
  "#f97316",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#22c55e",
  "#6366f1",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#0ea5e9",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CategoryForm {
  id?: string;
  type: CategoryKind;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
}

interface SubCategoryForm {
  id?: string;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
}

const EMPTY_CAT_FORM = (type: CategoryKind): CategoryForm => ({
  type,
  name: "",
  icon: "📁",
  color: "#6366f1",
  sortOrder: 0,
  isSystem: false,
});

const EMPTY_SUB_FORM = (categoryId: string): SubCategoryForm => ({
  categoryId,
  name: "",
  icon: "🔖",
  color: "#6366f1",
  sortOrder: 0,
  isSystem: false,
});

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const categories = useFinanceStore((s) => s.categories);
  const subCategories = useFinanceStore((s) => s.subCategories);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const updateCategory = useFinanceStore((s) => s.updateCategory);
  const deleteCategory = useFinanceStore((s) => s.deleteCategory);
  const addSubCategory = useFinanceStore((s) => s.addSubCategory);
  const updateSubCategory = useFinanceStore((s) => s.updateSubCategory);
  const deleteSubCategory = useFinanceStore((s) => s.deleteSubCategory);
  const refreshCategories = useFinanceStore((s) => s.refreshCategories);

  const [tab, setTab] = useState<TabKey>("expense");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm>(
    EMPTY_CAT_FORM("expense"),
  );

  // Sub-category modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState<SubCategoryForm>(EMPTY_SUB_FORM(""));

  // Confirm-delete dialog
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "category"; id: string; name: string }
    | { kind: "subCategory"; id: string; name: string; parentName: string }
    | null
  >(null);

  // Group by tab.
  const tabCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === tab)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
    [categories, tab],
  );

  // Stats
  const stats = useMemo(() => {
    const expense = categories.filter((c) => c.type === "expense");
    const income = categories.filter((c) => c.type === "income");
    return {
      expenseCount: expense.length,
      incomeCount: income.length,
      expenseSubs: subCategories.filter((s) =>
        expense.some((c) => c.id === s.categoryId),
      ).length,
      incomeSubs: subCategories.filter((s) =>
        income.some((c) => c.id === s.categoryId),
      ).length,
    };
  }, [categories, subCategories]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAddCategory() {
    setCatForm(EMPTY_CAT_FORM(tab));
    setCatModalOpen(true);
  }

  function openEditCategory(c: Category) {
    setCatForm({
      id: c.id,
      type: c.type,
      name: c.name,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      isSystem: c.isSystem,
    });
    setCatModalOpen(true);
  }

  async function submitCategory() {
    if (!catForm.name.trim()) return;
    const payload = {
      type: catForm.type,
      name: catForm.name.trim(),
      icon: catForm.icon || "📁",
      color: catForm.color || "#6366f1",
      sortOrder: catForm.sortOrder,
      isSystem: catForm.isSystem,
    };
    if (catForm.id) {
      await updateCategory(catForm.id, payload);
    } else {
      await addCategory(payload);
    }
    setCatModalOpen(false);
  }

  function openAddSub(parent: Category) {
    // Inherit parent's color/icon as a sensible default.
    setSubForm({
      ...EMPTY_SUB_FORM(parent.id),
      color: parent.color,
      icon: parent.icon,
    });
    setSubModalOpen(true);
  }

  function openEditSub(sub: SubCategory) {
    setSubForm({
      id: sub.id,
      categoryId: sub.categoryId,
      name: sub.name,
      icon: sub.icon,
      color: sub.color,
      sortOrder: sub.sortOrder,
      isSystem: sub.isSystem,
    });
    setSubModalOpen(true);
  }

  async function submitSub() {
    if (!subForm.name.trim() || !subForm.categoryId) return;
    const payload = {
      categoryId: subForm.categoryId,
      name: subForm.name.trim(),
      icon: subForm.icon || "🔖",
      color: subForm.color || "#6366f1",
      sortOrder: subForm.sortOrder,
      isSystem: subForm.isSystem,
    };
    if (subForm.id) {
      await updateSubCategory(subForm.id, payload);
    } else {
      await addSubCategory(payload);
    }
    setSubModalOpen(false);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "category") {
      await deleteCategory(confirmDelete.id);
    } else {
      await deleteSubCategory(confirmDelete.id);
    }
    setConfirmDelete(null);
  }

  async function seedDefaults() {
    // Quick seed: only adds categories that don't exist yet.
    const existing = new Set(
      categories.map((c) => `${c.type}::${c.name.toLowerCase()}`),
    );
    const defaults: Array<
      Omit<Category, "id" | "subCategories" | "createdAt" | "updatedAt">
    > = [
      {
        type: "expense",
        name: "Makan",
        icon: "🍔",
        color: "#f97316",
        sortOrder: 0,
        isSystem: false,
      },
      {
        type: "expense",
        name: "Transport",
        icon: "🚗",
        color: "#3b82f6",
        sortOrder: 1,
        isSystem: false,
      },
      {
        type: "expense",
        name: "Belanja",
        icon: "🛍️",
        color: "#a855f7",
        sortOrder: 2,
        isSystem: false,
      },
      {
        type: "expense",
        name: "Hiburan",
        icon: "🎬",
        color: "#ec4899",
        sortOrder: 3,
        isSystem: false,
      },
      {
        type: "expense",
        name: "Kesehatan",
        icon: "🏥",
        color: "#22c55e",
        sortOrder: 4,
        isSystem: false,
      },
      {
        type: "expense",
        name: "Tagihan",
        icon: "💡",
        color: "#6366f1",
        sortOrder: 5,
        isSystem: false,
      },
      {
        type: "income",
        name: "Gaji",
        icon: "💼",
        color: "#22c55e",
        sortOrder: 0,
        isSystem: false,
      },
      {
        type: "income",
        name: "Freelance",
        icon: "💻",
        color: "#06b6d4",
        sortOrder: 1,
        isSystem: false,
      },
      {
        type: "income",
        name: "Investasi",
        icon: "📈",
        color: "#a855f7",
        sortOrder: 2,
        isSystem: false,
      },
      {
        type: "income",
        name: "Hadiah",
        icon: "🎁",
        color: "#f59e0b",
        sortOrder: 3,
        isSystem: false,
      },
    ];
    for (const c of defaults) {
      if (!existing.has(`${c.type}::${c.name.toLowerCase()}`)) {
        await addCategory(c);
      }
    }
    await refreshCategories();
  }

  const canSeed = categories.filter((c) => c.type === tab).length === 0;

  return (
    <PageWrapper
      title="Kategori & Sub-Kategori"
      subtitle="Kelola master kategori dan sub-kategori transaksi & anggaran"
      actions={
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openAddCategory}
        >
          Tambah Kategori
        </Button>
      }
    >
      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Kategori Pengeluaran"
          value={stats.expenseCount}
          icon="💸"
          color="#f97316"
        />
        <StatTile
          label="Sub Pengeluaran"
          value={stats.expenseSubs}
          icon="🏷️"
          color="#3b82f6"
        />
        <StatTile
          label="Kategori Pemasukan"
          value={stats.incomeCount}
          icon="💰"
          color="#22c55e"
        />
        <StatTile
          label="Sub Pemasukan"
          value={stats.incomeSubs}
          icon="🏷️"
          color="#a855f7"
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="bg-bg-elevated flex w-fit gap-1 rounded-xl p-1">
        {TABS.map((t) => {
          const count = categories.filter((c) => c.type === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                tab === t.key
                  ? "bg-bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              <span>{t.icon}</span>
              {t.label}
              <span className="bg-bg-base text-text-muted rounded-full px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Empty state with seed button ────────────────────────────── */}
      {tabCategories.length === 0 && (
        <Card className="py-14 text-center">
          <FolderTree className="text-text-muted mx-auto mb-3 h-12 w-12" />
          <p className="text-text-primary text-sm font-semibold">
            Belum ada kategori {tab === "expense" ? "pengeluaran" : "pemasukan"}
          </p>
          <p className="text-text-muted mx-auto mt-1 max-w-sm text-xs">
            Buat master kategori agar transaksi &amp; anggaran punya payung yang
            konsisten, lalu tambahkan sub-kategori untuk rincian (mis. Gaji →
            Gaji Pokok, Bonus).
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {canSeed && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={seedDefaults}
              >
                Seed Default
              </Button>
            )}
            <Button
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openAddCategory}
            >
              Tambah Kategori
            </Button>
          </div>
        </Card>
      )}

      {/* ── Master category list ────────────────────────────────────── */}
      {tabCategories.length > 0 && (
        <div className="space-y-2">
          {tabCategories.map((c) => {
            const subs = c.subCategories ?? [];
            const isOpen = expanded[c.id] ?? true;
            return (
              <Card key={c.id} padding="sm" className="overflow-hidden">
                {/* Master row */}
                <div className="flex items-center gap-3 p-2">
                  <button
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [c.id]: !(p[c.id] ?? true) }))
                    }
                    className="text-text-muted hover:bg-bg-elevated flex h-7 w-7 items-center justify-center rounded-md"
                    aria-label={isOpen ? "Tutup" : "Buka"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${c.color}22` }}
                  >
                    {c.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-text-primary truncate text-sm font-bold">
                        {c.name}
                      </h3>
                      {c.isSystem && (
                        <Badge variant="default" size="sm">
                          Sistem
                        </Badge>
                      )}
                      <Badge variant="default" size="sm">
                        {subs.length} sub
                      </Badge>
                    </div>
                    <p className="text-text-muted font-mono text-[11px]">
                      {c.color}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="h-3 w-3" />}
                      onClick={() => openAddSub(c)}
                    >
                      Sub
                    </Button>
                    <button
                      onClick={() => openEditCategory(c)}
                      className="bg-bg-elevated text-text-secondary hover:text-primary hover:bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                      title="Edit kategori"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDelete({
                          kind: "category",
                          id: c.id,
                          name: c.name,
                        })
                      }
                      className="bg-bg-elevated text-text-secondary hover:text-danger hover:bg-danger/10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                      title="Hapus kategori"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Sub-categories */}
                {isOpen && (
                  <div className="pr-2 pb-2 pl-14">
                    {subs.length === 0 ? (
                      <p className="text-text-muted py-2 text-[11px] italic">
                        Belum ada sub-kategori. Klik “Sub” untuk menambah.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {subs
                          .slice()
                          .sort(
                            (a, b) =>
                              a.sortOrder - b.sortOrder ||
                              a.name.localeCompare(b.name),
                          )
                          .map((s) => (
                            <div
                              key={s.id}
                              className="group bg-bg-elevated/40 hover:bg-bg-elevated flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                            >
                              <Tag
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: s.color }}
                              />
                              <span
                                className="shrink-0 text-lg"
                                style={{ filter: "saturate(1.1)" }}
                              >
                                {s.icon}
                              </span>
                              <span className="text-text-primary min-w-0 flex-1 truncate text-sm font-medium">
                                {s.name}
                              </span>
                              {s.isSystem && (
                                <Badge variant="default" size="sm">
                                  Sistem
                                </Badge>
                              )}
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={() => openEditSub(s)}
                                  className="text-text-muted hover:text-primary hover:bg-primary/10 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                                  title="Edit sub"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmDelete({
                                      kind: "subCategory",
                                      id: s.id,
                                      name: s.name,
                                      parentName: c.name,
                                    })
                                  }
                                  className="text-text-muted hover:text-danger hover:bg-danger/10 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                                  title="Hapus sub"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Confirm Delete Dialog ─────────────────────────────────────── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Hapus?"
        size="sm"
      >
        <div className="space-y-3">
          <div className="bg-danger/10 border-danger/20 flex items-start gap-3 rounded-lg border p-3">
            <AlertTriangle className="text-danger mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-text-primary text-sm">
              {confirmDelete?.kind === "category" ? (
                <>
                  Kategori <b>{confirmDelete.name}</b> dan seluruh
                  sub-kategorinya akan dihapus. Transaksi &amp; anggaran lama
                  tetap aman (kategori string tetap tersimpan).
                </>
              ) : (
                <>
                  Sub-kategori <b>{confirmDelete?.name}</b> dari kategori{" "}
                  <b>
                    {confirmDelete?.kind === "subCategory" &&
                      confirmDelete.parentName}
                  </b>{" "}
                  akan dihapus.
                </>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Category Modal ─────────────────────────────────────────── */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={catForm.id ? "Edit Kategori" : "Tambah Kategori"}
        description="Master kategori jadi payung transaksi, anggaran, dan tagihan."
        size="md"
      >
        <CategoryFormFields form={catForm} setForm={setCatForm} />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setCatModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={submitCategory}>
            {catForm.id ? "Simpan Perubahan" : "Tambah"}
          </Button>
        </div>
      </Modal>

      {/* ── Sub-Category Modal ─────────────────────────────────────── */}
      <Modal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={subForm.id ? "Edit Sub-Kategori" : "Tambah Sub-Kategori"}
        description="Sub-kategori merinci ‘jenis’ di bawah master — misal Gaji → Gaji Pokok, Bonus."
        size="md"
      >
        <SubCategoryFormFields form={subForm} setForm={setSubForm} />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setSubModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={submitSub}>
            {subForm.id ? "Simpan Perubahan" : "Tambah"}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${color}22` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-text-muted text-[11px] tracking-wide uppercase">
            {label}
          </p>
          <p className="text-text-primary text-lg font-bold tabular-nums">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CategoryFormFields({
  form,
  setForm,
}: {
  form: CategoryForm;
  setForm: React.Dispatch<React.SetStateAction<CategoryForm>>;
}) {
  const fld = <K extends keyof CategoryForm>(k: K, v: CategoryForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nama Kategori"
          placeholder="cth. Gaji"
          value={form.name}
          onChange={(e) => fld("name", e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-text-secondary text-sm font-medium">
            Tipe
          </label>
          <select
            value={form.type}
            onChange={(e) => fld("type", e.target.value as CategoryKind)}
            className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <IconPicker
        label="Ikon"
        value={form.icon}
        onChange={(v) => fld("icon", v)}
      />

      <ColorPicker
        label="Warna"
        value={form.color}
        onChange={(v) => fld("color", v)}
      />

      {form.isSystem && (
        <div className="text-text-muted text-[11px] italic">
          Kategori ini ditandai <b>sistem</b> dan tidak akan terhapus oleh reset
          data.
        </div>
      )}
    </div>
  );
}

function SubCategoryFormFields({
  form,
  setForm,
}: {
  form: SubCategoryForm;
  setForm: React.Dispatch<React.SetStateAction<SubCategoryForm>>;
}) {
  const fld = <K extends keyof SubCategoryForm>(k: K, v: SubCategoryForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <Input
        label="Nama Sub-Kategori"
        placeholder="cth. Gaji Pokok"
        value={form.name}
        onChange={(e) => fld("name", e.target.value)}
        required
      />

      <IconPicker
        label="Ikon"
        value={form.icon}
        onChange={(v) => fld("icon", v)}
      />

      <ColorPicker
        label="Warna"
        value={form.color}
        onChange={(v) => fld("color", v)}
      />
    </div>
  );
}

function IconPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-secondary text-sm font-medium">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ICONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all",
              value === emoji
                ? "bg-primary/20 ring-primary ring-2"
                : "bg-bg-elevated hover:bg-bg-elevated/80",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <Input
        placeholder="Atau ketik emoji kustom..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-secondary text-sm font-medium">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "h-8 w-8 rounded-lg border-2 transition-all",
              value.toLowerCase() === c.toLowerCase()
                ? "scale-110 border-white"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border bg-bg-surface h-8 w-12 cursor-pointer rounded-lg border p-0.5"
        />
        <span className="text-text-muted self-center font-mono text-xs">
          {value}
        </span>
      </div>
    </div>
  );
}
