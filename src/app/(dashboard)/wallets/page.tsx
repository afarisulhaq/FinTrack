"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Wallet as WalletIcon,
  Layers,
  BarChart2,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { formatCurrency, percentage } from "~/lib/utils";
import type { Wallet, WalletType } from "~/lib/types";
import { Pagination } from "~/components/ui/pagination";
import { ServerListStatus, ServerPaginatedList } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";
import { walletGroupBalance } from "~/lib/wallets";

// ─── Constants ─────────────────────────────────────────────────────────────────

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  bank: "Bank",
  cash: "Tunai",
  "e-wallet": "E-Wallet",
  investment: "Investasi",
  savings: "Tabungan",
};

const WALLET_ICONS = [
  "Wallet",
  "CreditCard",
  "Landmark",
  "Banknote",
  "PiggyBank",
  "Smartphone",
  "Building",
  "Briefcase",
  "Coins",
  "Vault",
];

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WalletForm {
  name: string;
  icon: string;
  type: WalletType;
  color: string;
  parentId: string;
  balance: string;
}

const EMPTY_FORM: WalletForm = {
  name: "",
  icon: "Wallet",
  type: "bank",
  color: "#FFD147",
  parentId: "",
  balance: "0",
};


// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WalletsPage() {
  const wallets = useFinanceStore((s) => s.wallets);
  const addWallet = useFinanceStore((s) => s.addWallet);
  const updateWallet = useFinanceStore((s) => s.updateWallet);
  const deleteWallet = useFinanceStore((s) => s.deleteWallet);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState<number | null>(null);
  const [form, setForm] = useState<WalletForm>(EMPTY_FORM);

  const fld = <K extends keyof WalletForm>(k: K, v: WalletForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ── Derived data ─────────────────────────────────────────────────────────────

  const walletPager = useServerPagination<
    Wallet & { childCount: number; groupBalance: number },
    { totalBalance: number; childCount: number; parentCount: number }
  >("/wallets", { view: "parents" }, { resource: "wallets" });
  const distribution = useMemo(
    () => wallets
      .map((wallet) => ({ ...wallet, groupBalance: walletGroupBalance(wallet) }))
      .sort((a, b) => b.groupBalance - a.groupBalance || a.id.localeCompare(b.id)),
    [wallets],
  );
  const distributionTotal = distribution.reduce((sum, wallet) => sum + wallet.groupBalance, 0);
  const { totalBalance = 0, childCount = 0, parentCount = 0 } = walletPager.summary ?? {};

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openAdd(preParentId?: string) {
    setEditingId(null);
    setEditingBalance(null);
    setForm({ ...EMPTY_FORM, parentId: preParentId ?? "" });
    setShowModal(true);
  }

  function openEdit(w: Wallet) {
    setEditingId(w.id);
    setEditingBalance(w.balance);
    setForm({
      name: w.name,
      icon: w.icon,
      type: w.type,
      color: w.color,
      parentId: w.parentId ?? "",
      balance: String(w.balance),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setEditingBalance(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.balance.trim() ||
      !Number.isFinite(Number(form.balance))
    )
      return;

    if (editingId) {
      updateWallet(editingId, {
        name: form.name,
        icon: form.icon,
        type: form.type,
        color: form.color,
        parentId: form.parentId || undefined,
        ...(editingBalance !== Number(form.balance)
          ? { balance: Number(form.balance) }
          : {}),
      });
    } else {
      addWallet({
        name: form.name,
        icon: form.icon,
        type: form.type,
        color: form.color,
        balance: Number(form.balance),
        currency: "IDR",
        parentId: form.parentId || undefined,
      });
    }
    closeModal();
  }

  const modalTitle = editingId
    ? "Edit Dompet"
    : form.parentId
      ? "Tambah Kantong"
      : "Tambah Dompet";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper
      title="Dompet"
      subtitle="Kelola dompet dan kantong keuangan"
      actions={
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => openAdd()}
        >
          Tambah Dompet
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Saldo"
          value={formatCurrency(totalBalance, true)}
          subtitle="Semua dompet aktif"
          icon={<WalletIcon className="text-primary" />}
        />
        <StatCard
          title="Jumlah Dompet"
          value={String(parentCount)}
          subtitle="Dompet utama"
          icon={<Layers className="text-success" />}
        />
        <StatCard
          title="Kantong Aktif"
          value={String(childCount)}
          subtitle="Sub-dompet / kantong"
          icon={<BarChart2 className="text-warning" />}
        />
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Wallet cards */}
        <div className="xl:col-span-2">
          <ServerListStatus {...walletPager} />
          <div className="space-y-4">
          {walletPager.items.map((wallet) => {
            return (
              <Card
                key={wallet.id}
                padding="none"
                className="group hover:border-primary/30 relative overflow-hidden transition-all"
              >
                <div
                  className="absolute top-0 bottom-0 left-0 w-1"
                  style={{ backgroundColor: wallet.color }}
                />
                <div className="p-5 pl-6">
                  {/* Wallet header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div
                        className="shadow-subtle flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{
                          backgroundColor: `${wallet.color}18`,
                          color: wallet.color,
                          border: `1px solid ${wallet.color}30`,
                        }}
                      >
                        <DynamicIcon name={wallet.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-text-primary truncate text-base font-bold">
                          {wallet.name}
                        </h3>
                        <Badge variant="default" size="sm" className="mt-1">
                          {WALLET_TYPE_LABELS[wallet.type]}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-3">
                      <div className="text-right">
                        <p className="text-text-primary text-lg font-bold tabular-nums">
                          {formatCurrency(wallet.groupBalance)}
                        </p>
                        <p className="text-text-muted text-xs font-medium">
                          {wallet.childCount ? "Termasuk kantong" : wallet.currency}
                        </p>
                        {wallet.childCount > 0 && <p className="text-text-secondary text-xs">Saldo utama: {formatCurrency(wallet.balance)}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(wallet)}
                          className="bg-bg-elevated text-text-secondary hover:text-primary hover:bg-primary/10 border-border/50 flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                          title="Edit dompet"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteWallet(wallet.id)}
                          className="bg-bg-elevated text-text-secondary hover:text-danger hover:bg-danger/10 border-border/50 flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                          title="Hapus dompet"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Children / kantong */}
                  {wallet.childCount > 0 && (
                    <ServerPaginatedList<Wallet> path="/wallets" query={{ parentId: wallet.id }} resource="wallets" label="kantong">
                      {(items) => (
                    <div className="border-border mt-4 ml-6 space-y-2 border-l-2 pl-4">
                      {items.map((child) => (
                        <div
                          key={child.id}
                          className="bg-bg-elevated/70 border-border/60 group/child hover:bg-bg-elevated flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-text-secondary shrink-0">
                              <DynamicIcon
                                name={child.icon}
                                className="h-4 w-4"
                              />
                            </span>
                            <span className="text-text-primary truncate text-sm font-medium">
                              {child.name}
                            </span>
                            <Badge variant="purple" size="sm">
                              Kantong
                            </Badge>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-text-primary text-sm font-semibold tabular-nums">
                              {formatCurrency(child.balance)}
                            </span>
                            <button
                              type="button"
                              onClick={() => openEdit(child)}
                              className="text-text-secondary hover:bg-bg-elevated focus-visible:ring-primary flex h-11 w-11 items-center justify-center rounded-lg focus-visible:ring-2"
                              aria-label={`Edit kantong ${child.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteWallet(child.id)}
                              className="text-text-secondary hover:text-danger hover:bg-danger/10 flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                              title="Hapus kantong"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                      )}
                    </ServerPaginatedList>
                  )}

                  {/* Add kantong button */}
                  <button
                    onClick={() => openAdd(wallet.id)}
                    className="text-text-muted hover:text-primary mt-3 ml-6 flex items-center gap-1.5 text-xs transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Tambah Kantong
                  </button>
                </div>
              </Card>
            );
          })}

          {walletPager.initialized && !walletPager.loading && !walletPager.error && walletPager.total === 0 && (
            <Card className="py-16 text-center">
              <WalletIcon className="text-text-muted mx-auto mb-3 h-10 w-10" />
              <p className="text-text-muted text-sm">
                Belum ada dompet. Mulai tambahkan!
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => openAdd()}
                >
                  Tambah Dompet Pertama
                </Button>
              </div>
            </Card>
          )}
          </div>
          <Pagination {...walletPager} label="dompet utama" />
        </div>

        {/* Distribution sidebar */}
        <div>
          <Card>
            <CardHeader>
              <span className="text-text-primary text-sm font-semibold">
                Distribusi Saldo
              </span>
              <Badge variant="default" size="sm">
                % porsi
              </Badge>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {distribution.map((wallet) => {
                  const pct = percentage(wallet.groupBalance, distributionTotal);
                  return (
                    <div key={wallet.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0">
                            <DynamicIcon
                              name={wallet.icon}
                              className="h-5 w-5"
                            />
                          </span>
                          <span className="text-text-secondary truncate font-medium">
                            {wallet.name}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: wallet.color }}
                          >
                            {pct}%
                          </span>
                          <span className="text-text-muted tabular-nums">
                            {formatCurrency(wallet.groupBalance, true)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-bg-elevated h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: wallet.color,
                            boxShadow:
                              pct > 0
                                ? `0 0 8px 0 ${wallet.color}55`
                                : undefined,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {distribution.length === 0 && (
                  <p className="text-text-muted py-6 text-center text-sm">
                    Belum ada data
                  </p>
                )}
              </div>

              {/* Total */}
              {distribution.length > 0 && (
                <div className="border-border mt-5 flex items-center justify-between border-t pt-4">
                  <span className="text-text-muted text-xs">Total Saldo</span>
                  <span className="text-text-primary text-sm font-bold">
                    {formatCurrency(distributionTotal)}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal open={showModal} onClose={closeModal} title={modalTitle} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Dompet"
            placeholder="cth. BCA Tabungan"
            value={form.name}
            onChange={(e) => fld("name", e.target.value)}
            required
          />

          <Input
            label={editingId ? "Saldo setelah penyesuaian" : "Saldo awal"}
            currency
            type="number"
            step="0.01"
            value={form.balance}
            onChange={(e) => fld("balance", e.target.value)}
            hint={
              editingId
                ? "Masukkan saldo dompet ini saja, tanpa menjumlahkan kantong. Penyesuaian tidak dicatat sebagai transaksi."
                : "Masukkan jumlah uang yang sudah ada di dompet."
            }
            required
          />

          {/* Icon picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Ikon
            </label>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {WALLET_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => fld("icon", icon)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                    form.icon === icon
                      ? "bg-primary/20 ring-primary ring-2"
                      : "bg-bg-elevated hover:bg-bg-elevated/80"
                  }`}
                >
                  <DynamicIcon name={icon} className="h-5 w-5" />
                </button>
              ))}
            </div>
            <Input
              placeholder="Atau ketik nama ikon Lucide..."
              value={form.icon}
              onChange={(e) => fld("icon", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Tipe
              </label>
              <select
                value={form.type}
                onChange={(e) => fld("type", e.target.value as WalletType)}
                className="bg-bg-surface border-border text-text-primary focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
              >
                {(
                  Object.entries(WALLET_TYPE_LABELS) as [WalletType, string][]
                ).map(([t, l]) => (
                  <option key={t} value={t}>
                    {l}
                  </option>
                ))}
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

          {/* Parent wallet */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Induk Dompet{" "}
              <span className="text-text-muted font-normal">(opsional)</span>
            </label>
            <select
              value={form.parentId}
              onChange={(e) => fld("parentId", e.target.value)}
              className="bg-bg-surface border-border text-text-primary focus:border-primary focus:ring-primary/20 h-10 rounded-lg border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
            >
              <option value="">(Jadikan Dompet Utama)</option>
              {wallets
                .filter((w) => !w.parentId && w.id !== editingId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button type="submit">
              {editingId
                ? "Simpan Perubahan"
                : form.parentId
                  ? "Tambah Kantong"
                  : "Tambah Dompet"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
