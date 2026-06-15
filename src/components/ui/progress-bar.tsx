"use client";

import { cn } from "~/lib/utils";

interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Override auto color */
  color?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  /** Pulse animation when near/over limit */
  animated?: boolean;
  className?: string;
}

function getAutoColor(pct: number): string {
  if (pct > 100) return "#ef4444"; // over budget → red
  if (pct >= 80) return "#f97316"; // 80-100 → orange
  if (pct >= 60) return "#f59e0b"; // 60-80 → amber
  return "#22c55e"; // < 60 → green
}

function ProgressBar({
  value,
  max = 100,
  color,
  size = "md",
  showLabel = false,
  animated = false,
  className,
}: ProgressBarProps) {
  const rawPct = max > 0 ? (value / max) * 100 : 0;
  const fillWidth = Math.min(rawPct, 100); // cap bar at 100% visually
  const resolvedColor = color ?? getAutoColor(rawPct);

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted font-medium">
            {rawPct > 100
              ? `${Math.round(rawPct)}% — over limit`
              : `${Math.round(rawPct)}%`}
          </span>
          <span className="text-text-muted tabular-nums">
            {value.toLocaleString()} / {max.toLocaleString()}
          </span>
        </div>
      )}

      <div
        className={cn(
          "w-full rounded-full overflow-hidden bg-bg-elevated",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            animated && rawPct >= 80 && "animate-pulse"
          )}
          style={{
            width: `${fillWidth}%`,
            backgroundColor: resolvedColor,
            boxShadow:
              rawPct > 0
                ? `0 0 6px 0 ${resolvedColor}55`
                : undefined,
          }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };
