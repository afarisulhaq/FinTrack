"use client";

import { type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {/* Icon container */}
      <div className="mb-5 p-4 rounded-2xl bg-bg-elevated border border-border">
        <span className="flex items-center justify-center text-text-muted [&>svg]:h-8 [&>svg]:w-8">
          {icon}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary mb-1.5">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-muted max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <Button
          variant="default"
          size="sm"
          className="mt-6"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
