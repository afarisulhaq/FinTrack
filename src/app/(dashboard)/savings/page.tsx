"use client";

import { useState, useMemo } from "react";
import {
  PiggyBank,
  Plus,
  Trash2,
  Edit,
  Target,
  Calendar,
  Zap,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { Input } from "~/components/ui/input";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, formatDate, daysUntil, percentage } from "~/lib/utils";

const GOAL_ICONS = [
  "Home",
  "Laptop",
  "Shield",
  "Building",
  "Gem",
  "Umbrella",
  "Car",
  "Bike",
  "Smartphone",
  "GraduationCap",
  "Plane",
  "Coins",
  "Gift",
  "Star",
];
const GOAL_COLORS = [
  "#FFD147",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#38bdf8",
  "#ec4899",
  "#FFB347",
  "#f97316",
];
const WALLETS = [
  "BCA Tabungan",
  "Mandiri Tabungan",
  "BRI Tabungan",
  "Dana",
  "GoPay",
  "OVO",
];

export default function SavingsPage() {
  const savingGoals = useFinanceStore((s) => s.savingGoals);
  const addSavingGoal = useFinanceStore((s) => s.addSavingGoal);
  const deleteSavingGoal = useFinanceStore((s) => s.deleteSavingGoal);
  const contributeToGoal = useFinanceStore((s) => s.contributeToGoal);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({
    name: "",
    icon: "Star",
    targetAmount: "",
    deadline: "",
    autoSave: false,
    autoSaveAmount: "",
    walletId: "BCA Tabungan",
    color: "#FFD147",
  });
  const [fundsForm, setFundsForm] = useState({ amount: "", note: "" });

  const { totalTarget, totalCollected, avgProgress } = useMemo(() => {
    const totalTarget = savingGoals.reduce((s, g) => s + g.targetAmount, 0);
    const totalCollected = savingGoals.reduce((s, g) => s + g.currentAmount, 0);
    const avgProgress =
      savingGoals.length > 0
        ? savingGoals.reduce(
            (s, g) => s + percentage(g.currentAmount, g.targetAmount),
            0,
          ) / savingGoals.length
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
      autoSaveAmount: goalForm.autoSave
        ? parseFloat(goalForm.autoSaveAmount || "0")
        : undefined,
    });
    setGoalForm({
      name: "",
      icon: "Star",
      targetAmount: "",
      deadline: "",
      autoSave: false,
      autoSaveAmount: "",
      walletId: "BCA Tabungan",
      color: "#FFD147",
    });
    setShowGoalModal(false);
  }

  function handleFundsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showFundsModal || !fundsForm.amount) return;
    contributeToGoal(showFundsModal, parseFloat(fundsForm.amount));
    setFundsForm({ amount: "", note: "" });
    setShowFundsModal(null);
  }

  const gf = (k: keyof typeof goalForm, v: string | boolean) =>
    setGoalForm((f) => ({ ...f, [k]: v }));

  return (
    <PageWrapper
      title="Tabungan"
      subtitle="Pantau progress saving goals kamu"
      actions={
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowGoalModal(true)}
        >
          Tambah Goal
        </Button>
      }
    >
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Target"
          value={formatCurrency(totalTarget)}
          icon={<Target />}
          iconColor="#FFD147"
        />
        <StatCard
          title="Total Terkumpul"
          value={formatCurrency(totalCollected)}
          icon={<PiggyBank />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Rata-rata Progress"
          value={`${Math.round(avgProgress)}%`}
          subtitle={`${savingGoals.length} goal aktif`}
          icon={<Zap />}
          iconColor="#f59e0b"
        />
      </div>

      {/* ── Goal Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                    style={{ backgroundColor: goal.color + "20" }}
                  >
                    <DynamicIcon name={goal.icon} className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-text-primary font-semibold">
                      {goal.name}
                    </h3>
                    {goal.walletId && (
                      <p className="text-text-muted mt-0.5 text-xs">
                        {goal.walletId}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => deleteSavingGoal(goal.id)}
                    className="text-text-muted hover:text-danger hover:bg-danger/10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-primary font-bold">
                    {formatCurrency(goal.currentAmount)}
                  </span>
                  <span className="text-text-muted text-xs">
                    dari {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <ProgressBar
                  value={goal.currentAmount}
                  max={goal.targetAmount}
                  color={goal.color}
                />
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: goal.color }}
                  >
                    {pct}% tercapai
                  </span>
                  <span className="text-text-muted text-xs">
                    Kurang {formatCurrency(remaining)}
                  </span>
                </div>
              </div>

              {/* Deadline & Auto-save */}
              <div className="flex items-center gap-3 text-xs">
                {goal.deadline && (
                  <div className="text-text-muted flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(goal.deadline)}</span>
                    {days !== null && days > 0 && (
                      <span className="text-warning">({days} hari lagi)</span>
                    )}
                  </div>
                )}
                {goal.autoSave && goal.autoSaveAmount && (
                  <div className="text-success flex items-center gap-1.5">
                    <Zap className="h-3 w-3" />
                    <span>
                      Auto-save {formatCurrency(goal.autoSaveAmount)}/bln
                    </span>
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
              <PiggyBank className="text-text-muted mx-auto mb-3 h-10 w-10" />
              <p className="text-text-muted">
                Belum ada saving goal. Mulai sekarang!
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* ── Add Goal Modal ───────────────────────────────────────────── */}
      <Modal
        open={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title="Tambah Saving Goal"
        size="md"
      >
        <form onSubmit={handleGoalSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Goal"
              placeholder="cth. DP Rumah"
              value={goalForm.name}
              onChange={(e) => gf("name", e.target.value)}
              required
            />
            <Input
              label="Target (Rp)"
              type="number"
              placeholder="0"
              value={goalForm.targetAmount}
              onChange={(e) => gf("targetAmount", e.target.value)}
              required
            />
          </div>
          <Input
            label="Deadline"
            type="date"
            value={goalForm.deadline}
            onChange={(e) => gf("deadline", e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Ikon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => gf("icon", icon)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${goalForm.icon === icon ? "bg-primary/20 ring-primary ring-2" : "bg-bg-elevated"}`}
                >
                  <DynamicIcon name={icon} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Warna
            </label>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => gf("color", c)}
                  className={`h-7 w-7 rounded-full transition-all ${goalForm.color === c ? "ring-offset-bg-surface scale-110 ring-2 ring-white ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Wallet Sumber
            </label>
            <select
              value={goalForm.walletId}
              onChange={(e) => gf("walletId", e.target.value)}
              className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            >
              {WALLETS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="text-text-primary text-sm font-medium">Auto-save</p>
              <p className="text-text-muted text-xs">
                Otomatis menabung setiap bulan
              </p>
            </div>
            <button
              type="button"
              onClick={() => gf("autoSave", !goalForm.autoSave)}
              className={`relative h-5 w-10 rounded-full transition-colors ${goalForm.autoSave ? "bg-primary" : "bg-bg-base"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${goalForm.autoSave ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          {goalForm.autoSave && (
            <Input
              label="Jumlah Auto-save / bulan (Rp)"
              type="number"
              placeholder="0"
              value={goalForm.autoSaveAmount}
              onChange={(e) => gf("autoSaveAmount", e.target.value)}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowGoalModal(false)}
            >
              Batal
            </Button>
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
          <Input
            label="Jumlah (Rp)"
            type="number"
            placeholder="0"
            value={fundsForm.amount}
            onChange={(e) =>
              setFundsForm((f) => ({ ...f, amount: e.target.value }))
            }
            required
          />
          <Input
            label="Catatan (opsional)"
            placeholder="cth. Gaji bulan ini"
            value={fundsForm.note}
            onChange={(e) =>
              setFundsForm((f) => ({ ...f, note: e.target.value }))
            }
          />
          {showFundsModal &&
            fundsForm.amount &&
            (() => {
              const goal = savingGoals.find((g) => g.id === showFundsModal);
              if (!goal) return null;
              const newAmount =
                goal.currentAmount + parseFloat(fundsForm.amount || "0");
              const newPct = percentage(newAmount, goal.targetAmount);
              return (
                <div className="bg-bg-elevated rounded-lg p-3 text-xs">
                  <div className="text-text-muted mb-1 flex justify-between">
                    <span>Setelah ditambah</span>
                    <span>
                      {formatCurrency(Math.min(newAmount, goal.targetAmount))}
                    </span>
                  </div>
                  <ProgressBar
                    value={newAmount}
                    max={goal.targetAmount}
                    color={goal.color}
                  />
                  <p
                    className="mt-1 text-right font-medium"
                    style={{ color: goal.color }}
                  >
                    {newPct}%
                  </p>
                </div>
              );
            })()}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFundsModal(null)}
            >
              Batal
            </Button>
            <Button type="submit">Tambah Dana</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}
