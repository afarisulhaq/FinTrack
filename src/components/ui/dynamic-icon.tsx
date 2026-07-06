import * as LucideIcons from "lucide-react";
import { type LucideIcon, type LucideProps } from "lucide-react";

export interface DynamicIconProps extends Omit<LucideProps, "name"> {
  name: string;
}

const EMOJI_ICON_MAP: Record<string, string> = {
  "💼": "Briefcase",
  "💵": "Banknote",
  "🎁": "Gift",
  "🏆": "Trophy",
  "💻": "Laptop",
  "📈": "TrendingUp",
  "🍔": "Utensils",
  "🚗": "Car",
  "🛍️": "ShoppingCart",
  "🎬": "Film",
  "🏥": "HeartPulse",
  "💡": "Lightbulb",
  "🏦": "Landmark",
  "🏛️": "Landmark",
  "💰": "Coins",
  "📱": "Smartphone",
  "☕": "Coffee",
  "🌐": "Globe",
  "🛡️": "Shield",
  "🌟": "Star",
  "🔄": "ArrowRightLeft",
  "➕": "Plus",
  "👁": "Eye",
  "📊": "BarChart3",
  "💬": "MessageCircle",
  "✈️": "Send",
  "📧": "Mail",
  "🔔": "Bell",
  "📦": "Package",
};

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const normalizedName = EMOJI_ICON_MAP[name] ?? name;
  const pascalName = normalizedName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const Icon =
    icons[pascalName] || icons[normalizedName] || LucideIcons.CircleHelp;

  return <Icon {...props} />;
}
