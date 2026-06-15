"use client";

import { useState, useMemo } from "react";
import {
  Layers, Plus, Trash2, Check, ChevronDown, ChevronUp,
  MessageCircle, Phone, Calendar,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, daysUntil } from "~/lib/utils";
import type { DebtDirection } from "~/lib/types";

type ActiveTab = "owe" | "lent";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function DebtsPage() {
  const debts = useFinanceStore((s) => s.debts);
  const addDebt = useFinanceStore((s) => s.addDebt);
  const deleteDebt = useFinanceStore((s) => s.deleteDebt);
  const addDebtInstallment = useFinanceStore((s) => s.addDebtInstallment);
  const settleDebt = useFinanceStore((s) => s.settleDebt);

  const [activeTab, setActiveTab] = useState<ActiveTab>("owe");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState<string | null>(null);

  const [debtForm, setDebtForm] = useState({
    direction: "owe" as DebtDirection, personName: "", contact: "",
    amount: "", dueDate: "", description: "",
  });
  const [installmentForm, setInstallmentForm] = useState({ amount: "", date: "", note: "" });

  const filteredDebts = useMemo(
    () => debts.filter((d) => d.direction === activeTab),
    [debts, activeTab]
  );

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
    if (!debtForm.personName || !debtForm.amount || !debtForm.description) return;
    addDebt({
      direction: debtForm.direction,
      personName: debtForm.personName,
      personContact: debtForm.contact || undefined,
      amount: parseFloat(debtForm.amount),
      paidAmount: 0,
      dueDate: debtForm.dueDate ? new Date(debtForm.dueDate).toISOString() : undefined,
      description: debtForm.description,
      installments: [],
      isSettled: false,
      createdAt: new Date().toISOString(),
    });
    setDebtForm({ direction: "owe", personName: "", contact: "", amount: "", dueDate: "", description: "" });
    setShowDebtModal(false);
  }

  function handleInstallmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showInstallmentModal || !installmentForm.amount) return;
    addDebtInstallment(showInstallmentModal, {
      amount: parseFloat(installmentForm.amount),
      date: installmentForm.date ? new Date(installmentForm.date).toISOString() : new Date().toISOString(),
      note: installmentForm.note || undefined,
    });
    setInstallmentForm({ amount: "", date: "", note: "" });
    setShowInstallmentModal(null);
  }

  const df = (k: keyof typeof debtForm, v: string) => setDebtForm((f) => ({ ...f, [k]: v }));

  const currentDebtForInstallment = debts.find((d) => d.id === showInstallmentModal);

  return (
    <PageWrapper title="Utang & Piutang" subtitle="Pantau utang dan piutang kamu">
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Hutang Saya"
          value={<span className="text-danger">{formatCurrency(totalOwe)}</span>}
          subtitle="Belum dilunasi"
          icon={<Layers />}
          iconColor="#ef4444"
        />
        <StatCard
          title="Total Piutang Saya"
          value={<span className="text-success">{formatCurrency(totalLent)}</span>}
          subtitle="Orang lain hutang ke kamu"
          icon={<Layers />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Nett Posisi"
          value={
            <span className={nett >= 0 ? "text-success" : "text-danger"}>
              {nett >= 0 ? "+" : ""}{formatCurrency(nett)}
            </span>
          }
          subtitle={nett >= 0 ? "Kamu lebih banyak berpiutang" : "Kamu lebih banyak berhutang"}
          icon={<Layers />}
          iconColor="#6366f1"
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl">
          {(["owe", "lent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab === "owe" ? "Hutang Saya" : "Piutang Saya"}
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-bg-base">
                {debts.filter((d) => d.direction === tab).length}
              </span>
            </button>
          ))}
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowDebtModal(true)}>
          Tambah
        </Button>
      </div>

      {/* ── Debt Cards ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredDebts.map((debt) => {
          const remaining = debt.amount - debt.paidAmount;
          const pct = Math.round((debt.paidAmount / debt.amount) * 100);
          const days = debt.dueDate ? daysUntil(debt.dueDate) : null;
          const isExpanded = expandedId === debt.id;

          return (
            <Card key={debt.id} className="group">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    debt.isSettled ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {getInitials(debt.personName)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary text-sm">{debt.personName}</h3>
                        {debt.isSettled ? (
                          <Badge variant="success" size="sm">Lunas</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Aktif</Badge>
                        )}
                        {debt.dueDate && !debt.isSettled && days !== null && (
                          <Badge variant={days < 0 ? "danger" : days <= 7 ? "warning" : "default"} size="sm">
                            {days < 0 ? `Terlambat ${Math.abs(days)} hr` : `${days} hr lagi`}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">{debt.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-text-primary">{formatCurrency(debt.amount)}</p>
                      <p className="text-[10px] text-text-muted">
                        Sisa: <span className={activeTab === "owe" ? "text-danger" : "text-success"}>{formatCurrency(remaining)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Dibayar: {formatCurrency(debt.paidAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar
                      value={debt.paidAmount}
                      max={debt.amount}
                      color={activeTab === "owe" ? "#ef4444" : "#22c55e"}
                    />
                  </div>

                  {/* Actions */}
                  {!debt.isSettled && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInstallmentModal(debt.id)}
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
                      {debt.personContact && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://wa.me/${debt.personContact?.replace(/\D/g, "")}`, "_blank")}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Kirim WA
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Installment history toggle */}
                  {debt.installments.length > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : debt.id)}
                      className="flex items-center gap-1.5 mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {debt.installments.length} catatan cicilan
                    </button>
                  )}

                  {/* Installment list */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 pl-4 border-l-2 border-border">
                      {debt.installments.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between text-xs">
                          <div>
                            <p className="text-text-secondary">{inst.note || "Pembayaran"}</p>
                            <p className="text-text-muted">{formatDate(inst.date)}</p>
                          </div>
                          <span className="font-semibold text-success">+{formatCurrency(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteDebt(debt.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-danger h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          );
        })}

        {filteredDebts.length === 0 && (
          <Card className="py-12 text-center">
            <Layers className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">
              {activeTab === "owe" ? "Kamu tidak punya hutang 🎉" : "Belum ada piutang tercatat"}
            </p>
          </Card>
        )}
      </div>

      {/* ── Add Debt Modal ───────────────────────────────────────────── */}
      <Modal open={showDebtModal} onClose={() => setShowDebtModal(false)} title="Tambah Hutang / Piutang">
        <form onSubmit={handleDebtSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(["owe", "lent"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => df("direction", dir)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                  debtForm.direction === dir
                    ? dir === "owe" ? "border-danger bg-danger/10 text-danger" : "border-success bg-success/10 text-success"
                    : "border-border text-text-muted"
                }`}
              >
                {dir === "owe" ? "Saya Berhutang" : "Orang Lain Berhutang"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nama" placeholder="cth. Ahmad Fauzi" value={debtForm.personName} onChange={(e) => df("personName", e.target.value)} required />
            <Input label="Kontak (WA)" placeholder="0812..." value={debtForm.contact} onChange={(e) => df("contact", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Jumlah (Rp)" type="number" placeholder="0" value={debtForm.amount} onChange={(e) => df("amount", e.target.value)} required />
            <Input label="Jatuh Tempo (opsional)" type="date" value={debtForm.dueDate} onChange={(e) => df("dueDate", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Keterangan</label>
            <textarea
              value={debtForm.description}
              onChange={(e) => df("description", e.target.value)}
              placeholder="Untuk keperluan apa?"
              rows={2}
              required
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowDebtModal(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Installment Modal ────────────────────────────────────── */}
      <Modal
        open={!!showInstallmentModal}
        onClose={() => setShowInstallmentModal(null)}
        title={`Catat Cicilan — ${currentDebtForInstallment?.personName || ""}`}
        size="sm"
      >
        <form onSubmit={handleInstallmentSubmit} className="space-y-4">
          {currentDebtForInstallment && (
            <div className="p-3 rounded-lg bg-bg-elevated text-xs space-y-1">
              <div className="flex justify-between text-text-muted">
                <span>Total</span>
                <span>{formatCurrency(currentDebtForInstallment.amount)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Sudah dibayar</span>
                <span className="text-success">{formatCurrency(currentDebtForInstallment.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-text-primary">Sisa</span>
                <span className="text-warning">{formatCurrency(currentDebtForInstallment.amount - currentDebtForInstallment.paidAmount)}</span>
              </div>
            </div>
          )}
          <Input label="Jumlah Cicilan (Rp)" type="number" placeholder="0" value={installmentForm.amount} onChange={(e) => setInstallmentForm((f) => ({ ...f, amount: e.target.value }))} required />
          <Input label="Tanggal" type="date" value={installmentForm.date} onChange={(e) => setInstallmentForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Catatan (opsional)" placeholder="cth. Bayar via transfer" value={installmentForm.note} onChange={(e) => setInstallmentForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowInstallmentModal(null)}>Batal</Button>
            <Button type="submit">Catat Cicilan</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
