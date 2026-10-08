import { z } from "zod";
import { createHash } from "node:crypto";

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function billingConfig() {
  if (process.env.SUBSCRIPTIONS_ENABLED !== "true") return null;
  const parsed = z
    .object({
      url: z.string().url(),
      key: z.string().min(16),
      price: z.coerce.number().int().min(1).max(100_000_000),
      days: z.coerce.number().int().min(1).max(366),
      name: z.string().trim().min(1).max(80),
      dedicated: z.literal("true"),
      merchant: z.string().trim().min(1).max(200),
    })
    .safeParse({
      url: process.env.GOPAY_GATEWAY_URL,
      key: process.env.GOPAY_GATEWAY_API_KEY,
      price: process.env.SUBSCRIPTION_PRICE_IDR,
      days: process.env.SUBSCRIPTION_DURATION_DAYS,
      name: process.env.SUBSCRIPTION_PLAN_NAME,
      dedicated: process.env.GOPAY_DEDICATED_MERCHANT,
      merchant: process.env.GOPAY_GATEWAY_MERCHANT_ID,
    });
  if (!parsed.success)
    throw new BillingError("Konfigurasi langganan belum lengkap", 503);
  const url = new URL(parsed.data.url);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol)
  ) {
    throw new BillingError("Konfigurasi gateway tidak valid", 503);
  }
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]", "qris-gateway"].includes(url.hostname)
  ) {
    throw new BillingError("Gateway jarak jauh harus memakai HTTPS", 503);
  }
  const normalizedUrl = parsed.data.url.replace(/\/$/, "");
  return {
    ...parsed.data,
    url: normalizedUrl,
    plan: "subscription",
    account: createHash("sha256")
      .update(`${normalizedUrl}|${parsed.data.merchant}`)
      .digest("hex"),
  };
}

export type BillingConfig = NonNullable<ReturnType<typeof billingConfig>>;

export function validatePaymentQr(payload: string, amount: number) {
  const tags = new Map<string, string>();
  let cursor = 0;
  while (cursor < payload.length) {
    const header = payload.slice(cursor, cursor + 4);
    if (!/^\d{4}$/.test(header)) return false;
    const tag = header.slice(0, 2);
    const length = Number(header.slice(2));
    if (tags.has(tag) || cursor + 4 + length > payload.length) return false;
    tags.set(tag, payload.slice(cursor + 4, cursor + 4 + length));
    cursor += 4 + length;
    if (tag === "63" && (length !== 4 || cursor !== payload.length))
      return false;
  }
  let crc = 0xffff;
  for (const character of payload.slice(0, -4)) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return (
    tags.get("00") === "01" &&
    tags.get("01") === "12" &&
    tags.get("53") === "360" &&
    tags.get("58") === "ID" &&
    tags.get("54") === String(amount) &&
    payload.slice(-8, -4) === "6304" &&
    tags.get("63")?.toUpperCase() ===
      crc.toString(16).toUpperCase().padStart(4, "0")
  );
}

async function gateway(
  config: BillingConfig,
  path: string,
  init: RequestInit = {},
) {
  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": config.key,
        "X-Gopay-Merchant-Id": config.merchant,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error("Gateway request failed");
    return body;
  } catch {
    throw new BillingError(
      "Gateway pembayaran belum bisa dihubungi. Coba lagi nanti.",
      502,
    );
  }
}

export async function createGatewayQr(config: BillingConfig, amount: number) {
  const result = z
    .object({
      success: z.literal(true),
      data: z.object({
        amount: z.literal(amount),
        qris_code: z.string().min(20).max(2048).startsWith("000201"),
        trx_id: z.string().min(1).max(120),
        expires_at: z.string().datetime(),
      }),
    })
    .safeParse(
      await gateway(config, "/create-qris", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
    );
  if (!result.success)
    throw new BillingError("Respons QRIS dari gateway tidak valid", 502);
  if (!validatePaymentQr(result.data.data.qris_code, amount))
    throw new BillingError(
      "Nominal atau format QRIS dari gateway tidak sesuai",
      502,
    );
  return result.data.data;
}

export interface PaymentCandidate {
  transaction_id: string;
  amount: number;
  status: string;
  time: string;
}

export function matchPayment(
  rows: PaymentCandidate[],
  invoice: { amount: number; createdAt: Date; expiresAt: Date },
) {
  if (rows.length >= 100)
    throw new BillingError(
      "Mutasi terlalu banyak untuk diverifikasi otomatis. Hubungi pengelola.",
      409,
    );
  const matches = rows.filter((row) => {
    const time = Date.parse(row.time);
    return (
      ["settlement", "capture"].includes(row.status.toLowerCase()) &&
      row.amount === invoice.amount &&
      Number.isFinite(time) &&
      time >= invoice.createdAt.getTime() &&
      time <= invoice.expiresAt.getTime() &&
      time <= Date.now()
    );
  });
  if (matches.length > 1)
    throw new BillingError(
      "Ada lebih dari satu pembayaran yang cocok. Hubungi pengelola.",
      409,
    );
  return matches[0] ?? null;
}

export async function checkGatewayPayment(
  config: BillingConfig,
  invoice: {
    amount: number;
    createdAt: Date;
    expiresAt: Date;
  },
) {
  const query = new URLSearchParams({
    startTime: String(Math.floor(invoice.createdAt.getTime() / 1000)),
    endTime: String(
      Math.ceil(Math.min(Date.now(), invoice.expiresAt.getTime()) / 1000),
    ),
    pageSize: "100",
  });
  const result = z
    .object({
      success: z.literal(true),
      data: z.object({
        transactions: z.array(
          z.object({
            transaction_id: z.string().min(1).max(200),
            amount: z.number().int().positive(),
            status: z.string(),
            time: z.string(),
          }),
        ),
      }),
    })
    .safeParse(await gateway(config, `/transactions?${query}`));
  if (!result.success)
    throw new BillingError("Respons mutasi dari gateway tidak valid", 502);
  return matchPayment(result.data.data.transactions, invoice);
}
