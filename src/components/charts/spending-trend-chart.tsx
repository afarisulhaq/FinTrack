"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface SpendingTrendDataPoint {
  month: string;
  amount: number;
}

interface SpendingTrendChartProps {
  data: SpendingTrendDataPoint[];
  height?: number;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
interface SpendingTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: SpendingTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div
      style={{
        backgroundColor: "#22263a",
        border: "1px solid #2d3148",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgb(0 0 0 / 0.4)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#94a3b8",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
        {Number(value).toLocaleString()}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function SpendingTrendChart({ data, height = 280 }: SpendingTrendChartProps) {
  const gradientId = "spendingGradient";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="60%" stopColor="#6366f1" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#2d3148"
          vertical={false}
          opacity={0.5}
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
          cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 5,
            fill: "#6366f1",
            stroke: "#1a1d27",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { SpendingTrendChart };
