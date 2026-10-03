"use client";

import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";
import { AmountInput } from "./amount-input";
import { cn } from "~/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  currency?: boolean;
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      id,
      currency,
      ...props
    },
    ref,
  ) => {
    const inputId =
      id ??
      label
        ?.toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    const Field = currency ? AmountInput : "input";

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-text-secondary text-sm font-medium"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="text-text-muted pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
              {leftIcon}
            </div>
          )}

          <Field
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg border text-sm",
              "bg-bg-surface border-border text-text-primary placeholder:text-text-muted",
              "h-10 px-3.5",
              "shadow-subtle transition-all duration-150",
              "focus:ring-primary/20 focus:border-primary focus:ring-2 focus:outline-none",
              "disabled:bg-bg-elevated/50 disabled:cursor-not-allowed disabled:opacity-50",
              "autofill:bg-bg-surface",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              error && "border-danger focus:ring-danger/20 focus:border-danger",
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <div className="text-text-muted pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="text-danger text-xs leading-tight">{error}</p>}
        {hint && !error && (
          <p className="text-text-muted text-xs leading-tight">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
