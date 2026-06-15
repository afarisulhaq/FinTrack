"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export interface PortfolioDataPoint {
  name: string;
  value: number;
  color: string;
}

interface PortfolioPieChartProps {
  data: PortfolioDataPoint[];
  height?: number;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  payload: PortfolioDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      style={{
        backgroundColor: "#22263a",
        border: "1px solid #2d3148",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgb(0 0 0 / 0.4)",
        minWidth: 140,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: item.payload.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
          {item.name}
        </span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
        {item.value.toLocaleString()}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function PortfolioPieChart({ data, height = 280 }: PortfolioPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{ position: "relative", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="72%"
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label — absolute-positioned overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#f1f5f9",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {total >= 1_000_000
              ? `${(total / 1_000_000).toFixed(1)}M`
              : total >= 1_000
              ? `${(total / 1_000).toFixed(0)}K`
              : total.toLocaleString()}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "#475569",
              margin: "3px 0 0",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Portfolio
          </p>
        </div>
      </div>

      {/* Legend below chart */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 16px",
          marginTop: 12,
        }}
      >
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {entry.name}
              </span>
              <span style={{ fontSize: 12, color: "#475569" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PortfolioPieChart };
