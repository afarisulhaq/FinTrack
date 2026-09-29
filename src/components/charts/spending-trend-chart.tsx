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
    <div className="bg-bg-surface border-border rounded-xl border p-3 shadow-elevated">
      <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-text-primary text-sm font-bold tabular-nums">
        Rp {Number(value).toLocaleString("id-ID")}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function SpendingTrendChart({ data, height = 280 }: SpendingTrendChartProps) {
  const gradientId = "spendingGradient";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity={0.3} />
            <stop offset="70%" stopColor="#d97706" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-border/60"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          className="text-text-muted"
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          className="text-text-muted"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}jt`
              : v >= 1_000
                ? `${(v / 1_000).toFixed(0)}rb`
                : String(v)
          }
          width={42}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "#d97706", strokeWidth: 1.5, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#d97706"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 4.5,
            fill: "#d97706",
            stroke: "var(--bg-surface)",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { SpendingTrendChart };
