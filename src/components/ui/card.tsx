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
        "bg-surface-card border-border rounded-2xl border shadow-sm",
        paddingMap[padding],
        className,
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
        "border-border mb-4 flex items-center justify-between gap-3 border-b pb-4",
        className,
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
        "border-border mt-4 flex items-center justify-end gap-3 border-t pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter };
