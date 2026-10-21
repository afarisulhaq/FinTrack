import type { SubscriptionInvoice } from "@prisma/client";
import { db } from "../prisma-client.js";
import { databasePage, type PageInput } from "./pagination.js";
import {
  BillingError,
  billingConfig,
  createGatewayInvoice,
  checkGatewayInvoice,
} from "./subscription-gateway.js";

export function publicInvoice(row: SubscriptionInvoice) {
  const status =
    ["creating", "pending"].includes(row.status) && row.expiresAt <= new Date()
      ? "expired"
      : row.status;
  return {
    id: row.id,
    planName: row.planName,
    baseAmount: row.baseAmount,
    amount: row.amount,
    uniqueAmount: row.amount - row.baseAmount,
    durationDays: row.durationDays,
    status,
    qrisCode: status === "pending" ? row.qrisCode : null,
    checkoutUrl: status === "pending" ? row.checkoutUrl : null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
  };
}

export async function billingOverview(userId: string) {
  const config = billingConfig();
  const [subscription, latestInvoice, openInvoice] = await Promise.all([
    db.subscription.findUnique({ where: { userId } }),
    db.subscriptionInvoice.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    db.subscriptionInvoice.findFirst({
      where: {
        userId,
        status: { in: ["creating", "pending"] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true, expiresAt: true },
    }),
  ]);
  return {
    available: Boolean(config),
    plan: config
      ? { name: config.name, price: config.price, durationDays: config.days }
      : null,
    subscription: subscription
      ? { ...subscription, active: subscription.expiresAt > new Date() }
      : null,
    latestInvoiceId: latestInvoice?.id ?? null,
    openInvoice,
  };
}

export async function listInvoices(userId: string, input: PageInput) {
  const where = { userId };
  const page = await databasePage(
    input,
    () => db.subscriptionInvoice.count({ where }),
    (skip, take) =>
      db.subscriptionInvoice.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
  );
  return {
    ...page,
    items: page.items.map((row) => ({
      ...publicInvoice(row),
      qrisCode: null,
      checkoutUrl: null,
    })),
  };
}

export async function invoiceById(userId: string, id: string) {
  const row = await db.subscriptionInvoice.findFirst({ where: { userId, id } });
  if (!row) throw new BillingError("Invoice tidak ditemukan", 404);
  return publicInvoice(row);
}

export async function createInvoice(userId: string) {
  const config = billingConfig();
  if (!config)
    throw new BillingError("Pembayaran langganan belum tersedia", 503);
  const reservation = await db.$transaction(async (tx) => {
    // Serialize invoice creation across users on one database.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904)::text`;
    const existing = await tx.subscriptionInvoice.findFirst({
      where: {
        userId,
        status: { in: ["creating", "pending"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.status === "pending")
      return { row: existing, fresh: false };
    // A row stuck in "creating" is retried under the same external_id; the
    // gateway replays it idempotently instead of opening a second invoice.
    if (existing) return { row: existing, fresh: true };
    const recent = await tx.subscriptionInvoice.count({
      where: {
        userId,
        createdAt: { gt: new Date(Date.now() - 3_600_000) },
      },
    });
    if (recent >= 3)
      throw new BillingError(
        "Maksimal tiga invoice baru per jam. Coba lagi nanti.",
        429,
      );
    const row = await tx.subscriptionInvoice.create({
      data: {
        userId,
        plan: config.plan,
        planName: config.name,
        baseAmount: config.price,
        // The gateway adds the unique payable code (Rp0 to Rp99) on top.
        amount: config.price,
        durationDays: config.days,
        gatewayAccount: config.account,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    return { row, fresh: true };
  });
  if (!reservation.fresh) return publicInvoice(reservation.row);
  const row = reservation.row;
  try {
    const invoice = await createGatewayInvoice(config, {
      id: row.id,
      amount: row.amount,
      description: `Langganan ${row.planName}`,
    });
    const expiresAt = new Date(
      Math.min(row.expiresAt.getTime(), Date.parse(invoice.expires_at)),
    );
    if (expiresAt <= new Date())
      throw new BillingError("Invoice dari gateway sudah kedaluwarsa", 502);
    const saved = await db.$transaction(async (tx) => {
      const current = await tx.subscriptionInvoice.findUniqueOrThrow({
        where: { id: row.id },
      });
      // A webhook can activate the invoice before this create response lands.
      const paid = current.status === "paid";
      return tx.subscriptionInvoice.update({
        where: { id: row.id },
        data: {
          status: paid ? "paid" : "pending",
          amount: invoice.payable_amount,
          qrisCode: invoice.qr_code,
          gatewayReference: invoice.id,
          checkoutUrl: invoice.checkout_url,
          expiresAt,
        },
      });
    });
    return publicInvoice(saved);
  } catch (error) {
    // Gateway rejections that cannot heal for this reference fail the row.
    // 409/429/5xx (in-flight create, quota, lost response) keep it retryable
    // under the same external_id, per the gateway integration guide.
    if (
      error instanceof BillingError &&
      [400, 401, 403, 404].includes(error.status)
    )
      await db.subscriptionInvoice.updateMany({
        where: { id: row.id, status: "creating" },
        data: { status: "failed" },
      });
    throw error;
  }
}

export async function applyPayment(invoiceId: string, paidAt: Date) {
  return db.$transaction(async (tx) => {
    // Serialize renewal and duplicate activation for the same account.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904)::text`;
    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    if (invoice.status === "paid") return publicInvoice(invoice);
    if (
      invoice.status !== "pending" ||
      !Number.isFinite(paidAt.getTime()) ||
      paidAt < invoice.createdAt ||
      paidAt > invoice.expiresAt ||
      paidAt > new Date()
    ) {
      throw new BillingError("Pembayaran tidak cocok dengan invoice", 409);
    }
    const previous = await tx.subscription.findUnique({
      where: { userId: invoice.userId },
    });
    const now = new Date();
    const start =
      previous && previous.expiresAt > now ? previous.expiresAt : now;
    const expiresAt = new Date(
      start.getTime() + invoice.durationDays * 86_400_000,
    );
    await tx.subscription.upsert({
      where: { userId: invoice.userId },
      create: { userId: invoice.userId, plan: invoice.plan, expiresAt },
      update: { plan: invoice.plan, expiresAt },
    });
    return publicInvoice(
      await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: "paid", paidAt },
      }),
    );
  });
}

export async function verifyInvoice(userId: string, invoiceId: string) {
  const invoice = await db.subscriptionInvoice.findFirst({
    where: { id: invoiceId, userId },
  });
  if (!invoice) throw new BillingError("Invoice tidak ditemukan", 404);
  if (invoice.status !== "pending") return publicInvoice(invoice);
  // Late on-time payments stay checkable for 24h; past that, manual review.
  if (Date.now() > invoice.expiresAt.getTime() + 86_400_000)
    return publicInvoice(invoice);
  const config = billingConfig();
  if (!config)
    throw new BillingError("Pembayaran langganan belum tersedia", 503);
  if (config.account !== invoice.gatewayAccount)
    throw new BillingError(
      "Akun gateway invoice berbeda dari konfigurasi saat ini. Hubungi pengelola.",
      409,
    );
  if (!invoice.gatewayReference)
    throw new BillingError(
      "Invoice gateway belum tersedia. Coba lagi nanti.",
      409,
    );
  const claimedCheck = await db.subscriptionInvoice.updateMany({
    where: {
      id: invoice.id,
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(Date.now() - 15_000) } },
      ],
    },
    data: { lastCheckedAt: new Date() },
  });
  if (!claimedCheck.count)
    throw new BillingError("Tunggu 15 detik sebelum memeriksa lagi", 429);
  const gatewayInvoice = await checkGatewayInvoice(
    config,
    { id: invoice.id, amount: invoice.baseAmount },
    invoice.gatewayReference,
  );
  if (gatewayInvoice.status === "paid" && gatewayInvoice.paid_at)
    return applyPayment(invoice.id, new Date(gatewayInvoice.paid_at));
  if (
    gatewayInvoice.status === "cancelled" ||
    gatewayInvoice.status === "failed"
  ) {
    // Terminal at the gateway: stop local checks without touching paid rows.
    await db.subscriptionInvoice.updateMany({
      where: { id: invoice.id, status: "pending" },
      data: { status: "failed", qrisCode: null, checkoutUrl: null },
    });
  }
  // "expired" stays pending locally: the gateway can still settle an on-time
  // payment that was verified late.
  return publicInvoice(
    await db.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    }),
  );
}
