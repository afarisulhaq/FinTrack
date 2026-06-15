"use client";

import { useState, useMemo } from "react";
import { Receipt, Plus, Trash2, Check, Building, Wallet } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate } from "~/lib/utils";
import type { ReimbursementStatus } from "~/lib/types";

type StatusFilter = "Semua" | ReimbursementStatus;

const WALLETS = ["BCA Tabungan", "BCA Credit Card", "Mandiri Tabungan", "Tunai", "CIMB Credit Card", "GoPay"];

export default function ReimbursementPage() {
  const reimbursements = useFinanceStore((s) => s.reimbursements);
  const addReimbursement = useFinanceStore((s) => s.addReimbursement);
  const deleteReimbursement = useFinanceStore((s) => s.deleteReimbursement);
  const settleReimbursement = useFinanceStore((s) => s.settleReimbursement);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "", amount: "", paidFrom: "BCA Tabungan", walletName: "BCA Tabungan",
    project: "", company: "", submittedDate: "", notes: "", receiptUrl: "",
  });

  const filtered = useMemo(
    () => statusFilter === "Semua" ? reimbursements : reimbursements.filter((r) => r.status === statusFilter),
    [reimbursements, statusFilter]
  );

  const { totalActive, totalSettled } = useMemo(() => ({
    totalActive: reimbursements.filter((r) => r.status === "active").reduce((s, r) => s + r.amount, 0),
    totalSettled: reimbursements.filter((r) => r.status === "settled").reduce((s, r) => s + r.amount, 0),
  }), [reimbursements]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.amount || !form.company) return;
    addReimbursement({
      title: form.title,
      amount: parseFloat(form.amount),
      paidFrom: form.paidFrom,
      walletName: form.walletName,
      project: form.project || undefined,
      company: form.company,
      status: "active",
      submittedDate: form.submittedDate ? new Date(form.submittedDate).toISOString() : new Date().toISOString(),
      notes: form.notes || undefined,
      receiptUrl: form.receiptUrl || undefined,
    });
    setForm({ title: "", amount: "", paidFrom: "BCA Tabungan", walletName: "BCA Tabungan", project: "", company: "", submittedDate: "", notes: "", receiptUrl: "" });
    setShowModal(false);
  }

  const fld = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    { key: "active", label: "Aktif" },
    { key: "settled", label: "Lunas" },
  ];

  return (
    <PageWrapper
      title="Reimbursement"
      subtitle="Pantau klaim pengeluaran kamu"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Tambah
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Aktif"
          value={<span className="text-warning">{formatCurrency(totalActive)}</span>}
          subtitle="Belum dikembalikan"
          icon={<Receipt />}
          iconColor="#f59e0b"
        />
        <StatCard title="Total Lunas" value={formatCurrency(totalSettled)} subtitle="Sudah dikembalikan" icon={<Check />} iconColor="#22c55e" />
        <StatCard
          title="Grand Total"
          value={formatCurrency(totalActive + totalSettled)}
          subtitle={`${reimbursements.length} pengajuan`}
          icon={<Receipt />}
          iconColor="#6366f1"
        />
      </div>

      {/* ── Status Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === t.key ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
            {t.key !== "Semua" && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-bg-base">
                {reimbursements.filter((r) => r.status === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Cards List ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((r) => (
          <Card key={r.id} className="group">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${r.status === "active" ? "bg-warning/10" : "bg-success/10"}`}>
                <Receipt className={`h-5 w-5 ${r.status === "active" ? "text-warning" : "text-success"}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-text-primary text-sm">{r.title}</h3>
                      {r.project && <Badge variant="purple" size="sm">{r.project}</Badge>}
                      <Badge variant={r.status === "active" ? "warning" : "success"} size="sm">
                        {r.status === "active" ? "Aktif" : "Lunas"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {r.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {r.walletName}
                      </span>
                      <span>Diajukan: {formatDate(r.submittedDate)}</span>
                      {r.status === "settled" && r.settledDate && (
                        <span className="text-success">Lunas: {formatDate(r.settledDate)}</span>
                      )}
                    </div>
                    {r.notes && <p className="text-xs text-text-muted mt-1 italic">{r.notes}</p>}
                  </div>
                  <span className="shrink-0 text-xl font-bold text-text-primary">{formatCurrency(r.amount)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {r.status === "active" && (
                  <button
                    onClick={() => settleReimbursement(r.id)}
                    className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-xs font-medium"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Tandai Lunas
                  </button>
                )}
                <button
                  onClick={() => deleteReimbursement(r.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="py-12 text-center">
            <Receipt className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">Tidak ada reimbursement ditemukan</p>
          </Card>
        )}
      </div>

      {/* ── Add Reimbursement Modal ──────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Tambah Reimbursement" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Judul" placeholder="cth. Perjalanan Dinas" value={form.title} onChange={(e) => fld("title", e.target.value)} required />
            <Input label="Jumlah (Rp)" type="number" placeholder="0" value={form.amount} onChange={(e) => fld("amount", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Dibayar dari</label>
              <select
                value={form.paidFrom}
                onChange={(e) => { fld("paidFrom", e.target.value); fld("walletName", e.target.value); }}
                className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {WALLETS.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
            <Input label="Perusahaan / Klien" placeholder="cth. PT Maju Bersama" value={form.company} onChange={(e) => fld("company", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Proyek (opsional)" placeholder="cth. Project Alpha" value={form.project} onChange={(e) => fld("project", e.target.value)} />
            <Input label="Tanggal Pengajuan" type="date" value={form.submittedDate} onChange={(e) => fld("submittedDate", e.target.value)} />
          </div>
          <Input label="URL Bukti / Struk (opsional)" placeholder="https://..." value={form.receiptUrl} onChange={(e) => fld("receiptUrl", e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Catatan</label>
            <textarea value={form.notes} onChange={(e) => fld("notes", e.target.value)}
              placeholder="Detail pengeluaran..." rows={2}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
