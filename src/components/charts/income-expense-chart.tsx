"use client";

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

export interface IncomeExpenseDataPoint {
  month: string;
  income: number;
  expense: number;
}

interface IncomeExpenseChartProps {
  data: IncomeExpenseDataPoint[];
  height?: number;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#22263a",
        border: "1px solid #2d3148",
        borderRadius: "10px",
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgb(0 0 0 / 0.4)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#f1f5f9",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>
            {entry.name}:
          </span>
          <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom Legend ─────────────────────────────────────────────────────────────
interface LegendEntry {
  value: string;
  color: string;
}

interface CustomLegendProps {
  payload?: LegendEntry[];
}

function CustomLegend({ payload }: CustomLegendProps) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, paddingTop: 12 }}>
      {payload.map((entry) => (
        <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: entry.color,
            }}
          />
          <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function IncomeExpenseChart({ data, height = 300 }: IncomeExpenseChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
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
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)", radius: 6 }}
        />
        <Legend content={<CustomLegend />} />
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
  );
}

export { IncomeExpenseChart };
