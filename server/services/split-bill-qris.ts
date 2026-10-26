import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type {
  QrisGatewaySetting,
  QrisSplitInvoice,
} from "@prisma/client";
import { db } from "../prisma-client.js";
import {
  BillingError,
  createGatewayInvoice,
  externalIdFor,
  validateGatewayConfig,
  type GatewayConfig,
} from "./subscription-gateway.js";

export interface QrisGatewaySettingsInput {
  baseUrl: unknown;
  environment: unknown;
  provider?: unknown;
  connectionId?: unknown;
  apiKey?: unknown;
}

function encryptionKey(): Buffer {
  const value = process.env.QRIS_SETTINGS_ENCRYPTION_KEY;
  if (!value) throw new BillingError("Kunci enkripsi QRIS belum dikonfigurasi", 503);
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(value)) key = Buffer.from(value, "hex");
  else {
    try {
      key = Buffer.from(value, "base64");
    } catch {
      key = Buffer.alloc(0);
    }
  }
  if (key.length !== 32)
    throw new BillingError("Kunci enkripsi QRIS tidak valid", 503);
  return key;
}

export function encryptQrisApiKey(apiKey: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptQrisApiKey(payload: string, userId: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = payload.split(".");
  if (!version || version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext)
    throw new BillingError("Kredensial QRIS tersimpan tidak valid", 503);
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof BillingError) throw error;
    throw new BillingError("Kredensial QRIS tersimpan tidak dapat dibuka", 503);
  }
}

function maskedApiKey(setting: QrisGatewaySetting): string {
  const key = decryptQrisApiKey(setting.apiKeyCiphertext, setting.userId);
  const suffix = key.slice(-4);
  return `${"*".repeat(Math.min(12, Math.max(4, key.length - suffix.length)))}${suffix}`;
}

export function publicGatewaySettings(setting: QrisGatewaySetting | null) {
  return {
    configured: Boolean(setting),
    baseUrl: setting?.baseUrl ?? "",
    environment: setting?.environment ?? "sandbox",
    provider: setting?.provider ?? null,
    connectionId: setting?.connectionId ?? null,
    apiKeyMasked: setting ? maskedApiKey(setting) : null,
  };
}

export async function getQrisGatewaySettings(userId: string) {
  return publicGatewaySettings(
    await db.qrisGatewaySetting.findUnique({ where: { userId } }),
  );
}

export async function putQrisGatewaySettings(
  userId: string,
  input: QrisGatewaySettingsInput,
) {
  const existing = await db.qrisGatewaySetting.findUnique({ where: { userId } });
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim()
      : existing
        ? decryptQrisApiKey(existing.apiKeyCiphertext, userId)
        : "";
  const environment = input.environment ?? existing?.environment;
  const provider = input.provider === undefined ? existing?.provider : input.provider;
  const connectionId =
    input.connectionId === undefined ? existing?.connectionId : input.connectionId;
  const config = validateGatewayConfig(
    {
      url: input.baseUrl,
      key: apiKey,
      environment,
      provider,
      connectionId,
    },
    "Pengaturan QRIS belum lengkap",
    400,
  );
  const data = {
    baseUrl: config.url,
    environment: config.environment,
    provider: config.provider,
    connectionId: config.connectionId,
    apiKeyCiphertext: encryptQrisApiKey(apiKey, userId),
  };
  return publicGatewaySettings(
    await db.qrisGatewaySetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    }),
  );
}

async function ownerGatewayConfig(ownerId: string): Promise<GatewayConfig> {
  const setting = await db.qrisGatewaySetting.findUnique({
    where: { userId: ownerId },
  });
  if (!setting) throw new BillingError("Gateway QRIS belum dikonfigurasi", 409);
  return validateGatewayConfig({
    url: setting.baseUrl,
    key: decryptQrisApiKey(setting.apiKeyCiphertext, ownerId),
    environment: setting.environment,
    provider: setting.provider ?? undefined,
    connectionId: setting.connectionId ?? undefined,
  });
}


