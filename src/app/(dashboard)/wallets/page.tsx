"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Wallet as WalletIcon,
  Layers,
  Coins,
  ChevronRight,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardBody } from "~/components/ui/card";
import { CardHead } from "~/components/ui/card-head";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { Input } from "~/components/ui/input";
import { IconTile } from "~/components/ui/icon-tile";
import { useFinanceStore } from "~/store/useFinanceStore";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { formatCurrency, percentage } from "~/lib/utils";
import type { Wallet, WalletType } from "~/lib/types";
import { IconPicker } from "~/components/ui/icon-picker";
import { Pagination } from "~/components/ui/pagination";
import { ServerListStatus, ServerPaginatedList } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";
import { walletGroupBalance } from "~/lib/wallets";

// ─── Constants ─────────────────────────────────────────────────────────────────

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  bank: "Bank",
  rdn: "RDN",
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
  const biggest = distribution[0];
  const biggestPct = biggest ? percentage(biggest.groupBalance, distributionTotal) : 0;

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
      {/* ── Hero: the one number the page exists for ─────────────────────── */}
      <section className="card">
        <CardHead
          title="Total saldo"
          subtitle={`${parentCount} dompet utama, ${childCount} kantong`}
        />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <span className="text-text-primary text-[clamp(34px,4vw,46px)] leading-none font-semibold tracking-tight tabular-nums">
            {formatCurrency(totalBalance)}
          </span>
          {biggest && (
            <div className="flex items-center gap-2.5 pb-1">
              <IconTile icon={biggest.icon} color={biggest.color} />
              <p className="text-text-muted text-xs">
                Terbesar:{" "}
                <span className="text-text-primary font-semibold">
                  {biggest.name}
                </span>{" "}
                · {biggestPct}% dari total
              </p>
            </div>
          )}
        </div>

        {/* Distribution strip: every wallet, one bar, its own colour. Width
            carries the share; the legend below carries the numbers. */}
        {distribution.length > 0 && (
          <div className="bg-bg-base mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {distribution.map((wallet) => {
              const pct = percentage(wallet.groupBalance, distributionTotal);
              if (pct <= 0) return null;
              return (
                <div
                  key={wallet.id}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, backgroundColor: wallet.color }}
                  title={`${wallet.name} ${pct}%`}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="page-grid grid-cols-1 xl:grid-cols-3">
        {/* Wallet cards */}
        <div className="page-stack xl:col-span-2">
          <ServerListStatus {...walletPager} />
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
                      <IconTile
                        icon={wallet.icon}
                        color={wallet.color}
                        size="lg"
                        className="h-11 w-11 rounded-[13px]"
                      />
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
                          className="bg-bg-elevated text-text-secondary hover:text-primary hover:bg-primary/10 border-border/50 flex h-11 w-11 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                          title="Edit dompet"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteWallet(wallet.id)}
                          className="bg-bg-elevated text-text-secondary hover:text-danger hover:bg-danger/10 border-border/50 flex h-11 w-11 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-primary"
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
                          className="bg-bg-elevated/70 border-border/60 group/child hover:bg-bg-elevated flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <IconTile icon={child.icon} color={child.color} size="sm" />
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
                              className="text-text-secondary hover:bg-bg-elevated focus-visible:ring-primary flex h-11 w-11 items-center justify-center rounded-md focus-visible:ring-2"
                              aria-label={`Edit kantong ${child.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteWallet(child.id)}
                              className="text-text-secondary hover:text-danger hover:bg-danger/10 flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-primary"
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
                    className="text-text-muted hover:text-primary mt-3 ml-6 flex items-center gap-1.5 text-xs transition-colors max-sm:min-h-11"
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
          <Pagination {...walletPager} label="dompet utama" />
        </div>

        {/* Distribution sidebar */}
        <div className="page-stack">
          <Card>
            <CardHead
              title="Distribusi saldo"
              subtitle="Porsi tiap dompet dari total"
            />
            <CardBody>
              <div className="space-y-4">
                {distribution.map((wallet) => {
                  const pct = percentage(wallet.groupBalance, distributionTotal);
                  return (
                    <div key={wallet.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <IconTile icon={wallet.icon} color={wallet.color} size="sm" />
                          <span className="text-text-secondary truncate font-medium">
                            {wallet.name}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          <span className="text-text-primary font-semibold tabular-nums">
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

          <Card>
            <CardHead title="Ringkasan" />
            <CardBody>
              <div className="space-y-1">
                {[
                  { icon: WalletIcon, hue: "var(--primary)", label: "Dompet utama", value: String(parentCount) },
                  { icon: Layers, hue: "var(--success)", label: "Kantong aktif", value: String(childCount) },
                  { icon: Coins, hue: "var(--warning)", label: "Rata-rata per dompet", value: parentCount > 0 ? formatCurrency(Math.round(totalBalance / parentCount), true) : "0" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="border-border-subtle flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0"
                  >
                    <span
                      className="icon-tile h-7 w-7 rounded-[9px]"
                      style={{ "--tile-hue": row.hue } as React.CSSProperties}
                      aria-hidden
                    >
                      <row.icon className="h-4 w-4" />
                    </span>
                    <span className="text-text-secondary flex-1 text-sm">{row.label}</span>
                    <span className="text-text-primary text-sm font-bold tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
              {biggest && biggestPct > 0 && (
                <p className="text-text-muted mt-4 text-xs">
                  Konsentrasi tertinggi di{" "}
                  <span className="text-text-secondary font-semibold">{biggest.name}</span>
                  {" "}({biggestPct}%). Kalau dompet itu bermasalah, yang lain ikut terasa.
                </p>
              )}
            </CardBody>
          </Card>

          <button
            onClick={() => openAdd()}
            className="group border-border/60 hover:border-primary/40 hover:bg-primary/6 flex items-center justify-between rounded-xl border border-dashed p-4 text-left transition-colors max-sm:min-h-11"
          >
            <span className="flex items-center gap-3">
              <span className="bg-primary/12 text-[color:var(--primary-on-tint)] flex h-8 w-8 items-center justify-center rounded-[10px]">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-text-secondary text-sm font-medium">
                Dompet baru, kartu kredit, atau kantong tunai
              </span>
            </span>
            <ChevronRight className="text-text-muted group-hover:text-primary h-4 w-4 transition-colors" />
          </button>
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

          <IconPicker
            value={form.icon}
            onChange={(icon) => fld("icon", icon)}
            quickIcons={WALLET_ICONS}
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Tipe
              </label>
              <select
                value={form.type}
                onChange={(e) => fld("type", e.target.value as WalletType)}
                className="bg-bg-surface border-border text-text-primary focus:border-primary focus:ring-primary/20 h-10 max-sm:h-11 rounded-md border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
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
              <div className="flex h-10 max-sm:h-11 items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => fld("color", e.target.value)}
                  className="border-border bg-bg-surface h-9 w-14 cursor-pointer rounded-md border p-1"
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
              className="bg-bg-surface border-border text-text-primary focus:border-primary focus:ring-primary/20 h-10 max-sm:h-11 rounded-md border px-3 text-sm transition-colors focus:ring-1 focus:outline-none"
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
