"use client";

import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { StatCard } from "~/components/ui/stat-card";
import { ProgressBar } from "~/components/ui/progress-bar";
import { SpendingTrendChart } from "~/components/charts/spending-trend-chart";
import { ExpenseBreakdownChart } from "~/components/charts/expense-breakdown-chart";
import { HeatmapCalendar } from "~/components/charts/heatmap-calendar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatCurrency } from "~/lib/utils";
import type { Transaction } from "~/lib/types";

const PERIODS = ["Bulan Ini", "3 Bulan", "6 Bulan", "Tahun Ini"] as const;
type Period = (typeof PERIODS)[number];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const CATEGORY_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#38bdf8",
  "#ec4899",
  "#8b5cf6",
  "#94a3b8",
];

// Build last-6-months income vs expense from real transactions
function buildMonthlyData(transactions: Transaction[]) {
  const now = new Date();
  const months: { month: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: MONTH_LABELS[d.getMonth()], income: 0, expense: 0 });
  }
  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    const monthDiff =
      (txDate.getFullYear() - now.getFullYear()) * 12 +
      (txDate.getMonth() - now.getMonth());
    const idx = monthDiff + 5;
    if (idx < 0 || idx > 5) continue;
    if (tx.type === "income") months[idx].income += tx.amount;
    else if (tx.type === "expense") months[idx].expense += tx.amount;
  }
  return months;
}

