import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "~/lib/utils";

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string;
  icon: ReactNode;
  /** Hex or CSS color string — defaults to indigo */
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
  iconColor = "#6366f1",
  trend,
  className,
}: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : false;

  return (
    <div
      className={cn(
        "bg-bg-surface border border-border rounded-xl p-5",
        "flex flex-col gap-4 hover:border-border/80 transition-colors",
        className
      )}
    >
      {/* Main row */}
      <div className="flex items-start justify-between gap-3">
        {/* Text */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {title}
          </span>
          <span className="text-2xl font-bold text-text-primary tracking-tight leading-none">
            {value}
          </span>
          {subtitle && (
            <span className="text-xs text-text-muted mt-0.5">{subtitle}</span>
          )}
        </div>

        {/* Icon badge */}
        <div
          className="shrink-0 p-2.5 rounded-xl"
          style={{ backgroundColor: `${iconColor}1a` }}
        >
          <span
            className="flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5"
            style={{ color: iconColor }}
          >
            {icon}
          </span>
        </div>
      </div>

      {/* Trend row */}
      {trend && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-success shrink-0" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-danger shrink-0" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              isPositive ? "text-success" : "text-danger"
            )}
          >
            {isPositive ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-xs text-text-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export { StatCard };
