import { type ReactNode } from "react";

/**
 * The header every card uses: a title, one line of context, and an optional
 * action on the right. Same height and same rhythm everywhere, so titles line
 * up from card to card instead of drifting with each component's own markup.
 */
export function CardHead({
  title,
  subtitle,
  action,
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="chead">
      <div className="chead__text">
        <h2 id={id}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
