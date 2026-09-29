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
    <div className="flex min-h-screen flex-col bg-bg-base">
      {/* Sticky top bar with page title + search + user */}
      <Topbar title={title} subtitle={subtitle} />

      {/* Page content */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Optional action bar */}
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {actions}
          </div>
        )}

        {/* Page body */}
        {children}
      </main>
    </div>
  );
}

export { PageWrapper };
