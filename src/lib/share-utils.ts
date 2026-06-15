/**
 * Helpers for building shareable text / links for split bills.
 *
 * Centralized so the same message format is used by:
 *  - The QrisModal "Bagikan" section (in-app)
 *  - The split-bills detail modal per-row share buttons
 *  - Any future share surface (e.g. Telegram bot notification)
 */

export interface ShareTextInput {
  /** Split bill title, e.g. "Makan Siang". */
  billTitle?: string;
  /** Participant display name. */
  participantName?: string;
  /** Pre-formatted amount string, e.g. "Rp 50.000". */
  amount: string;
  /** Public pay URL for this participant. */
  shareUrl: string;
}

/**
 * Compose the WhatsApp / generic share text. Keep it short and skimmable —
 * the link is the actual payload, the rest is context.
 */
export function buildShareText({
  billTitle,
  participantName,
  amount,
  shareUrl,
}: ShareTextInput): string {
  const greet = participantName ? `Halo *${participantName}*!` : "Halo!";
  const titleLine = billTitle ? `*${truncate(billTitle, 40)}*` : null;

  return [
    greet,
    titleLine,
    `Tagihan kamu: *${amount}*`,
    "Buka link ini untuk lihat QRIS & konfirmasi pembayaran:",
    shareUrl,
    "🙏",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the public pay URL for a participant. Browser-safe: prefers the
 * current origin so it works in dev (localhost) and prod without config.
 */
export function buildPayUrl(billId: string, token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pay/${billId}/${token}`;
  }
  // SSR fallback — caller can override if they have a known public host.
  return `/pay/${billId}/${token}`;
}

/**
 * Normalize a phone number to the WhatsApp deep-link format.
 *
 * Strips everything but digits, then assumes an Indonesian mobile number
 * (08xx → 628xx). If the number already starts with a country code, it's
 * used as-is. Returns `undefined` if the input is empty / unusable.
 */
export function normalizePhone(input?: string | null): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  // Fallback: assume it's a local number that needs a +62 prefix.
  return "62" + digits;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
