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
      {/* Sticky top bar with page title + search + user. The Topbar is
          the single source of truth for the page title; the body must
          not render it again or you get a "double title" — a tiny
          one in the topbar and a larger one in the content area. */}
      <Topbar title={title} subtitle={subtitle} />

      {/* Page content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Optional action bar. Only rendered when the page passes
            `actions` — keeps the layout clean for pages that have
            no page-level CTAs. */}
        {actions && (
          <div className="flex items-center justify-end gap-2">
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
