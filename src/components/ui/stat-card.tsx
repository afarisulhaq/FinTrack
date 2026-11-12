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
        "bg-surface-card",
        "[padding:var(--card-pad-y)_var(--card-pad-x)_var(--card-pad-x)]",
        "shadow-card rounded-xl [box-shadow:inset_0_0_0_1px_var(--glass-rim),var(--shadow-card)] hover:shadow-elevated transition-all duration-200 flex flex-col justify-between gap-3",
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

        {/* Icon tile: same hue-wash + mixed-ink treatment as every other icon
            in the app, so a red wallet icon still reads as a red wallet. */}
        <span
          className={cn("icon-tile", !iconColor && "text-primary")}
          style={
            iconColor
              ? ({ "--tile-hue": iconColor } as React.CSSProperties)
              : undefined
          }
          aria-hidden
        >
          <span className="flex items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
        </span>
      </div>

      {/* Trend row */}
      {trend && (
        <div className="border-border-subtle flex items-center gap-2 border-t pt-2.5">
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
