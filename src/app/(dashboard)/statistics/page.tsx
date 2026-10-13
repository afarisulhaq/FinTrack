"use client";

import { useState } from "react";
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
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import type { AnalyticsSummary } from "~/lib/analytics";
import { formatCurrency } from "~/lib/utils";
import { PaginatedList } from "~/components/ui/paginated-list";

const PERIODS = ["Bulan Ini", "3 Bulan", "6 Bulan", "Tahun Ini"] as const;
type Period = (typeof PERIODS)[number];


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
  const analytics = useServerPagination<never, AnalyticsSummary>("/analytics/summary", {
    period: period === "Bulan Ini" ? "1" : period === "3 Bulan" ? "3" : period === "6 Bulan" ? "6" : "year",
  });
  const summary = analytics.summary;
  const monthlyData = summary?.monthlyData ?? [];
  const heatmapData = summary?.heatmap ?? [];
  const expenseCategories = summary?.categories ?? [];
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const HEALTH_METRICS = [
    { label: "Tabungan Rate", value: totalIncome > 0 ? Math.round((totalIncome - totalExpense) / totalIncome * 100) : 0, target: 20, unit: "%", status: totalIncome > 0 && (totalIncome - totalExpense) / totalIncome >= 0.2 ? "healthy" : "warning", detail: "Selisih pemasukan dan pengeluaran pada periode dipilih. Target 20%." },
    { label: "Cadangan Kas", value: totalExpense > 0 ? Math.round((summary?.walletBalance ?? 0) / totalExpense * monthlyData.length * 10) / 10 : 0, target: 6, unit: " bulan", status: totalExpense > 0 && (summary?.walletBalance ?? 0) / totalExpense * monthlyData.length >= 6 ? "healthy" : "warning", detail: "Saldo seluruh dompet dibagi rata-rata pengeluaran bulanan periode ini. Target 6 bulan." },
  ];
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
      <ServerListStatus {...analytics} />
      {/* ── Period Selector ──────────────────────────────────────────── */}
      <div className="bg-bg-elevated flex w-fit max-w-full flex-wrap gap-1 rounded-xl p-1">
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

      {summary && <>
      {summary.transactionCount === 0 && <p className="text-text-secondary text-sm">Belum ada transaksi pada periode ini. Catat transaksi untuk mengisi analisis.</p>}
      {/* ── Key Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Pemasukan"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp className="text-success" />}
        />
        <StatCard
          title="Total Pengeluaran"
          value={formatCurrency(totalExpense)}
          icon={<TrendingDown className="text-danger" />}
        />
        <StatCard
          title="Tabungan Rate"
          value={`${savingsRate}%`}
          subtitle={`${formatCurrency(totalIncome - totalExpense)} tersimpan`}
          icon={<DollarSign className="text-primary" />}
        />
        <StatCard
          title="Transaksi Tercatat"
          value={summary.transactionCount.toLocaleString("id-ID")}
          subtitle={period}
          icon={<Activity />}
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
              {period}
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
            <PaginatedList rows={topCategories} label="kategori pengeluaran" resetKey={period}>{(items) => (
            <div className="space-y-3">
              {items.map((cat) => {
                const pct = Math.round((cat.value / totalCatExpense) * 100);
                return (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="text-text-muted w-5 text-xs font-bold">
                        #{topCategories.indexOf(cat) + 1}
                      </span>
                      <DynamicIcon name={cat.icon} className="h-4 w-4" />
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
            )}</PaginatedList>
          </CardBody>
        </Card>
      </div>
      </>}
    </PageWrapper>
  );
}
