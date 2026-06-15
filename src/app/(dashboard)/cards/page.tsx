"use client";

import { useState, useMemo } from "react";
import { CreditCard, Plus, Trash2, Edit, Calendar, AlertTriangle } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency } from "~/lib/utils";
import type { CardType } from "~/lib/types";

const BANK_GRADIENTS: Record<string, string> = {
  BCA: "from-blue-600 to-indigo-900",
  Mandiri: "from-yellow-500 to-orange-700",
  BRI: "from-cyan-600 to-teal-800",
  BNI: "from-orange-500 to-red-700",
  "CIMB Niaga": "from-red-600 to-red-900",
  "CIMB": "from-red-600 to-red-900",
  Permata: "from-violet-600 to-purple-900",
  Danamon: "from-pink-600 to-rose-900",
  Lainnya: "from-slate-600 to-slate-900",
};

function getBankGradient(bank: string): string {
  return BANK_GRADIENTS[bank] || BANK_GRADIENTS.Lainnya;
}

const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga", "Permata", "Danamon", "Lainnya"];

export default function CardsPage() {
  const cards = useFinanceStore((s) => s.cards);
  const addCard = useFinanceStore((s) => s.addCard);
  const deleteCard = useFinanceStore((s) => s.deleteCard);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "", bank: "BCA", type: "credit" as CardType, last4Digits: "",
    limit: "", billingCycleStart: "1", statementDate: "25", dueDate: "10", interestRate: "2.25",
  });

  const { totalLimit, totalUsed } = useMemo(() => {
    return cards
      .filter((c) => c.type === "credit")
      .reduce(
        (acc, c) => ({ totalLimit: acc.totalLimit + (c.limit || 0), totalUsed: acc.totalUsed + (c.used || 0) }),
        { totalLimit: 0, totalUsed: 0 }
      );
  }, [cards]);

  const creditCards = cards.filter((c) => c.type === "credit");
  const debitCards = cards.filter((c) => c.type === "debit");

  // Upcoming billing dates in next 30 days
  const today = new Date();
  const billingEvents = useMemo(() => {
    const events: { name: string; date: number; label: string; type: string }[] = [];
    cards.forEach((card) => {
      if (card.type === "credit") {
        events.push({ name: card.name, date: card.statementDate, label: "Tanggal Cetak Struk", type: "statement" });
        events.push({ name: card.name, date: card.dueDate, label: "Jatuh Tempo", type: "due" });
      }
    });
    return events.sort((a, b) => {
      const aDay = a.date >= today.getDate() ? a.date : a.date + 31;
      const bDay = b.date >= today.getDate() ? b.date : b.date + 31;
      return aDay - bDay;
    });
  }, [cards]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.last4Digits || !form.bank) return;
    addCard({
      name: form.name,
      bank: form.bank,
      type: form.type,
      last4Digits: form.last4Digits.slice(-4),
      limit: form.type === "credit" ? parseFloat(form.limit || "0") : undefined,
      used: form.type === "credit" ? 0 : undefined,
      billingCycleStart: parseInt(form.billingCycleStart),
      statementDate: parseInt(form.statementDate),
      dueDate: parseInt(form.dueDate),
      color: getBankGradient(form.bank),
      interestRate: form.type === "credit" ? parseFloat(form.interestRate || "2") : undefined,
    });
    setForm({ name: "", bank: "BCA", type: "credit", last4Digits: "", limit: "", billingCycleStart: "1", statementDate: "25", dueDate: "10", interestRate: "2.25" });
    setShowModal(false);
  }

  const fld = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <PageWrapper
      title="Kartu"
      subtitle="Kelola kartu kredit dan debit kamu"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Tambah Kartu
        </Button>
      }
    >
      {/* ── Summary Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Kartu" value={cards.length} subtitle={`${creditCards.length} kredit, ${debitCards.length} debit`} icon={<CreditCard />} iconColor="#6366f1" />
        <StatCard title="Total Limit Kredit" value={formatCurrency(totalLimit)} icon={<CreditCard />} iconColor="#22c55e" />
        <StatCard
          title="Total Digunakan"
          value={formatCurrency(totalUsed)}
          subtitle={totalLimit > 0 ? `${Math.round((totalUsed / totalLimit) * 100)}% dari limit` : ""}
          icon={<AlertTriangle />}
          iconColor={totalUsed / totalLimit > 0.7 ? "#ef4444" : "#f59e0b"}
        />
      </div>

      {/* ── Credit Utilization Bar ─────────────────────────────────── */}
      {creditCards.length > 0 && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-text-primary">Credit Utilization</span>
            <span className="text-xs text-text-muted">
              {formatCurrency(totalUsed)} / {formatCurrency(totalLimit)} ({Math.round((totalUsed / totalLimit) * 100)}%)
            </span>
          </CardHeader>
          <CardBody>
            <ProgressBar
              value={totalUsed}
              max={totalLimit}
              animated
              showLabel
              color={totalUsed / totalLimit > 0.7 ? "#ef4444" : totalUsed / totalLimit > 0.4 ? "#f59e0b" : "#22c55e"}
            />
            <p className="text-xs text-text-muted mt-2">
              Ideal di bawah 30% dari total limit. Sisa tersedia:{" "}
              <span className="text-text-primary font-medium">{formatCurrency(totalLimit - totalUsed)}</span>
            </p>
          </CardBody>
        </Card>
      )}

      {/* ── Cards Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="group relative">
            {/* Visual Card */}
            <div
              className={`relative h-48 rounded-2xl p-6 bg-gradient-to-br ${getBankGradient(card.bank)} overflow-hidden select-none`}
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            >
              {/* Background circles */}
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
              <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

              {/* Top row */}
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-white/60 text-xs font-medium tracking-widest uppercase">{card.bank}</p>
                  <p className="text-white text-sm font-semibold mt-0.5">{card.name}</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${card.type === "credit" ? "bg-white/20 text-white" : "bg-white/15 text-white/80"}`}>
                  {card.type === "credit" ? "CREDIT" : "DEBIT"}
                </div>
              </div>

              {/* Card number */}
              <div className="mt-6 relative z-10">
                <p className="text-white/80 text-base font-mono tracking-[0.2em]">
                  •••• •••• •••• {card.last4Digits}
                </p>
              </div>

              {/* Bottom row */}
              <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between z-10">
                <div>
                  {card.type === "credit" && card.limit && (
                    <div>
                      <p className="text-white/50 text-[10px] uppercase tracking-wide">Available</p>
                      <p className="text-white text-sm font-bold">
                        {formatCurrency((card.limit || 0) - (card.used || 0))}
                      </p>
                    </div>
                  )}
                </div>
                {/* Card network logo */}
                <div className="flex items-center gap-0.5">
                  <div className="w-7 h-7 rounded-full bg-red-500/80" />
                  <div className="w-7 h-7 rounded-full bg-yellow-500/60 -ml-3" />
                </div>
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => deleteCard(card.id)}
              className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-black/30 text-white/70 hover:text-white hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {/* Card Details */}
            <div className="mt-3 space-y-2 px-1">
              {card.type === "credit" && card.limit && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Digunakan</span>
                    <span>{formatCurrency(card.used || 0)} / {formatCurrency(card.limit)}</span>
                  </div>
                  <ProgressBar value={card.used || 0} max={card.limit} animated />
                </div>
              )}
              <div className="flex gap-3 text-xs text-text-muted flex-wrap">
                {card.type === "credit" && (
                  <>
                    <span>Cetak struk: tgl {card.statementDate}</span>
                    <span>•</span>
                    <span>Jatuh tempo: tgl {card.dueDate}</span>
                  </>
                )}
                {card.interestRate && (
                  <span className="text-warning">Bunga {card.interestRate}%/bln</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="col-span-full">
            <Card className="py-12 text-center">
              <CreditCard className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted">Belum ada kartu terdaftar</p>
            </Card>
          </div>
        )}
      </div>

      {/* ── Billing Calendar ────────────────────────────────────────── */}
      {billingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-text-primary">Jadwal Billing</span>
            <Badge variant="default" size="sm">30 hari ke depan</Badge>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {billingEvents.map((evt, i) => {
                const daysLeft = evt.date >= today.getDate()
                  ? evt.date - today.getDate()
                  : 30 - today.getDate() + evt.date;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      evt.type === "due" ? "border-warning/30 bg-warning/5" : "border-border bg-bg-elevated"
                    }`}
                  >
                    <div
                      className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center ${
                        evt.type === "due" ? "bg-warning/20" : "bg-primary/10"
                      }`}
                    >
                      <span className={`text-lg font-bold leading-none ${evt.type === "due" ? "text-warning" : "text-primary"}`}>
                        {evt.date}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{evt.name}</p>
                      <p className="text-xs text-text-muted">{evt.label}</p>
                    </div>
                    <span className={`text-xs font-medium ${daysLeft <= 3 ? "text-danger" : daysLeft <= 7 ? "text-warning" : "text-text-muted"}`}>
                      {daysLeft === 0 ? "Hari ini" : `${daysLeft} hr`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Add Card Modal ───────────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Tambah Kartu" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Bank</label>
              <select value={form.bank} onChange={(e) => fld("bank", e.target.value)}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {BANKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Tipe Kartu</label>
              <select value={form.type} onChange={(e) => fld("type", e.target.value)}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="credit">Credit Card</option>
                <option value="debit">Debit Card</option>
              </select>
            </div>
          </div>
          <Input label="Nama Kartu" placeholder="cth. BCA Visa Platinum" value={form.name} onChange={(e) => fld("name", e.target.value)} required />
          <Input label="4 Digit Terakhir" placeholder="0000" maxLength={4} value={form.last4Digits} onChange={(e) => fld("last4Digits", e.target.value.replace(/\D/g, ""))} required />
          {form.type === "credit" && (
            <>
              <Input label="Limit (Rp)" type="number" placeholder="0" value={form.limit} onChange={(e) => fld("limit", e.target.value)} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Tgl Mulai Billing" type="number" min={1} max={31} value={form.billingCycleStart} onChange={(e) => fld("billingCycleStart", e.target.value)} />
                <Input label="Tgl Cetak Struk" type="number" min={1} max={31} value={form.statementDate} onChange={(e) => fld("statementDate", e.target.value)} />
                <Input label="Tgl Jatuh Tempo" type="number" min={1} max={31} value={form.dueDate} onChange={(e) => fld("dueDate", e.target.value)} />
              </div>
              <Input label="Bunga per Bulan (%)" type="number" step="0.01" value={form.interestRate} onChange={(e) => fld("interestRate", e.target.value)} />
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit">Simpan Kartu</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
