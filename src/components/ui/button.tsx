"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-medium rounded-md text-sm",
    // Fingers are not cursors: on phones every button clears the 44px
    // minimum even when its desktop size is compact.
    "max-sm:min-h-11",
    "transition-all duration-150 select-none cursor-pointer",
    "active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bg-elevated disabled:text-text-muted disabled:shadow-none disabled:border-transparent",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-on-primary font-semibold hover:bg-primary-hover focus-visible:ring-primary shadow-sm",
        secondary:
          "bg-bg-elevated text-text-primary border border-border hover:bg-bg-surface hover:border-border-strong focus-visible:ring-primary shadow-subtle",
        ghost:
          "text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:ring-primary",
        outline:
          "border border-border text-text-primary bg-bg-surface hover:bg-bg-elevated hover:border-border-strong focus-visible:ring-primary shadow-subtle",
        danger:
          "bg-danger text-on-danger font-medium hover:brightness-95 focus-visible:ring-danger shadow-sm",
        success:
          "bg-success text-on-success font-medium hover:brightness-95 focus-visible:ring-success shadow-sm",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-md",
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : leftIcon ? (
          <span className="flex shrink-0 items-center">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon ? (
          <span className="flex shrink-0 items-center">{rightIcon}</span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