function splitGatewayConfig(config: GatewayConfig): GatewayConfig {
  return {
    ...config,
    account: createHash("sha256")
      .update(
        `${config.account}|split-bills|${createHash("sha256").update(config.key).digest("hex")}`,
      )
      .digest("hex"),
  };
}

export function publicQrisPayment(row: QrisSplitInvoice) {
  return {
    amount: row.amount,
    qrisCode: row.qrisCode,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt,
  };
}

export async function createSplitBillQrisInvoice(
  ownerId: string,
  splitBillId: string,
  participantId: string,
) {
  const bill = await db.splitBill.findFirst({
    where: { id: splitBillId, userId: ownerId },
    include: { participants: { where: { id: participantId } } },
  });
  const participant = bill?.participants[0];
  if (!bill || !participant)
    throw new BillingError("Peserta patungan tidak ditemukan", 404);
  const config = splitGatewayConfig(await ownerGatewayConfig(ownerId));
  if (participant.paid)
    throw new BillingError("Peserta sudah melunasi patungan", 409);
  const amount = Number(participant.amount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000)
    throw new BillingError("Nominal peserta tidak valid", 400);

  const reservation = await db.$transaction(async (tx) => {
    const lock = createHash("sha256")
      .update(`${splitBillId}:${participantId}`)
      .digest()
      .readBigInt64BE();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lock})::text`;
    const existing = await tx.qrisSplitInvoice.findFirst({
      where: {
        splitBillId,
        participantId,
        ownerId,
        status: { in: ["creating", "pending"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (
      existing?.status === "pending" &&
      existing.gatewayAccount === config.account
    )
      return { row: existing, fresh: false };
    if (existing?.gatewayAccount === config.account)
      return { row: existing, fresh: true };
    return {
      row: await tx.qrisSplitInvoice.create({
        data: {
          splitBillId,
          participantId,
          ownerId,
          baseAmount: amount,
          amount,
          gatewayAccount: config.account,
          expiresAt: new Date(Date.now() + 300_000),
        },
      }),
      fresh: true,
    };
  });
  if (!reservation.fresh) return publicQrisPayment(reservation.row);

  const row = reservation.row;
  try {
    const invoice = await createGatewayInvoice(config, {
      id: `split:${row.id}`,
      amount: row.baseAmount,
      description: `Patungan ${bill.title} - ${participant.name}`.slice(0, 200),
    });
    if (invoice.external_id !== externalIdFor(config, `split:${row.id}`))
      throw new BillingError("Respons QRIS dari gateway tidak valid", 502);
    const expiresAt = new Date(
      Math.min(row.expiresAt.getTime(), Date.parse(invoice.expires_at)),
    );
    if (expiresAt <= new Date())
      throw new BillingError("Invoice dari gateway sudah kedaluwarsa", 502);
    return publicQrisPayment(
      await db.qrisSplitInvoice.update({
        where: { id: row.id },
        data: {
          status: "pending",
          amount: invoice.payable_amount,
          qrisCode: invoice.qr_code,
          checkoutUrl: invoice.checkout_url,
          gatewayReference: invoice.id,
          expiresAt,
        },
      }),
    );
  } catch (error) {
    if (
      error instanceof BillingError &&
      [400, 401, 403, 404].includes(error.status)
    ) {
      await db.qrisSplitInvoice.updateMany({
        where: { id: row.id, status: "creating" },
        data: { status: "failed" },
      });
    }
    throw error;
  }
}

export async function publicSplitBillQrisPayment(
  splitBillId: string,
  participantId: string,
) {
  try {
    const row = await db.qrisSplitInvoice.findFirst({
      where: {
        splitBillId,
        participantId,
        splitBill: { participants: { some: { id: participantId } } },
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    return row ? publicQrisPayment(row) : undefined;
  } catch {
    return undefined;
  }
}
