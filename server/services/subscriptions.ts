import type { SubscriptionInvoice } from "@prisma/client";
import { db } from "../prisma-client.js";
import {
  BillingError,
  billingConfig,
  createGatewayQr,
  checkGatewayPayment,
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
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
  };
}

export async function billingOverview(userId: string) {
  const config = billingConfig();
  const [subscription, invoices] = await Promise.all([
    db.subscription.findUnique({ where: { userId } }),
    db.subscriptionInvoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
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
    invoices: invoices.map(publicInvoice),
  };
}

export async function createInvoice(userId: string) {
  const config = billingConfig();
  if (!config)
    throw new BillingError("Pembayaran langganan belum tersedia", 503);
  const reservation = await db.$transaction(async (tx) => {
    // Serialize reservations across users; amount matching has no provider invoice reference.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904)::text`;
    const existing = await tx.subscriptionInvoice.findFirst({
      where: {
        userId,
        status: { in: ["creating", "pending"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { row: existing, fresh: false };
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
    const used = await tx.subscriptionInvoice.findMany({
      where: { amount: { gt: config.price, lte: config.price + 999 } },
      select: { amount: true },
    });
    const amounts = new Set(used.map((row) => row.amount));
    let amount = config.price + 1;
    while (amounts.has(amount)) amount++;
    // Never recycle an amount: an old QR can still receive a late payment after local expiry.
    if (amount > config.price + 999)
      throw new BillingError(
        "Nominal unik habis. Pengelola perlu meninjau konfigurasi pembayaran.",
        503,
      );
    const row = await tx.subscriptionInvoice.create({
      data: {
        userId,
        plan: config.plan,
        planName: config.name,
        baseAmount: config.price,
        amount,
        durationDays: config.days,
        gatewayAccount: config.account,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    return { row, fresh: true };
  });
  if (!reservation.fresh) return publicInvoice(reservation.row);
  try {
    const qr = await createGatewayQr(config, reservation.row.amount);
    const expiresAt = new Date(
      Math.min(reservation.row.expiresAt.getTime(), Date.parse(qr.expires_at)),
    );
    if (expiresAt <= new Date())
      throw new BillingError("QRIS dari gateway sudah kedaluwarsa", 502);
    return publicInvoice(
      await db.subscriptionInvoice.update({
        where: { id: reservation.row.id },
        data: {
          qrisCode: qr.qris_code,
          gatewayReference: qr.trx_id,
          expiresAt,
          status: "pending",
        },
      }),
    );
  } catch (error) {
    await db.subscriptionInvoice.update({
      where: { id: reservation.row.id },
      data: { status: "failed" },
    });
    throw error;
  }
}

export async function applyPayment(
  invoiceId: string,
  transactionId: string,
  paidAt: Date,
) {
  return db.$transaction(async (tx) => {
    // Serialize renewal and duplicate checks, including concurrent invoices for the same account.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731904)::text`;
    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    if (invoice.status === "paid") return publicInvoice(invoice);
    if (
      invoice.status !== "pending" ||
      !transactionId ||
      !Number.isFinite(paidAt.getTime()) ||
      paidAt < invoice.createdAt ||
      paidAt > invoice.expiresAt ||
      paidAt > new Date()
    ) {
      throw new BillingError("Pembayaran tidak cocok dengan invoice", 409);
    }
    const claimed = await tx.subscriptionInvoice.findUnique({
      where: { providerTransactionId: transactionId },
    });
    if (claimed)
      throw new BillingError("Transaksi pembayaran sudah digunakan", 409);
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
        data: { status: "paid", providerTransactionId: transactionId, paidAt },
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
  const payment = await checkGatewayPayment(config, invoice);
  if (!payment) return publicInvoice(invoice);
  return applyPayment(
    invoice.id,
    payment.transaction_id,
    new Date(payment.time),
  );
}
