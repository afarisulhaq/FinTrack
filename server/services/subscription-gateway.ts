import { z } from "zod";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const gatewayInvoiceSchema = z.object({
  id: z.string().min(1).max(100),
  external_id: z.string().min(1).max(200),
  environment: z.enum(["sandbox", "production"]),
  connection_id: z.string().min(1).max(100).nullable(),
  amount: z.number().int().min(1).max(1_000_000_000),
  payable_amount: z.number().int().min(1).max(1_000_000_099),
  provider: z.enum(["gopay", "shopeepay"]),
  status: z.enum(["pending", "paid", "expired", "cancelled", "failed"]),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable(),
  checkout_url: z.string().url(),
  qr_code: z.string().max(4096).nullable(),
  qr_url: z.string().url().nullable(),
  payment_warning: z.string().nullable().optional(),
});

export type GatewayInvoice = z.infer<typeof gatewayInvoiceSchema>;

export interface BillingConfig {
  url: string;
  key: string;
  price: number;
  days: number;
  name: string;
  environment: "sandbox" | "production";
  provider: "gopay" | "shopeepay" | null;
  connectionId: string | null;
  plan: string;
  account: string;
}

export function billingConfig(): BillingConfig | null {
  if (process.env.SUBSCRIPTIONS_ENABLED !== "true") return null;
  const parsed = z
    .object({
      url: z.string().url(),
      key: z.string().min(16).max(200),
      price: z.coerce.number().int().min(1).max(100_000_000),
      days: z.coerce.number().int().min(1).max(366),
      name: z.string().trim().min(1).max(80),
      environment: z.enum(["sandbox", "production"]),
      provider: z.enum(["gopay", "shopeepay"]).optional(),
      connectionId: z.string().trim().min(1).max(100).optional(),
    })
    .safeParse({
      url: process.env.QRIS_BASE_URL,
      key: process.env.QRIS_API_KEY,
      price: process.env.SUBSCRIPTION_PRICE_IDR,
      days: process.env.SUBSCRIPTION_DURATION_DAYS,
      name: process.env.SUBSCRIPTION_PLAN_NAME,
      environment: process.env.QRIS_ENVIRONMENT,
      provider: process.env.QRIS_PROVIDER?.trim() || undefined,
      connectionId: process.env.QRIS_CONNECTION_ID?.trim() || undefined,
    });
  if (!parsed.success)
    throw new BillingError("Konfigurasi langganan belum lengkap", 503);
  // Production invoices require a managed wallet; sandbox keys carry none.
  if (parsed.data.environment === "production" && !parsed.data.connectionId)
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
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new BillingError("Gateway jarak jauh harus memakai HTTPS", 503);
  }
  const normalizedUrl = parsed.data.url.replace(/\/$/, "");
  return {
    url: normalizedUrl,
    key: parsed.data.key,
    price: parsed.data.price,
    days: parsed.data.days,
    name: parsed.data.name,
    environment: parsed.data.environment,
    provider: parsed.data.provider ?? null,
    connectionId: parsed.data.connectionId ?? null,
    plan: "subscription",
    // Binds stored invoices to this gateway/environment/wallet so a config
    // change stops verification of invoices created under the old one.
    account: createHash("sha256")
      .update(
        `${normalizedUrl}|${parsed.data.environment}|${parsed.data.connectionId ?? ""}`,
      )
      .digest("hex"),
  };
}

export function validatePaymentQr(payload: string, amount: number): boolean {
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
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.key,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    throw new BillingError(
      "Gateway pembayaran belum bisa dihubungi. Coba lagi nanti.",
      502,
    );
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Status-only responses fall through to the checks below.
  }
  if (!response.ok) {
    const status =
      response.status >= 400 && response.status <= 599 ? response.status : 502;
    throw new BillingError(
      "Gateway pembayaran gagal memproses permintaan. Coba lagi nanti.",
      status,
    );
  }
  if (body === null || typeof body !== "object")
    throw new BillingError("Respons QRIS dari gateway tidak valid", 502);
  return body;
}

