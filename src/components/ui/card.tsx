import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

  const paddingMap = {
    none: "",
    sm: "p-3",
    md: "[padding:var(--card-pad-y)_var(--card-pad-x)_var(--card-pad-x)]",
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
        "bg-surface-card shadow-card rounded-xl [box-shadow:inset_0_0_0_1px_var(--glass-rim),var(--shadow-card)] transition-all duration-200",
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
        "mb-3.5 flex items-center justify-between gap-3",
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
        "mt-3.5 flex items-center justify-end gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter };
