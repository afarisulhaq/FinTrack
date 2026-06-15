"use client";

import { useState, useMemo } from "react";
import { Star, Plus, Trash2, ShoppingCart, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency } from "~/lib/utils";
import type { WishlistPriority } from "~/lib/types";

type PriorityFilter = "Semua" | WishlistPriority;

const PRIORITY_CONFIG: Record<WishlistPriority, { label: string; variant: "danger" | "warning" | "success"; color: string }> = {
  high: { label: "Prioritas Tinggi", variant: "danger", color: "#ef4444" },
  medium: { label: "Sedang", variant: "warning", color: "#f59e0b" },
  low: { label: "Rendah", variant: "success", color: "#22c55e" },
};

const CATEGORIES = ["Elektronik", "Fashion", "Hiburan", "Kesehatan", "Furnitur", "Buku", "Kendaraan", "Aksesoris", "Lainnya"];
const ICONS_LIST = ["💻", "📱", "🎧", "📷", "🎮", "👟", "👗", "🏠", "🚗", "⌚", "🎒", "🛋️", "📚", "🌟", "💎", "🎁"];

export default function WishlistPage() {
  const wishlist = useFinanceStore((s) => s.wishlist);
  const addWishlistItem = useFinanceStore((s) => s.addWishlistItem);
  const deleteWishlistItem = useFinanceStore((s) => s.deleteWishlistItem);
  const toggleWishlistPurchased = useFinanceStore((s) => s.toggleWishlistPurchased);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("Semua");
  const [showPurchased, setShowPurchased] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dailyIncome, setDailyIncome] = useState(500000);

  const [form, setForm] = useState({
    name: "", price: "", icon: "🌟", priority: "medium" as WishlistPriority,
    category: "Elektronik", url: "", notes: "",
  });

  const activeItems = useMemo(
    () => wishlist.filter((w) => !w.isPurchased),
    [wishlist]
  );
  const purchasedItems = useMemo(
    () => wishlist.filter((w) => w.isPurchased),
    [wishlist]
  );

  const filteredActive = useMemo(
    () => priorityFilter === "Semua" ? activeItems : activeItems.filter((w) => w.priority === priorityFilter),
    [activeItems, priorityFilter]
  );

  const { totalItems, totalValue, purchasedCount } = useMemo(() => ({
    totalItems: activeItems.length,
    totalValue: activeItems.reduce((s, w) => s + w.price, 0),
    purchasedCount: purchasedItems.length,
  }), [activeItems, purchasedItems]);

  function daysToAfford(price: number): string {
    if (dailyIncome <= 0) return "∞";
    const days = Math.ceil(price / dailyIncome);
    if (days <= 30) return `${days} hari`;
    if (days <= 365) return `${Math.ceil(days / 30)} bulan`;
    return `${(days / 365).toFixed(1)} tahun`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) return;
    addWishlistItem({
      name: form.name,
      price: parseFloat(form.price),
      icon: form.icon,
      priority: form.priority,
      category: form.category,
      url: form.url || undefined,
      notes: form.notes || undefined,
      isPurchased: false,
    });
    setForm({ name: "", price: "", icon: "🌟", priority: "medium", category: "Elektronik", url: "", notes: "" });
    setShowModal(false);
  }

  const fld = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const PRIORITY_TABS: { key: PriorityFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    { key: "high", label: "Tinggi" },
    { key: "medium", label: "Sedang" },
    { key: "low", label: "Rendah" },
  ];

  return (
    <PageWrapper
      title="Wishlist"
      subtitle="Rencanakan pembelian impian kamu"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Tambah Item
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Item" value={totalItems} subtitle={`${purchasedCount} sudah dibeli`} icon={<Star />} iconColor="#6366f1" />
        <StatCard title="Total Nilai Wishlist" value={formatCurrency(totalValue)} icon={<ShoppingCart />} iconColor="#f59e0b" />
        <StatCard title="Sudah Dibeli" value={purchasedCount} subtitle="item terpenuhi" icon={<ShoppingCart />} iconColor="#22c55e" />
      </div>

      {/* ── Daily Income Calculator ──────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Kalkulator Saving</p>
            <p className="text-xs text-text-muted mt-0.5">Masukkan disposable income harian untuk melihat estimasi waktu beli</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-text-muted">Rp</span>
            <input
              type="number"
              value={dailyIncome}
              onChange={(e) => setDailyIncome(Number(e.target.value))}
              className="w-36 h-9 px-3 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="500000"
            />
            <span className="text-sm text-text-muted">/hari</span>
          </div>
        </div>
      </Card>

      {/* ── Priority Filter Tabs ─────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl w-fit">
        {PRIORITY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPriorityFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              priorityFilter === t.key
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Wishlist Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredActive.map((item) => {
          const cfg = PRIORITY_CONFIG[item.priority];
          const days = daysToAfford(item.price);
          return (
            <Card key={item.id} className="group flex flex-col gap-3 hover:border-border/60 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-bg-elevated flex items-center justify-center text-2xl shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary text-sm leading-tight">{item.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{item.category}</p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => deleteWishlistItem(item.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Price & Priority */}
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-text-primary">{formatCurrency(item.price)}</span>
                <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
              </div>

              {/* Saving Calculator */}
              <div className="p-2.5 rounded-xl bg-bg-elevated text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Dengan Rp{dailyIncome.toLocaleString("id-ID")}/hari</span>
                  <span className="font-semibold text-primary">{days}</span>
                </div>
              </div>

              {/* Notes */}
              {item.notes && (
                <p className="text-xs text-text-muted italic">{item.notes}</p>
              )}

              {/* Action */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-auto"
                onClick={() => toggleWishlistPurchased(item.id)}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Tandai Sudah Beli
              </Button>
            </Card>
          );
        })}

        {filteredActive.length === 0 && (
          <div className="col-span-full">
            <Card className="py-12 text-center">
              <Star className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">Tidak ada item wishlist</p>
            </Card>
          </div>
        )}
      </div>

      {/* ── Purchased Section ───────────────────────────────────────── */}
      {purchasedItems.length > 0 && (
        <div>
          <button
            onClick={() => setShowPurchased((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors mb-3"
          >
            {showPurchased ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Sudah Dibeli ({purchasedItems.length} item) — {formatCurrency(purchasedItems.reduce((s, w) => s + w.price, 0))}
          </button>

          {showPurchased && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {purchasedItems.map((item) => (
                <Card key={item.id} className="opacity-50 group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-xl shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-secondary line-through truncate">{item.name}</p>
                      <p className="text-xs text-text-muted">{formatCurrency(item.price)}</p>
                    </div>
                    <Badge variant="success" size="sm">Dibeli</Badge>
                    <button
                      onClick={() => deleteWishlistItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all h-6 w-6 flex items-center justify-center rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Wishlist Modal ───────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Tambah Item Wishlist" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nama Item" placeholder="cth. MacBook Pro M4" value={form.name} onChange={(e) => fld("name", e.target.value)} required />
            <Input label="Harga (Rp)" type="number" placeholder="0" value={form.price} onChange={(e) => fld("price", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Prioritas</label>
              <select value={form.priority} onChange={(e) => fld("priority", e.target.value)}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="high">Prioritas Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Kategori</label>
              <select value={form.category} onChange={(e) => fld("category", e.target.value)}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Ikon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS_LIST.map((icon) => (
                <button key={icon} type="button" onClick={() => fld("icon", icon)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-bg-elevated"}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <Input label="URL Produk (opsional)" placeholder="https://..." value={form.url} onChange={(e) => fld("url", e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={(e) => fld("notes", e.target.value)}
              placeholder="Alasan ingin beli, spesifikasi, dll..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit">Simpan Item</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
