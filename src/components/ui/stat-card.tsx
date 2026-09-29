import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "~/lib/utils";

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string;
  icon: ReactNode;
  /** Hex or CSS color string — defaults to gold */
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  trend,
  className,
}: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : false;

  return (
    <div
      className={cn(
        "bg-surface-card border-border rounded-xl border p-5",
        "hover:border-border-strong hover:shadow-card transition-all duration-200 flex flex-col justify-between gap-4",
        className,
      )}
    >
      {/* Main row */}
      <div className="flex items-start justify-between gap-3">
        {/* Text */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-text-muted text-[11px] font-semibold tracking-wider uppercase">
            {title}
          </span>
          <span className="text-text-primary text-2xl font-bold tracking-tight tabular-nums">
            {value}
          </span>
          {subtitle && (
            <span className="text-text-muted mt-0.5 text-xs font-normal">{subtitle}</span>
          )}
        </div>

        {/* Icon container */}
        <div
          className={cn(
            "shrink-0 rounded-lg p-2.5 flex items-center justify-center border",
            iconColor ? "" : "bg-primary/10 border-primary/20 text-primary"
          )}
          style={iconColor ? { backgroundColor: `${iconColor}15`, borderColor: `${iconColor}30`, color: iconColor } : undefined}
        >
          <span className="flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </span>
        </div>
      </div>

      {/* Trend row */}
      {trend && (
        <div className="border-border/60 flex items-center gap-2 border-t pt-2.5">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none",
              isPositive
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3 shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 shrink-0" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {trend.value}%
            </span>
          </div>
          <span className="text-text-muted text-xs">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export { StatCard };
