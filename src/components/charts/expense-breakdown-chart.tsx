"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export interface ExpenseCategory {
  name: string;
  value: number;
  color: string;
  /** Optional emoji or short string icon */
  icon?: string;
}

interface ExpenseBreakdownChartProps {
  data: ExpenseCategory[];
  height?: number;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  payload: ExpenseCategory;
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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {item.payload.icon && (
          <span style={{ fontSize: 14 }}>{item.payload.icon}</span>
        )}
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: item.payload.color,
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
function ExpenseBreakdownChart({ data, height = 260 }: ExpenseBreakdownChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      {/* Donut chart */}
      <div style={{ position: "relative", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="70%"
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

        {/* Center total */}
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
                fontSize: 17,
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
                fontSize: 10,
                color: "#475569",
                margin: "3px 0 0",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total
            </p>
          </div>
        </div>
      </div>

      {/* Legend with amounts */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <div
              key={entry.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Color dot */}
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: entry.color,
                  flexShrink: 0,
                }}
              />

              {/* Icon */}
              {entry.icon && (
                <span style={{ fontSize: 13, flexShrink: 0 }}>{entry.icon}</span>
              )}

              {/* Name */}
              <span
                style={{
                  fontSize: 13,
                  color: "#94a3b8",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.name}
              </span>

              {/* Percentage */}
              <span style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>
                {pct}%
              </span>

              {/* Amount */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f1f5f9",
                  flexShrink: 0,
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {entry.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ExpenseBreakdownChart };