function parseInvoice(body: unknown): GatewayInvoice {
  const result = gatewayInvoiceSchema.safeParse(body);
  if (!result.success)
    throw new BillingError("Respons QRIS dari gateway tidak valid", 502);
  return result.data;
}

interface InvoiceExpectation {
  externalId: string;
  amount: number;
  payableAmount?: number;
  invoiceId?: string;
}

// Every mismatch is reported as 502 (not 4xx): create keeps the row
// retryable under the same external_id instead of failing it on data that
// may only be transient.
function assertInvoiceMatches(
  config: BillingConfig,
  invoice: GatewayInvoice,
  expected: InvoiceExpectation,
): void {
  const checkout = new URL(invoice.checkout_url);
  const qrValid =
    invoice.status !== "pending" ||
    !invoice.qr_code ||
    (invoice.qr_code.startsWith("000201")
      ? validatePaymentQr(invoice.qr_code, invoice.payable_amount)
      : invoice.environment === "sandbox");
  const matches =
    invoice.environment === config.environment &&
    invoice.external_id === expected.externalId &&
    invoice.amount === expected.amount &&
    invoice.payable_amount >= invoice.amount &&
    invoice.payable_amount <= invoice.amount + 99 &&
    (expected.payableAmount === undefined ||
      invoice.payable_amount === expected.payableAmount) &&
    (expected.invoiceId === undefined || invoice.id === expected.invoiceId) &&
    invoice.connection_id === config.connectionId &&
    (config.provider === null || invoice.provider === config.provider) &&
    (invoice.status !== "paid" || invoice.paid_at !== null) &&
    checkout.origin === new URL(config.url).origin &&
    checkout.pathname.startsWith("/pay/") &&
    qrValid;
  if (!matches)
    throw new BillingError("Respons QRIS dari gateway tidak valid", 502);
}

export function externalIdFor(
  config: BillingConfig,
  invoiceId: string,
): string {
  return `fintrack:${config.environment}:${invoiceId}`;
}

// Inverse of externalIdFor: extracts the FinTrack invoice id, or null when
// the reference belongs to another environment or website.
export function invoiceIdFromExternalId(
  config: BillingConfig,
  externalId: string,
): string | null {
  const prefix = `fintrack:${config.environment}:`;
  if (!externalId.startsWith(prefix)) return null;
  const invoiceId = externalId.slice(prefix.length);
  return invoiceId.length > 0 && !invoiceId.includes(":") ? invoiceId : null;
}

export async function createGatewayInvoice(
  config: BillingConfig,
  order: { id: string; amount: number; description: string },
): Promise<GatewayInvoice> {
  const externalId = externalIdFor(config, order.id);
  const invoice = parseInvoice(
    await gateway(config, "/v1/invoices", {
      method: "POST",
      body: JSON.stringify({
        amount: order.amount,
        description: order.description,
        external_id: externalId,
        ...(config.provider ? { provider: config.provider } : {}),
        ...(config.connectionId ? { connection_id: config.connectionId } : {}),
      }),
    }),
  );
  assertInvoiceMatches(config, invoice, { externalId, amount: order.amount });
  return invoice;
}

export async function checkGatewayInvoice(
  config: BillingConfig,
  order: { id: string; amount: number },
  invoiceId: string,
): Promise<GatewayInvoice> {
  const invoice = parseInvoice(
    await gateway(
      config,
      `/v1/invoices/${encodeURIComponent(invoiceId)}/check`,
      {
        method: "POST",
      },
    ),
  );
  assertInvoiceMatches(config, invoice, {
    externalId: externalIdFor(config, order.id),
    amount: order.amount,
    invoiceId,
  });
  return invoice;
}

export function webhookSecrets(): string[] {
  return (process.env.QRIS_WEBHOOK_SECRETS ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

// The gateway signs the raw body bytes; verify before any JSON parsing.
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const received = Buffer.from(signature.slice(7), "hex");
  return webhookSecrets().some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  });
}

export const webhookEventSchema = z.object({
  id: z.string().min(1).max(100),
  event: z.string().min(1).max(100),
  created_at: z.string().min(1).max(40),
  data: gatewayInvoiceSchema,
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
