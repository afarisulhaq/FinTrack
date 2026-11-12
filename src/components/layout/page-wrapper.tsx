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
    <div className="flex flex-1 flex-col bg-bg-base">
      {/* Sticky top bar with page title + search + user */}
      <Topbar title={title} subtitle={subtitle} />

      {/* Every route shares one container: same max width, same padding, same
          gap between sections. Card edges therefore line up across pages.
          A div, not a second <main>: the dashboard layout already owns one. */}
      <div className="page-shell">
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {actions}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export { PageWrapper };
