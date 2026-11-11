export function getContrastTextColor(hexColor: string): "#ffffff" | "#121417" {
  const hex = hexColor.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#121417" : "#ffffff";
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#121417" : "#ffffff";
  }
  return "#ffffff";
}

/**
 * Writes the tenant brand as two raw values, one per theme, and leaves
 * every derived token (`--primary`, `--primary-hover`, `--on-primary`,
 * ...) to CSS in globals.css. Doing the derivation in CSS means a theme
 * toggle needs no re-run of this function and can never leave the two
 * modes disagreeing.
 *
 * A brand colour chosen against the light sage canvas is far too dark
 * to read on the smoked-green one, so dark mode gets a lifted variant
 * of the same hue instead of the raw value.
 */
export function applyBrand(primary: string, accent?: string) {
  if (!primary || typeof document === "undefined") return;
  const accentColor = accent || primary;
  const root = document.documentElement;

  root.style.setProperty("--brand", primary);
  root.style.setProperty("--brand-accent", accentColor);
  root.style.setProperty(
    "--brand-dark",
    `color-mix(in oklab, ${primary} 55%, white)`,
  );
  root.style.setProperty("--on-primary", getContrastTextColor(primary));
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${primary} 0%, ${accentColor} 100%)`,
  );
}
