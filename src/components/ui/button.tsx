"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg",
    "transition-all duration-200 select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary shadow-sm hover:shadow-md",
        ghost:
          "text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:ring-primary",
        outline:
          "border border-border text-text-primary hover:bg-bg-elevated hover:border-primary/50 focus-visible:ring-primary",
        danger:
          "bg-danger text-white hover:bg-red-600 focus-visible:ring-danger shadow-sm",
        success:
          "bg-success text-white hover:bg-green-600 focus-visible:ring-success shadow-sm",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
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
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : leftIcon ? (
          <span className="shrink-0 flex items-center">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon ? (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
