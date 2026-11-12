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

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const hue = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * The dark-mode primary is the same hue, lifted until it clears the smoked
 * canvas. Lifting in HSL keeps the saturation the tenant picked; mixing toward
 * white in RGB would wash the brand out into grey.
 */
function liftForDark(hex: string) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return hslToHex(h, Math.max(s, 0.42), Math.max(l, 0.62));
}

/**
 * Writes the tenant brand as raw values and lets CSS pick the ink per theme.
 *
 * Only the light-theme ink is decided here, because only the light theme fills
 * with the raw brand. Dark mode fills with a lifted version of it, and a
 * lifted colour is light by construction, so its ink is a constant in CSS.
 * Keeping the derivation split this way means a theme toggle never needs this
 * function to run again.
 */
export function applyBrand(primary: string, accent?: string) {
  if (!primary || typeof document === "undefined") return;
  const accentColor = accent || primary;
  const root = document.documentElement;

  root.style.setProperty("--brand", primary);
  root.style.setProperty("--brand-accent", accentColor);
  root.style.setProperty("--brand-dark", liftForDark(primary));
  root.style.setProperty("--brand-ink", getContrastTextColor(primary));
}
