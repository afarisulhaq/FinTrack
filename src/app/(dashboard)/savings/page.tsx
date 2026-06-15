"use client";

import { useState, useMemo } from "react";
import { PiggyBank, Plus, Trash2, Edit, Target, Calendar, Zap } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, daysUntil, percentage } from "~/lib/utils";

const GOAL_ICONS = ["🏡", "💻", "🛡️", "⛩️", "💍", "🏖️", "🚗", "🏍️", "📱", "🎓", "✈️", "💰", "🎁", "🌟"];
const GOAL_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#38bdf8", "#ec4899", "#8b5cf6", "#f97316"];
const WALLETS = ["BCA Tabungan", "Mandiri Tabungan", "BRI Tabungan", "Dana", "GoPay", "OVO"];

export default function SavingsPage() {
  const savingGoals = useFinanceStore((s) => s.savingGoals);
  const addSavingGoal = useFinanceStore((s) => s.addSavingGoal);
  const deleteSavingGoal = useFinanceStore((s) => s.deleteSavingGoal);
  const contributeToGoal = useFinanceStore((s) => s.contributeToGoal);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({
    name: "", icon: "🌟", targetAmount: "", deadline: "",
    autoSave: false, autoSaveAmount: "", walletId: "BCA Tabungan", color: "#6366f1",
  });
  const [fundsForm, setFundsForm] = useState({ amount: "", note: "" });

  const { totalTarget, totalCollected, avgProgress } = useMemo(() => {
    const totalTarget = savingGoals.reduce((s, g) => s + g.targetAmount, 0);
    const totalCollected = savingGoals.reduce((s, g) => s + g.currentAmount, 0);
    const avgProgress =
      savingGoals.length > 0
        ? savingGoals.reduce((s, g) => s + percentage(g.currentAmount, g.targetAmount), 0) / savingGoals.length
        : 0;
    return { totalTarget, totalCollected, avgProgress };
  }, [savingGoals]);

  function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goalForm.name || !goalForm.targetAmount || !goalForm.deadline) return;
    addSavingGoal({
      name: goalForm.name,
      icon: goalForm.icon,
      targetAmount: parseFloat(goalForm.targetAmount),
      currentAmount: 0,
      deadline: new Date(goalForm.deadline).toISOString(),
      color: goalForm.color,
      walletId: goalForm.walletId,
      autoSave: goalForm.autoSave,
      autoSaveAmount: goalForm.autoSave ? parseFloat(goalForm.autoSaveAmount || "0") : undefined,
    });
    setGoalForm({ name: "", icon: "🌟", targetAmount: "", deadline: "", autoSave: false, autoSaveAmount: "", walletId: "BCA Tabungan", color: "#6366f1" });
    setShowGoalModal(false);
  }

  function handleFundsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showFundsModal || !fundsForm.amount) return;
    contributeToGoal(showFundsModal, parseFloat(fundsForm.amount));
    setFundsForm({ amount: "", note: "" });
    setShowFundsModal(null);
  }

  const gf = (k: keyof typeof goalForm, v: string | boolean) => setGoalForm((f) => ({ ...f, [k]: v }));

  return (
    <PageWrapper
      title="Tabungan"
      subtitle="Pantau progress saving goals kamu"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowGoalModal(true)}>
          Tambah Goal
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Target" value={formatCurrency(totalTarget)} icon={<Target />} iconColor="#6366f1" />
        <StatCard title="Total Terkumpul" value={formatCurrency(totalCollected)} icon={<PiggyBank />} iconColor="#22c55e" />
        <StatCard
          title="Rata-rata Progress"
          value={`${Math.round(avgProgress)}%`}
          subtitle={`${savingGoals.length} goal aktif`}
          icon={<Zap />}
          iconColor="#f59e0b"
        />
      </div>

      {/* ── Goal Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savingGoals.map((goal) => {
          const pct = percentage(goal.currentAmount, goal.targetAmount);
          const days = goal.deadline ? daysUntil(goal.deadline) : null;
          const remaining = goal.targetAmount - goal.currentAmount;
          return (
            <Card key={goal.id} className="group flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: goal.color + "20" }}
                  >
                    {goal.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">{goal.name}</h3>
                    {goal.walletId && (
                      <p className="text-xs text-text-muted mt-0.5">{goal.walletId}</p>
                    )}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => deleteSavingGoal(goal.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-text-primary">{formatCurrency(goal.currentAmount)}</span>
                  <span className="text-text-muted text-xs">dari {formatCurrency(goal.targetAmount)}</span>
                </div>
                <ProgressBar value={goal.currentAmount} max={goal.targetAmount} color={goal.color} />
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: goal.color }}
                  >
                    {pct}% tercapai
                  </span>
                  <span className="text-xs text-text-muted">Kurang {formatCurrency(remaining)}</span>
                </div>
              </div>

              {/* Deadline & Auto-save */}
              <div className="flex items-center gap-3 text-xs">
                {goal.deadline && (
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(goal.deadline)}</span>
                    {days !== null && days > 0 && (
                      <span className="text-warning">({days} hari lagi)</span>
                    )}
                  </div>
                )}
                {goal.autoSave && goal.autoSaveAmount && (
                  <div className="flex items-center gap-1.5 text-success">
                    <Zap className="h-3 w-3" />
                    <span>Auto-save {formatCurrency(goal.autoSaveAmount)}/bln</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowFundsModal(goal.id)}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Dana
              </Button>
            </Card>
          );
        })}

        {/* Empty State */}
        {savingGoals.length === 0 && (
          <div className="col-span-full">
            <Card className="py-12 text-center">
              <PiggyBank className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted">Belum ada saving goal. Mulai sekarang!</p>
            </Card>
          </div>
        )}
      </div>

      {/* ── Add Goal Modal ───────────────────────────────────────────── */}
      <Modal open={showGoalModal} onClose={() => setShowGoalModal(false)} title="Tambah Saving Goal" size="md">
        <form onSubmit={handleGoalSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nama Goal" placeholder="cth. DP Rumah" value={goalForm.name} onChange={(e) => gf("name", e.target.value)} required />
            <Input label="Target (Rp)" type="number" placeholder="0" value={goalForm.targetAmount} onChange={(e) => gf("targetAmount", e.target.value)} required />
          </div>
          <Input label="Deadline" type="date" value={goalForm.deadline} onChange={(e) => gf("deadline", e.target.value)} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Ikon</label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => gf("icon", icon)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${goalForm.icon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-bg-elevated"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Warna</label>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => gf("color", c)}
                  className={`w-7 h-7 rounded-full transition-all ${goalForm.color === c ? "ring-2 ring-offset-2 ring-offset-bg-surface ring-white scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Wallet Sumber</label>
            <select value={goalForm.walletId} onChange={(e) => gf("walletId", e.target.value)}
              className="h-10 px-3 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {WALLETS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
            <div>
              <p className="text-sm font-medium text-text-primary">Auto-save</p>
              <p className="text-xs text-text-muted">Otomatis menabung setiap bulan</p>
            </div>
            <button
              type="button"
              onClick={() => gf("autoSave", !goalForm.autoSave)}
              className={`relative w-10 h-5 rounded-full transition-colors ${goalForm.autoSave ? "bg-primary" : "bg-bg-base"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${goalForm.autoSave ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {goalForm.autoSave && (
            <Input label="Jumlah Auto-save / bulan (Rp)" type="number" placeholder="0" value={goalForm.autoSaveAmount} onChange={(e) => gf("autoSaveAmount", e.target.value)} />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowGoalModal(false)}>Batal</Button>
            <Button type="submit">Simpan Goal</Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Funds Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!showFundsModal}
        onClose={() => setShowFundsModal(null)}
        title={`Tambah Dana — ${savingGoals.find((g) => g.id === showFundsModal)?.name || ""}`}
        size="sm"
      >
        <form onSubmit={handleFundsSubmit} className="space-y-4">
          <Input label="Jumlah (Rp)" type="number" placeholder="0" value={fundsForm.amount} onChange={(e) => setFundsForm((f) => ({ ...f, amount: e.target.value }))} required />
          <Input label="Catatan (opsional)" placeholder="cth. Gaji bulan ini" value={fundsForm.note} onChange={(e) => setFundsForm((f) => ({ ...f, note: e.target.value }))} />
          {showFundsModal && fundsForm.amount && (() => {
            const goal = savingGoals.find((g) => g.id === showFundsModal);
            if (!goal) return null;
            const newAmount = goal.currentAmount + parseFloat(fundsForm.amount || "0");
            const newPct = percentage(newAmount, goal.targetAmount);
            return (
              <div className="p-3 rounded-lg bg-bg-elevated text-xs">
                <div className="flex justify-between text-text-muted mb-1">
                  <span>Setelah ditambah</span>
                  <span>{formatCurrency(Math.min(newAmount, goal.targetAmount))}</span>
                </div>
                <ProgressBar value={newAmount} max={goal.targetAmount} color={goal.color} />
                <p className="text-right mt-1 font-medium" style={{ color: goal.color }}>{newPct}%</p>
              </div>
            );
          })()}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowFundsModal(null)}>Batal</Button>
            <Button type="submit">Tambah Dana</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
