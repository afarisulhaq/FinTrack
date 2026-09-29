import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium rounded-md leading-none select-none transition-colors",
  {
    variants: {
      variant: {
        default: "bg-bg-elevated text-text-secondary border border-border",
        primary: "bg-primary/10 text-primary border border-primary/25 font-semibold",
        success: "bg-success/10 text-success border border-success/25 font-semibold",
        danger: "bg-danger/10 text-danger border border-danger/25 font-semibold",
        warning: "bg-warning/10 text-warning border border-warning/25 font-semibold",
        info: "bg-info/10 text-info border border-info/25 font-semibold",
        purple: "bg-primary/10 text-primary border border-primary/25 font-semibold",
        outline: "bg-transparent text-text-secondary border border-border hover:bg-bg-elevated",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-xs px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: ReactNode;
}

function Badge({ className, variant, size, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
