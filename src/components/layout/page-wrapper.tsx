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
    <div className="flex min-h-screen flex-col">
      {/* Sticky top bar with page title + search + user. The Topbar is
          the single source of truth for the page title; the body must
          not render it again or you get a "double title" — a tiny
          one in the topbar and a larger one in the content area. */}
      <Topbar title={title} subtitle={subtitle} />

      {/* Page content */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* Optional action bar. Only rendered when the page passes
            `actions` — keeps the layout clean for pages that have
            no page-level CTAs. */}
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2">
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
