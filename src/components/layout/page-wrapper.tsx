import { type ReactNode } from "react";
import { Topbar } from "./topbar";

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  /** Optional action buttons rendered in the top-right of the content area */
  actions?: ReactNode;
  children: ReactNode;
}

function PageWrapper({ title, subtitle, actions, children }: PageWrapperProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky top bar with page title + search + user */}
      <Topbar title={title} subtitle={subtitle} />

      {/* Page content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Page heading row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-text-primary leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {/* Page body */}
        {children}
      </main>
    </div>
  );
}

export { PageWrapper };
