import { cn } from "~/lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedClasses = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-xl",
  full: "rounded-full",
};

export function Skeleton({ className, width, height, rounded = "md" }: SkeletonProps) {
  return <div className={cn("skeleton", roundedClasses[rounded], className)} style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-bg-surface p-5 space-y-4", className)}>
      <div className="flex items-center gap-3"><SkeletonAvatar /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div></div>
      <Skeleton className="h-24 w-full" rounded="lg" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return <div className={cn("space-y-2", className)}>{Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")} />)}</div>;
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} rounded="full" />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return <div className="rounded-xl border border-border overflow-hidden">{Array.from({ length: rows }, (_, row) => <div key={row} className="grid gap-4 p-4 border-b border-border last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{Array.from({ length: cols }, (_, col) => <Skeleton key={col} className="h-4 w-full" />)}</div>)}</div>;
}

export function SkeletonStatCard() {
  return <div className="rounded-xl border border-border bg-bg-surface p-5 space-y-3"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-7 w-3/4" /><Skeleton className="h-3 w-2/5" /></div>;
}
