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
  iconColor = "#FFD147",
  trend,
  className,
}: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : false;

  return (
    <div
      className={cn(
        "bg-bg-surface border-border rounded-xl border p-5",
        "hover:border-border/80 flex flex-col gap-4 transition-colors",
        className,
      )}
    >
      {/* Main row */}
      <div className="flex items-start justify-between gap-3">
        {/* Text */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-text-muted text-xs font-medium tracking-wide uppercase">
            {title}
          </span>
          <span className="text-text-primary text-2xl leading-none font-bold tracking-tight">
            {value}
          </span>
          {subtitle && (
            <span className="text-text-muted mt-0.5 text-xs">{subtitle}</span>
          )}
        </div>

        {/* Icon badge */}
        <div
          className="shrink-0 rounded-xl p-2.5"
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
        <div className="border-border flex items-center gap-1.5 border-t pt-1">
          {isPositive ? (
            <TrendingUp className="text-success h-3.5 w-3.5 shrink-0" />
          ) : (
            <TrendingDown className="text-danger h-3.5 w-3.5 shrink-0" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              isPositive ? "text-success" : "text-danger",
            )}
          >
            {isPositive ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-text-muted text-xs">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export { StatCard };
