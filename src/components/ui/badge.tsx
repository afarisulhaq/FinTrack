import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium rounded-full leading-none",
  {
    variants: {
      variant: {
        default: "bg-bg-elevated text-text-secondary border border-border",
        success: "bg-success/10 text-success border border-success/20",
        danger: "bg-danger/10 text-danger border border-danger/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        info: "bg-info/10 text-info border border-info/20",
        purple: "bg-primary/10 text-primary border border-primary/20",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
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
