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
import { SpendingTrendChart } from "~/components/charts/spending-trend-chart";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency, daysUntil, percentage } from "~/lib/utils";

export default function DashboardPage() {
  const bills = useFinanceStore((s) => s.bills);
  const savingGoals = useFinanceStore((s) => s.savingGoals);
  const investments = useFinanceStore((s) => s.investments);
  const wallets = useFinanceStore((s) => s.wallets);
  const transactions = useFinanceStore((s) => s.transactions);

  const totalBalance = useMemo(
    () => wallets.filter((w) => !w.parentId).reduce((s, w) => s + w.balance, 0),
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

  const QUICK_LINKS = [
    {
      href: "/investments",
      label: "Investasi",
      icon: TrendingUp,
      color: "#6366f1",
    },
    { href: "/bills", label: "Tagihan", icon: Bell, color: "#f59e0b" },
    { href: "/savings", label: "Tabungan", icon: PiggyBank, color: "#22c55e" },
    { href: "/debts", label: "Hutang", icon: Layers, color: "#ef4444" },
    { href: "/cards", label: "Kartu", icon: CreditCard, color: "#38bdf8" },
    { href: "/wishlist", label: "Wishlist", icon: Star, color: "#ec4899" },
    {
      href: "/statistics",
      label: "Statistik",
      icon: BarChart2,
      color: "#8b5cf6",
    },
  ];

  return (
    <PageWrapper title="Dashboard" subtitle="Selamat datang kembali 👋">
      {/* ── Net Worth ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          subtitle="Total kekayaan bersih"
          icon={<Wallet />}
          iconColor="#6366f1"
          trend={{ value: 4.5, label: "vs bulan lalu" }}
        />
        <StatCard
          title="Saldo Rekening"
          value={formatCurrency(totalBalance)}
          subtitle={`${wallets.filter((w) => !w.parentId).length} rekening`}
          icon={<Wallet />}
          iconColor="#22c55e"
        />
        <StatCard
          title="Pemasukan Bulan Ini"
          value={formatCurrency(latestMonth.income)}
          icon={<TrendingUp />}
          iconColor="#22c55e"
          trend={{ value: 6.1, label: "vs bulan lalu" }}
        />
        <StatCard
          title="Pengeluaran Bulan Ini"
          value={formatCurrency(latestMonth.expense)}
          icon={<TrendingDown />}
          iconColor="#ef4444"
          trend={{ value: -2.3, label: "vs bulan lalu" }}
        />
      </div>

      {/* ── Quick Links ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-bg-surface border-border hover:border-border/60 hover:bg-bg-elevated group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: item.color }} />
              </div>
              <span className="text-text-muted group-hover:text-text-secondary text-center text-[11px] font-medium transition-colors">
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
                      <span className="text-base">{goal.icon}</span>
                      <span className="text-text-primary flex-1 truncate text-sm font-medium">
                        {goal.name}
                      </span>
                      <span
                        className="text-xs font-semibold"
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
                    <div className="text-text-muted mt-0.5 flex justify-between text-[10px]">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
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
                  className={`flex items-center gap-3 rounded-xl border p-3 ${isOverdue ? "border-danger/30 bg-danger/5" : isUrgent ? "border-warning/30 bg-warning/5" : "border-border bg-bg-elevated"}`}
                >
                  <span className="shrink-0 text-xl">{bill.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate text-sm font-medium">
                      {bill.name}
                    </p>
                    <p
                      className={`text-xs font-medium ${isOverdue ? "text-danger" : isUrgent ? "text-warning" : "text-text-muted"}`}
                    >
                      {isOverdue
                        ? `Terlambat ${Math.abs(days)} hr`
                        : days === 0
                          ? "Hari ini"
                          : `${days} hari`}
                    </p>
                  </div>
                  <span className="text-text-primary shrink-0 text-xs font-bold">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              );
            })}
            {unpaidBills.length === 0 && (
              <div className="text-text-muted col-span-full py-4 text-center text-sm">
                Tidak ada tagihan tertunda 🎉
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
