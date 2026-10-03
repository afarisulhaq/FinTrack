"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Bell,
  PiggyBank,
  CreditCard,
  Star,
  BarChart2,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { StatCard } from "~/components/ui/stat-card";
import { Badge } from "~/components/ui/badge";
import { ProgressBar } from "~/components/ui/progress-bar";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { SpendingTrendChart } from "~/components/charts/spending-trend-chart";
import { useFinanceStore } from "~/store/useFinanceStore";
import { totalWalletBalance } from "~/lib/wallets";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { formatCurrency, daysUntil, percentage } from "~/lib/utils";

export default function DashboardPage() {
  const bills = useFinanceStore((s) => s.bills);
  const savingGoals = useFinanceStore((s) => s.savingGoals);
  const investments = useFinanceStore((s) => s.investments);
  const wallets = useFinanceStore((s) => s.wallets);
  const transactions = useFinanceStore((s) => s.transactions);
  // Read the configured currency so dashboard totals reflect the
  // admin app-settings choice (e.g. IDR → USD). The store hydrates
  // from `localStorage` on mount, so the first paint already has the
  // right currency instead of flashing IDR first.
  const currency = useAppConfigStore((s) => s.config.currency);
  const appName = useAppConfigStore((s) => s.config.appName);
  const tagline = useAppConfigStore((s) => s.config.tagline);

  const totalBalance = useMemo(
    () => totalWalletBalance(wallets),
    [wallets],
  );
  const portfolioValue = useMemo(
    () =>
      investments.reduce((s, inv) => s + inv.quantity * inv.currentPrice, 0),
    [investments],
  );

  const netWorth = totalBalance + portfolioValue;

  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const month = date.toLocaleDateString("id-ID", { month: "short" });
      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const scoped = transactions.filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          txDate.getFullYear() === year && txDate.getMonth() === monthIndex
        );
      });
      return {
        month,
        income: scoped
          .filter((tx) => tx.type === "income")
          .reduce((sum, tx) => sum + tx.amount, 0),
        expense: scoped
          .filter((tx) => tx.type === "expense")
          .reduce((sum, tx) => sum + tx.amount, 0),
      };
    });
  }, [transactions]);

  const latestMonth = monthlyData[monthlyData.length - 1] ?? {
    month: "-",
    income: 0,
    expense: 0,
  };
  const prevMonth = monthlyData[monthlyData.length - 2] ?? {
    month: "-",
    income: 0,
    expense: 0,
  };

  // Real Month-over-Month calculations
  const incomeTrend = prevMonth.income > 0
    ? {
        value: Math.round(((latestMonth.income - prevMonth.income) / prevMonth.income) * 1000) / 10,
        label: `vs ${prevMonth.month}`,
      }
    : undefined;

  const expenseTrend = prevMonth.expense > 0
    ? {
        value: Math.round(((latestMonth.expense - prevMonth.expense) / prevMonth.expense) * 1000) / 10,
        label: `vs ${prevMonth.month}`,
      }
    : undefined;

  const unpaidBills = useMemo(
    () =>
      bills
        .filter((b) => b.status !== "paid")
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        )
        .slice(0, 4),
    [bills],
  );

  const topGoals = useMemo(() => savingGoals.slice(0, 3), [savingGoals]);

  const spendingTrendData = monthlyData.map((m) => ({
    month: m.month,
    amount: m.expense,
  }));

  const QUICK_ACTIONS = [
    { href: "/investments", label: "Investasi", icon: TrendingUp },
    { href: "/bills", label: "Tagihan", icon: Bell },
    { href: "/savings", label: "Tabungan", icon: PiggyBank },
    { href: "/debts", label: "Utang & Piutang", icon: Layers },
    { href: "/cards", label: "Kartu", icon: CreditCard },
    { href: "/wishlist", label: "Wishlist", icon: Star },
    { href: "/statistics", label: "Statistik", icon: BarChart2 },
  ];
  return (
    <PageWrapper title={appName} subtitle={tagline}>
      {/* ── Key Metrics Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Worth"
          value={formatCurrency(netWorth, false, currency)}
          subtitle="Total kas dan investasi"
          icon={<Wallet className="text-primary" />}
          className="bg-gradient-to-br from-bg-surface via-bg-surface to-primary/5 border-primary/30"
        />
        <StatCard
          title="Saldo Rekening"
          value={formatCurrency(totalBalance, false, currency)}
          subtitle={`${wallets.filter((w) => !w.parentId).length} akun aktif`}
          icon={<Wallet />}
        />
        <StatCard
          title="Pemasukan Bulan Ini"
          value={formatCurrency(latestMonth.income, false, currency)}
          icon={<TrendingUp className="text-success" />}
          trend={incomeTrend}
        />
        <StatCard
          title="Pengeluaran Bulan Ini"
          value={formatCurrency(latestMonth.expense, false, currency)}
          icon={<TrendingDown className="text-danger" />}
          trend={expenseTrend}
        />
      </div>

      {/* ── Quick Action Strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {QUICK_ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-surface-card border-border hover:border-primary/40 hover:bg-bg-elevated/70 group flex items-center gap-3 rounded-xl border p-3 shadow-subtle transition-all"
            >
              <div className="bg-primary/10 border-primary/20 text-primary group-hover:bg-primary group-hover:text-on-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-text-secondary group-hover:text-text-primary truncate text-xs font-semibold transition-colors">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Spending Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Tren Pengeluaran
            </span>
            <Link
              href="/statistics"
              className="text-primary flex items-center gap-1 text-xs hover:underline"
            >
              Lihat detail <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardBody>
            <SpendingTrendChart data={spendingTrendData} height={200} />
          </CardBody>
        </Card>

        {/* Saving Goals */}
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Saving Goals
            </span>
            <Link
              href="/savings"
              className="text-primary flex items-center gap-1 text-xs hover:underline"
            >
              Semua <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {topGoals.map((goal) => {
                const pct = percentage(goal.currentAmount, goal.targetAmount);
                return (
                  <div key={goal.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <DynamicIcon name={goal.icon} className="h-4 w-4" />
                      <span className="text-text-primary flex-1 truncate text-sm font-medium">
                        {goal.name}
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: goal.color }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar
                      value={goal.currentAmount}
                      max={goal.targetAmount}
                      color={goal.color}
                      size="sm"
                    />
                    <div className="text-text-muted mt-1 flex justify-between text-[11px] font-medium tabular-nums">
                      <span>{formatCurrency(goal.currentAmount, false, currency)}</span>
                      <span>{formatCurrency(goal.targetAmount, false, currency)}</span>
                    </div>
                  </div>
                );
              })}
              {topGoals.length === 0 && (
                <p className="text-text-muted py-4 text-center text-xs">
                  Belum ada saving goal
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Upcoming Bills ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-text-primary text-sm font-semibold">
            Tagihan Terdekat
          </span>
          <Link
            href="/bills"
            className="text-primary flex items-center gap-1 text-xs hover:underline"
          >
            Semua <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {unpaidBills.map((bill) => {
              const days = daysUntil(bill.dueDate);
              const isOverdue = days < 0;
              const isUrgent = days >= 0 && days <= 3;
              return (
                <div
                  key={bill.id}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                    isOverdue
                      ? "border-danger/30 bg-danger/5"
                      : isUrgent
                        ? "border-warning/30 bg-warning/5"
                        : "border-border bg-bg-surface hover:bg-bg-elevated/50"
                  }`}
                >
                  <DynamicIcon name={bill.icon} className="h-5 w-5 shrink-0 text-text-secondary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate text-sm font-medium">
                      {bill.name}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        isOverdue
                          ? "text-danger"
                          : isUrgent
                            ? "text-warning"
                            : "text-text-muted"
                      }`}
                    >
                      {isOverdue
                        ? `Terlambat ${Math.abs(days)} hari`
                        : days === 0
                          ? "Jatuh tempo hari ini"
                          : `${days} hari lagi`}
                    </p>
                  </div>
                  <span className="text-text-primary shrink-0 text-xs font-bold tabular-nums">
                    {formatCurrency(bill.amount, false, currency)}
                  </span>
                </div>
              );
            })}
            {unpaidBills.length === 0 && (
              <div className="text-text-muted col-span-full py-6 text-center text-sm">
                Tidak ada tagihan tertunda untuk saat ini.
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
