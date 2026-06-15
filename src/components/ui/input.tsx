"use client";

import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leftIcon, rightIcon, id, ...props },
    ref
  ) => {
    const inputId =
      id ?? label?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg border text-sm",
              "bg-bg-surface border-border text-text-primary placeholder:text-text-muted",
              "h-10 px-3",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "autofill:bg-bg-surface",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              error && "border-danger focus:ring-danger/50 focus:border-danger",
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-danger leading-tight">{error}</p>}
        {hint && !error && (
          <p className="text-xs text-text-muted leading-tight">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
