import Tesseract from "tesseract.js";

export interface ParseResult {
  type: "income" | "expense";
  amount: number;
  category: string;
  wallet: string;
  description: string;
  confidence: number;
  reply: string;
}

export function parseFinanceText(text: string): ParseResult {
  const lower = text.toLowerCase();

  // ─── Parse amount ──────────────────────────────────────────────────
  const amountMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|k)?/);
  let amount = amountMatch?.[1] ? Number(amountMatch[1].replace(",", ".")) : 0;
  const unit = amountMatch?.[2];
  if (unit === "rb" || unit === "ribu" || unit === "k") amount *= 1000;
  if (unit === "jt" || unit === "juta") amount *= 1_000_000;

  // ─── Detect explicit wallet via "pakai / pake / dari" ──────────────
  const walletPattern = /(?:pakai|pake|dari)\s+([^\d]+)/i;
  const walletMatch = text.match(walletPattern);
  const explicitWallet = walletMatch
    ? walletMatch[1].trim()
    : null;

  // ─── Extract description: everything after amount, minus wallet spec ─
  const amountStr = amountMatch?.[0] ?? "";
  const afterAmount = text
    .slice(text.indexOf(amountStr) + amountStr.length)
    .trim();
  const description = afterAmount
    .replace(/(?:pakai|pake|dari)\s+.+/i, "") // remove "pakai ..." entirely
    .trim() || text.replace(amountStr, "").trim() || text;

  // ─── Category ──────────────────────────────────────────────────────
  const category =
    lower.includes("kopi")
      ? "Kopi & Minuman"
      : lower.includes("gojek") || lower.includes("grab") || lower.includes("ojol") || lower.includes("taxi") || lower.includes("go-car")
        ? "Transport"
        : lower.includes("bensin") || lower.includes("bbm") || lower.includes("solar") || lower.includes("pertalite") || lower.includes("pertamax")
          ? "Transport"
          : lower.includes("pulsa") || lower.includes("kuota") || lower.includes("paket data")
            ? "Internet & Pulsa"
            : lower.includes("listrik") || lower.includes("pdam") || lower.includes("pln") || lower.includes("tagihan")
              ? "Utilities"
              : lower.includes("belanja") || lower.includes("alfamart") || lower.includes("indomaret") || lower.includes("supermarket") || lower.includes("minimarket")
                ? "Belanja"
                : lower.includes("makan") || lower.includes("beli") || lower.includes("sarapan") || lower.includes("minum") || lower.includes("jajan")
                  ? "Makan"
                  : lower.includes("air") && !lower.includes("tagihan")
                    ? "Kopi & Minuman"
                    : "Lainnya";

  // ─── Wallet ────────────────────────────────────────────────────────
  // Priority: explicit "pakai [wallet]" > keyword match > "Dompet Utama"
  const wallet =
    explicitWallet ??
    (lower.includes("jajan")
      ? "Kantong Jajan"
      : lower.includes("bca")
        ? "BCA"
        : lower.includes("mandiri")
          ? "Mandiri"
          : lower.includes("gopay") || lower.includes("ovo") || lower.includes("dana") || lower.includes("shopeepay")
            ? "E-Wallet"
            : lower.includes("kantong")
              ? "Kantong Jajan"
              : "Dompet Utama");
  const type =
    lower.includes("gaji") || lower.includes("masuk") ? "income" : "expense";

  const categoryIcon =
    category === "Makan"
      ? "🍽️"
      : category === "Kopi & Minuman"
        ? "☕"
        : category === "Transport"
          ? "🚗"
          : category === "Internet & Pulsa"
            ? "📱"
            : "📦";

  return {
    type,
    amount,
    category,
    wallet,
    description: description || text,
    confidence: amount > 0 ? 0.91 : 0.55,
    reply:
      amount > 0
        ? `✅ *Transaksi Diterima!*\n${type === "income" ? "💚 Pemasukan" : "💸 Pengeluaran"}: Rp${amount.toLocaleString("id-ID")}\n📂 Kategori: ${category}\n👛 Dompet: ${wallet}`
        : `Saya belum menemukan nominal.\nContoh: "beli kopi 25rb pakai kantong jajan"\nAtau: /catat 50000 makan siang`,
  };
}

export function mockOcrReceipt() {
  return {
    store: "Alfamart",
    date: new Date().toISOString(),
    items: [
      { name: "Indomie Goreng × 3", amount: 9750 },
      { name: "Aqua 600ml", amount: 4500 },
      { name: "Teh Botol", amount: 5000 },
    ],
    total: 19250,
    suggestedCategory: "Makan",
    suggestedWallet: "Kantong Jajan",
    confidence: 0.95,
  };
}

/**
 * Run OCR on an image buffer to extract the total amount (in Rupiah).
 * Returns the amount as a string (e.g. "50000") or null if no amount found.
 */
export async function ocrReceiptImage(
  imageBuffer: Buffer,
): Promise<string | null> {
  try {
    const { data } = await Tesseract.recognize(imageBuffer, "ind");
    const text = data.text.trim();
    if (!text) return null;

    console.log("[OCR] Raw text:", text);

    // 1. Look for "total / jumlah / bayar" followed by a number
    const totalRe =
      /(?:total|jumlah|subtotal|grand\s*total|amount|bayar|dibayar|kembali)\s*[:=]?\s*(?:rp|Rp)?\s*([\d.,\s]+)/i;
    const totalMatch = text.match(totalRe);
    if (totalMatch) {
      const num = totalMatch[1]
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const amount = Number(num);
      if (amount > 0) return amount.toString();
    }

    // 2. Look for any "Rp"-prefixed number
    const rpMatches = text.matchAll(/(?:rp|Rp|RP)\s*([\d.,\s]+)/g);
    const amounts: number[] = [];
    for (const match of rpMatches) {
      const num = match[1]
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const amount = Number(num);
      if (amount > 0) amounts.push(amount);
    }
    if (amounts.length > 0) {
      // Use the largest amount (most likely the total)
      return Math.max(...amounts).toString();
    }

    // 3. Fallback: pick the largest number > 1000 in the text
    const allNumbers = text.match(/(\d[\d.,]*)/g);
    if (allNumbers) {
      const parsed = allNumbers
        .map((n) => {
          const cleaned = n.replace(/\./g, "").replace(",", ".");
          return Number(cleaned);
        })
        .filter((n) => n > 1000);
      if (parsed.length > 0) {
        return Math.max(...parsed).toString();
      }
    }

    return null;
  } catch (error) {
    console.error("[OCR] Error:", error);
    return null;
  }
}
