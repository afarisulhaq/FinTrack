"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PerformanceDataPoint {
  name: string;
  /** unrealized return percentage */
  value: number;
  /** absolute P/L in currency */
  pl: number;
}

interface PortfolioPerformanceChartProps {
  data: PerformanceDataPoint[];
  height?: number;
}

interface TooltipPayload {
  payload: PerformanceDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const positive = item.value >= 0;
  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgb(0 0 0 / 0.4)",
        minWidth: 150,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
        {item.name}
      </p>
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          margin: 0,
          color: positive ? "var(--success)" : "var(--danger)",
        }}
      >
        {positive ? "+" : ""}
        {item.value.toFixed(2)}%
      </p>
      <p
        style={{
          fontSize: 12,
          margin: "2px 0 0",
          color: positive ? "var(--success)" : "var(--danger)",
        }}
      >
        {positive ? "+" : ""}
        {item.pl.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

function PortfolioPerformanceChart({
  data,
  height = 280,
}: PortfolioPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Belum ada data performa aset
      </div>
    );
  }

  // Sort best → worst for a clean ladder
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const chartHeight = Math.max(height, sorted.length * 32);

  return (
    <div
      role="region"
      aria-label="Grafik performa aset"
      tabIndex={chartHeight > height ? 0 : undefined}
      style={{ maxHeight: height, overflowY: "auto" }}
      className="focus-visible:outline-2 focus-visible:outline-text-primary"
    >
      <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          barCategoryGap="22%"
        >
          <XAxis
            type="number"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            width={64}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={entry.value >= 0 ? "var(--success)" : "var(--danger)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export { PortfolioPerformanceChart };
