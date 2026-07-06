"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Modal } from "~/components/ui/modal";
import { ProgressBar } from "~/components/ui/progress-bar";
import { StatCard } from "~/components/ui/stat-card";
import { useFinanceStore } from "~/store/useFinanceStore";
import { daysUntil, formatCurrency, formatDate } from "~/lib/utils";
import type { Debt, DebtDirection } from "~/lib/types";

type ActiveTab = "owe" | "lent";

interface DebtContactGroup {
  key: string;
  personName: string;
  personContact?: string;
  debts: Debt[];
  amount: number;
  paidAmount: number;
  remaining: number;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function normalizeContactName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function contactKey(debt: Debt) {
  return `${debt.direction}:${normalizeContactName(debt.personName)}`;
}

export default function DebtsPage() {
  const debts = useFinanceStore((s) => s.debts);
  const addDebt = useFinanceStore((s) => s.addDebt);
  const deleteDebt = useFinanceStore((s) => s.deleteDebt);
  const addDebtInstallment = useFinanceStore((s) => s.addDebtInstallment);
  const settleDebt = useFinanceStore((s) => s.settleDebt);

  const [activeTab, setActiveTab] = useState<ActiveTab>("owe");
  const [expandedContactKey, setExpandedContactKey] = useState<string | null>(
    null,
  );
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState<
    string | null
  >(null);

  const [debtForm, setDebtForm] = useState({
    direction: "owe" as DebtDirection,
    personName: "",
    contact: "",
    amount: "",
    dueDate: "",
    description: "",
  });
  const [installmentForm, setInstallmentForm] = useState({
    amount: "",
    date: "",
    note: "",
  });

  const filteredDebts = useMemo(
    () => debts.filter((d) => d.direction === activeTab),
    [debts, activeTab],
  );

  const groupedDebts = useMemo(() => {
    const map = new Map<string, DebtContactGroup>();

    for (const debt of filteredDebts) {
      const key = contactKey(debt);
      const group = map.get(key) ?? {
        key,
        personName: debt.personName,
        personContact: debt.personContact,
        debts: [],
        amount: 0,
        paidAmount: 0,
        remaining: 0,
      };

      group.debts.push(debt);
      group.amount += debt.amount;
      group.paidAmount += debt.paidAmount;
      if (!debt.isSettled) group.remaining += debt.amount - debt.paidAmount;
      if (!group.personContact && debt.personContact)
        group.personContact = debt.personContact;
      map.set(key, group);
    }

    return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
  }, [filteredDebts]);

  const { totalOwe, totalLent, nett } = useMemo(() => {
    const totalOwe = debts
      .filter((d) => d.direction === "owe" && !d.isSettled)
      .reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    const totalLent = debts
      .filter((d) => d.direction === "lent" && !d.isSettled)
      .reduce((s, d) => s + (d.amount - d.paidAmount), 0);
    return { totalOwe, totalLent, nett: totalLent - totalOwe };
  }, [debts]);

  function handleDebtSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debtForm.personName || !debtForm.amount || !debtForm.description)
      return;

