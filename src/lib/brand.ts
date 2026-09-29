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

export function applyBrand(primary: string, accent?: string) {
  if (!primary || typeof document === "undefined") return;
  const accentColor = accent || primary;
  const root = document.documentElement;
  const onPrimary = getContrastTextColor(primary);

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--accent-color", accentColor);
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--on-primary", onPrimary);
  root.style.setProperty(
    "--primary-hover",
    `color-mix(in oklab, ${primary} 85%, black)`,
  );
  root.style.setProperty(
    "--primary-deep",
    `color-mix(in oklab, ${primary} 70%, black)`,
  );
  root.style.setProperty(
    "--primary-glow",
    `color-mix(in oklab, ${primary} 30%, transparent)`,
  );
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${primary} 0%, ${accentColor} 100%)`,
  );
}
