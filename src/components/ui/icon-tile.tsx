import { DynamicIcon } from "./dynamic-icon";

/**
 * A category or wallet glyph in a soft tile.
 *
 * The hue is the item's own colour and it appears twice: as a 14% wash behind
 * the glyph, and mixed 62/38 toward the page ink for the glyph itself. Straight
 * user colour on a tinted wash can land near 1:1 in one of the two themes, so
 * the mix is what keeps every icon legible without flattening it to grey.
 */
export function IconTile({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "sm"
      ? "h-7 w-7 rounded-[9px]"
      : size === "lg"
        ? "h-9 w-9 rounded-[11px]"
        : "h-8 w-8 rounded-[10px]";
  return (
    <span
      className={`icon-tile ${box} ${className ?? ""}`}
      style={color ? ({ "--tile-hue": color } as React.CSSProperties) : undefined}
      aria-hidden
    >
      <DynamicIcon
        name={icon}
        className={size === "sm" ? "h-4 w-4" : size === "lg" ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]"}
      />
    </span>
  );
}