    addDebt({
      direction: debtForm.direction,
      personName: debtForm.personName.trim().replace(/\s+/g, " "),
      personContact: debtForm.contact.trim() || undefined,
      amount: parseFloat(debtForm.amount),
      paidAmount: 0,
      dueDate: debtForm.dueDate
        ? new Date(debtForm.dueDate).toISOString()
        : undefined,
      description: debtForm.description,
      installments: [],
      isSettled: false,
      createdAt: new Date().toISOString(),
    });
    setDebtForm({
      direction: "owe",
      personName: "",
      contact: "",
      amount: "",
      dueDate: "",
      description: "",
    });
    setShowDebtModal(false);
  }

  function handleInstallmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showInstallmentModal || !installmentForm.amount) return;

    addDebtInstallment(showInstallmentModal, {
      amount: parseFloat(installmentForm.amount),
      date: installmentForm.date
        ? new Date(installmentForm.date).toISOString()
        : new Date().toISOString(),
      note: installmentForm.note || undefined,
    });
    setInstallmentForm({ amount: "", date: "", note: "" });
    setShowInstallmentModal(null);
  }

  const df = (k: keyof typeof debtForm, v: string) =>
    setDebtForm((f) => ({ ...f, [k]: v }));

  function openDebtModal() {
    setDebtForm((f) => ({ ...f, direction: activeTab }));
    setShowDebtModal(true);
  }

  const currentDebtForInstallment = debts.find(
    (d) => d.id === showInstallmentModal,
  );

  return (
    <PageWrapper
      title="Utang & Piutang"
      subtitle="Kelompokkan utang per kontak, detail transaksi tetap tersimpan"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Hutang Saya"
          value={
            <span className="text-danger">{formatCurrency(totalOwe)}</span>
          }
          subtitle="Belum dilunasi"
          icon={<Layers />}
          iconColor="#ef4444"
        />
        <StatCard
          title="Total Piutang Saya"
          value={
            <span className="text-success">{formatCurrency(totalLent)}</span>
          }
          subtitle="Orang lain hutang ke kamu"
          icon={<Layers />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Nett Posisi"
          value={
            <span className={nett >= 0 ? "text-success" : "text-danger"}>
              {nett >= 0 ? "+" : ""}
              {formatCurrency(nett)}
            </span>
          }
          subtitle={
            nett >= 0
              ? "Kamu lebih banyak berpiutang"
              : "Kamu lebih banyak berhutang"
          }
          icon={<Layers />}
          iconColor="#FFD147"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="bg-bg-elevated flex gap-1 rounded-xl p-1">
          {(["owe", "lent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab === "owe" ? "Hutang Saya" : "Piutang Saya"}
              <span className="bg-bg-base ml-2 rounded-full px-1.5 py-0.5 text-[10px]">
                {debts.filter((d) => d.direction === tab).length}
              </span>
            </button>
          ))}
        </div>
        <Button
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openDebtModal}
        >
          {activeTab === "owe" ? "Tambah Hutang" : "Tambah Piutang"}
        </Button>
      </div>

      <div className="space-y-3">
        {groupedDebts.map((group) => {
          const isExpanded = expandedContactKey === group.key;
          const activeCount = group.debts.filter((d) => !d.isSettled).length;
          const pct =
            group.amount > 0
              ? Math.round((group.paidAmount / group.amount) * 100)
              : 0;

          return (
            <Card key={group.key} className="group">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${group.remaining > 0 ? "border-primary/30 bg-primary/10 text-text-primary" : "border-success/30 bg-success/10 text-success"}`}
                >
                  {getInitials(group.personName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-text-primary text-sm font-semibold">
                          {group.personName}
                        </h3>
                        <Badge
                          variant={group.remaining > 0 ? "warning" : "success"}
                          size="sm"
                        >
                          {group.remaining > 0
                            ? `${activeCount} aktif`
                            : "Lunas"}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {group.debts.length} transaksi
                        </Badge>
                      </div>
                      {group.personContact && (
                        <p className="text-text-muted mt-0.5 text-xs">
                          {group.personContact}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-text-primary font-bold">
                        {formatCurrency(group.remaining)}
                      </p>
                      <p className="text-text-muted text-[10px]">
                        Total: {formatCurrency(group.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="text-text-muted flex justify-between text-xs">
                      <span>Dibayar: {formatCurrency(group.paidAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar
                      value={group.paidAmount}
                      max={group.amount}
                      color={activeTab === "owe" ? "#ef4444" : "#22c55e"}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedContactKey(isExpanded ? null : group.key)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      Detail Transaksi
                    </Button>
                    {group.personContact && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${group.personContact?.replace(/\D/g, "")}`,
                            "_blank",
                          )
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Kirim WA
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-border mt-4 space-y-3 border-l-2 pl-4">
                      {group.debts.map((debt) => {
                        const remaining = debt.amount - debt.paidAmount;
                        const debtPct = Math.round(
                          (debt.paidAmount / debt.amount) * 100,
                        );
                        const days = debt.dueDate
                          ? daysUntil(debt.dueDate)
                          : null;
                        const debtExpanded = expandedDebtId === debt.id;

                        return (
                          <div
                            key={debt.id}
                            className="bg-bg-elevated/60 rounded-xl p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-text-primary text-sm font-medium">
                                    {debt.description}
                                  </p>
                                  {debt.isSettled ? (
                                    <Badge variant="success" size="sm">
                                      Lunas
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" size="sm">
                                      Aktif
                                    </Badge>
                                  )}
                                  {debt.dueDate &&
                                    !debt.isSettled &&
                                    days !== null && (
                                      <Badge
                                        variant={
                                          days < 0
                                            ? "danger"
                                            : days <= 7
                                              ? "warning"
                                              : "default"
                                        }
                                        size="sm"
                                      >
                                        {days < 0
                                          ? `Terlambat ${Math.abs(days)} hr`
                                          : `${days} hr lagi`}
                                      </Badge>
                                    )}
                                </div>
                                <p className="text-text-muted mt-0.5 text-xs">
                                  Dibuat: {formatDate(debt.createdAt)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-text-primary text-sm font-bold">
                                  {formatCurrency(debt.amount)}
                                </p>
                                <p className="text-text-muted text-[10px]">
                                  Sisa: {formatCurrency(remaining)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 space-y-1">
                              <div className="text-text-muted flex justify-between text-xs">
                                <span>
                                  Dibayar: {formatCurrency(debt.paidAmount)}
                                </span>
                                <span>{debtPct}%</span>
                              </div>
                              <ProgressBar
                                value={debt.paidAmount}
                                max={debt.amount}
                                color={
                                  activeTab === "owe" ? "#ef4444" : "#22c55e"
                                }
                                size="sm"
                              />
                            </div>

                            {!debt.isSettled && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setShowInstallmentModal(debt.id)
                                  }
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Catat Cicilan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => settleDebt(debt.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Lunas
                                </Button>
                                <button
                                  onClick={() => deleteDebt(debt.id)}
                                  className="text-text-muted hover:bg-danger/10 hover:text-danger flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                                  aria-label="Hapus transaksi utang"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {debt.installments.length > 0 && (
                              <button
                                onClick={() =>
                                  setExpandedDebtId(
                                    debtExpanded ? null : debt.id,
                                  )
                                }
                                className="text-text-muted hover:text-text-secondary mt-3 flex items-center gap-1.5 text-xs transition-colors"
                              >
                                {debtExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                {debt.installments.length} catatan cicilan
                              </button>
                            )}

                            {debtExpanded && (
                              <div className="border-border mt-3 space-y-2 border-l-2 pl-4">
                                {debt.installments.map((inst) => (
                                  <div
                                    key={inst.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="text-text-secondary">
                                        {inst.note || "Pembayaran"}
                                      </p>
                                      <p className="text-text-muted">
                                        {formatDate(inst.date)}
                                      </p>
                                    </div>
                                    <span className="text-success font-semibold">
                                      +{formatCurrency(inst.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {groupedDebts.length === 0 && (
          <Card className="py-12 text-center">
            <Layers className="text-text-muted mx-auto mb-3 h-10 w-10" />
            <p className="text-text-muted text-sm">
              {activeTab === "owe"
                ? "Kamu tidak punya hutang"
                : "Belum ada piutang tercatat"}
            </p>
          </Card>
        )}
      </div>

      <Modal
        open={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        title={
          debtForm.direction === "owe" ? "Tambah Hutang" : "Tambah Piutang"
        }
      >
        <form onSubmit={handleDebtSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(["owe", "lent"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => df("direction", dir)}
                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors ${
                  debtForm.direction === dir
                    ? dir === "owe"
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-success bg-success/10 text-success"
                    : "border-border text-text-muted"
                }`}
              >
                {dir === "owe" ? "Saya Berhutang" : "Orang Lain Berhutang"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Kontak"
              placeholder="cth. Ahmad Fauzi"
              value={debtForm.personName}
              onChange={(e) => df("personName", e.target.value)}
              required
            />
            <Input
              label="Kontak (WA)"
              placeholder="0812..."
              value={debtForm.contact}
              onChange={(e) => df("contact", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Jumlah Transaksi (Rp)"
              type="number"
              placeholder="0"
              value={debtForm.amount}
              onChange={(e) => df("amount", e.target.value)}
              required
            />
            <Input
              label="Jatuh Tempo (opsional)"
              type="date"
              value={debtForm.dueDate}
              onChange={(e) => df("dueDate", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Keterangan Transaksi
            </label>
            <textarea
              value={debtForm.description}
              onChange={(e) => df("description", e.target.value)}
              placeholder="cth. Pinjam bulan Januari"
              rows={2}
              required
              className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDebtModal(false)}
            >
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!showInstallmentModal}
        onClose={() => setShowInstallmentModal(null)}
        title={`Catat Cicilan — ${currentDebtForInstallment?.personName || ""}`}
        size="sm"
      >
        <form onSubmit={handleInstallmentSubmit} className="space-y-4">
          {currentDebtForInstallment && (
            <div className="bg-bg-elevated space-y-1 rounded-lg p-3 text-xs">
              <div className="text-text-muted flex justify-between">
                <span>Total transaksi</span>
                <span>{formatCurrency(currentDebtForInstallment.amount)}</span>
              </div>
              <div className="text-text-muted flex justify-between">
                <span>Sudah dibayar</span>
                <span className="text-success">
                  {formatCurrency(currentDebtForInstallment.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-text-primary">Sisa</span>
                <span className="text-warning">
                  {formatCurrency(
                    currentDebtForInstallment.amount -
                      currentDebtForInstallment.paidAmount,
                  )}
                </span>
              </div>
            </div>
          )}
          <Input
            label="Jumlah Cicilan (Rp)"
            type="number"
            placeholder="0"
            value={installmentForm.amount}
            onChange={(e) =>
              setInstallmentForm((f) => ({ ...f, amount: e.target.value }))
            }
            required
          />
          <Input
            label="Tanggal"
            type="date"
            value={installmentForm.date}
            onChange={(e) =>
              setInstallmentForm((f) => ({ ...f, date: e.target.value }))
            }
          />
          <Input
            label="Catatan (opsional)"
            placeholder="cth. Bayar via transfer"
            value={installmentForm.note}
            onChange={(e) =>
              setInstallmentForm((f) => ({ ...f, note: e.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInstallmentModal(null)}
            >
              Batal
            </Button>
            <Button type="submit">Catat Cicilan</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