// Build current-month daily expense heatmap from real transactions
function buildHeatmapData(transactions: Transaction[]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { date: string; amount: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date > now) break;
    const dateStr = date.toISOString().split("T")[0];
    const total = transactions
      .filter((tx) => {
        if (tx.type !== "expense") return false;
        return tx.date.split("T")[0] === dateStr;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    days.push({ date: dateStr, amount: total });
  }
  return days;
}

// Aggregate current-month expenses by category
function buildExpenseCategories(transactions: Transaction[]) {
  const now = new Date();
  const agg: Record<string, { value: number; icon: string }> = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const txDate = new Date(tx.date);
    if (
      txDate.getMonth() !== now.getMonth() ||
      txDate.getFullYear() !== now.getFullYear()
    )
      continue;
    const key = tx.category || "Lainnya";
    if (!agg[key]) agg[key] = { value: 0, icon: tx.categoryIcon || "💡" };
    agg[key].value += tx.amount;
  }
  return Object.entries(agg)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, info], i) => ({
      name,
      value: info.value,
      icon: info.icon,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
}

// Financial health data (static mock)
const HEALTH_METRICS = [
  {
    label: "Tabungan Rate",
    value: 28,
    target: 20,
    unit: "%",
    description: "Persentase income yang ditabung",
    status: "healthy" as const,
    detail: "Target minimal 20% dari income",
  },
  {
    label: "Debt-to-Income",
    value: 18,
    target: 30,
    unit: "%",
    description: "Total cicilan per bulan / income",
    status: "healthy" as const,
    detail: "Idealnya di bawah 30%",
  },
  {
    label: "Emergency Fund",
    value: 4.2,
    target: 6,
    unit: " bulan",
    description: "Bulan pengeluaran yang bisa ditanggung",
    status: "warning" as const,
    detail: "Target minimal 6 bulan pengeluaran",
  },
  {
    label: "Investasi Rate",
    value: 15,
    target: 20,
    unit: "%",
    description: "Persentase income yang diinvestasikan",
    status: "warning" as const,
    detail: "Idealnya 20% dari income",
  },
];

function CustomBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#22263a",
        border: "1px solid #2d3148",
        borderRadius: 10,
        padding: "10px 14px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#f1f5f9",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: entry.color,
            }}
          />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {entry.name === "income" ? "Pemasukan" : "Pengeluaran"}:
          </span>
          <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>
            {Number(entry.value).toLocaleString("id-ID")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState<Period>("Bulan Ini");
  const transactions = useFinanceStore((s) => s.transactions);

  const monthlyData = useMemo(
    () => buildMonthlyData(transactions),
    [transactions],
  );
  const heatmapData = useMemo(
    () => buildHeatmapData(transactions),
    [transactions],
  );
  const expenseCategories = useMemo(
    () => buildExpenseCategories(transactions),
    [transactions],
  );

  const totalIncome = useMemo(
    () => monthlyData.reduce((s, m) => s + m.income, 0),
    [monthlyData],
  );
  const totalExpense = useMemo(
    () => monthlyData.reduce((s, m) => s + m.expense, 0),
    [monthlyData],
  );
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;

  const spendingTrendData = monthlyData.map((m) => ({
    month: m.month,
    amount: m.expense,
  }));

  const topCategories = expenseCategories;
  const totalCatExpense = expenseCategories.reduce((s, c) => s + c.value, 0);

  return (
    <PageWrapper
      title="Statistik & Analisis"
      subtitle="Analisis keuangan kamu secara mendalam"
    >
      {/* ── Period Selector ──────────────────────────────────────────── */}
      <div className="bg-bg-elevated flex w-fit gap-1 rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p
                ? "bg-bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── Key Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Pemasukan"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp />}
          iconColor="#22c55e"
          trend={{ value: 8.2, label: "vs bulan lalu" }}
        />
        <StatCard
          title="Total Pengeluaran"
          value={formatCurrency(totalExpense)}
          icon={<TrendingDown />}
          iconColor="#ef4444"
          trend={{ value: -3.1, label: "vs bulan lalu" }}
        />
        <StatCard
          title="Tabungan Rate"
          value={`${savingsRate}%`}
          subtitle={`${formatCurrency(totalIncome - totalExpense)} tersimpan`}
          icon={<DollarSign />}
          iconColor="#6366f1"
        />
        <StatCard
          title="Debt-to-Income"
          value="18%"
          subtitle="Aman, di bawah 30%"
          icon={<Activity />}
          iconColor="#f59e0b"
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Tren Pengeluaran
            </span>
            <Badge variant="default" size="sm">
              6 Bulan
            </Badge>
          </CardHeader>
          <CardBody>
            <SpendingTrendChart data={spendingTrendData} height={240} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Breakdown Pengeluaran
            </span>
          </CardHeader>
          <CardBody>
            <ExpenseBreakdownChart data={expenseCategories} height={180} />
          </CardBody>
        </Card>
      </div>

      {/* ── Income vs Expense Bar Chart ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-text-primary text-sm font-semibold">
            Pemasukan vs Pengeluaran
          </span>
          <Badge variant="default" size="sm">
            Per Bulan
          </Badge>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={monthlyData}
              margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
              barCategoryGap="30%"
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2d3148"
                vertical={false}
                opacity={0.6}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : String(v)
                }
                width={44}
              />
              <Tooltip
                content={<CustomBarTooltip />}
                cursor={
                  {
                    fill: "rgba(255,255,255,0.04)",
                    radius: 6,
                  } as React.SVGProps<SVGRectElement>
                }
              />
              <Legend
                formatter={(value) =>
                  value === "income" ? "Pemasukan" : "Pengeluaran"
                }
                wrapperStyle={{
                  fontSize: 12,
                  color: "#94a3b8",
                  paddingTop: 12,
                }}
              />
              <Bar
                dataKey="income"
                name="income"
                fill="#22c55e"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="expense"
                name="expense"
                fill="#ef4444"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* ── Heatmap ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-text-primary text-sm font-semibold">
            Kalender Pengeluaran
          </span>
          <Badge variant="default" size="sm">
            Bulan Ini
          </Badge>
        </CardHeader>
        <CardBody>
          <HeatmapCalendar data={heatmapData} />
        </CardBody>
      </Card>

      {/* ── Bottom Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Financial Health */}
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Kesehatan Finansial
            </span>
          </CardHeader>
          <CardBody>
            <div className="space-y-5">
              {HEALTH_METRICS.map((metric) => (
                <div key={metric.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary text-sm font-medium">
                        {metric.label}
                      </span>
                      <Badge
                        variant={
                          metric.status === "healthy"
                            ? "success"
                            : metric.status === "warning"
                              ? "warning"
                              : "danger"
                        }
                        size="sm"
                      >
                        {metric.status === "healthy"
                          ? "Sehat"
                          : metric.status === "warning"
                            ? "Perlu Perhatian"
                            : "Kritis"}
                      </Badge>
                    </div>
                    <span className="text-text-primary text-sm font-bold">
                      {metric.value}
                      {metric.unit}
                    </span>
                  </div>
                  <ProgressBar
                    value={metric.value}
                    max={metric.target * 1.5}
                    color={
                      metric.status === "healthy"
                        ? "#22c55e"
                        : metric.status === "warning"
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                  />
                  <p className="text-text-muted mt-1 text-xs">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Top Spending Categories */}
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Top Pengeluaran
            </span>
            <span className="text-text-muted text-xs">
              {formatCurrency(totalCatExpense)} total
            </span>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {topCategories.map((cat, i) => {
                const pct = Math.round((cat.value / totalCatExpense) * 100);
                return (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="text-text-muted w-5 text-xs font-bold">
                        #{i + 1}
                      </span>
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-text-primary flex-1 text-sm">
                        {cat.name}
                      </span>
                      <span className="text-text-muted text-xs">{pct}%</span>
                      <span className="text-text-primary text-sm font-semibold">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                    <div className="pl-8">
                      <ProgressBar
                        value={cat.value}
                        max={topCategories[0]?.value ?? cat.value}
                        color={cat.color}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
