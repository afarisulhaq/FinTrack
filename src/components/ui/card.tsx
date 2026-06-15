import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
} as const;

interface CardProps {
  className?: string;
  children: ReactNode;
  padding?: keyof typeof paddingMap;
}

function Card({ className, children, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-bg-surface border border-border rounded-xl",
        paddingMap[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardSectionProps {
  className?: string;
  children: ReactNode;
}

function CardHeader({ className, children }: CardSectionProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 pb-4 mb-4 border-b border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardBody({ className, children }: CardSectionProps) {
  return <div className={cn("", className)}>{children}</div>;
}

function CardFooter({ className, children }: CardSectionProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter };
