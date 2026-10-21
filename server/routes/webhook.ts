import { Elysia } from "elysia";
import { fail } from "../utils.js";
import { canUseDatabase, db } from "../prisma-client.js";
import {
  BillingError,
  billingConfig,
  invoiceIdFromExternalId,
  webhookEventSchema,
  webhookSecrets,
  verifyWebhookSignature,
  type WebhookEvent,
} from "../services/subscription-gateway.js";
import { applyPayment } from "../services/subscriptions.js";

// Public receiver for the QRIS Gateway webhook (docs/integrasi-website.md
// section 6). Reachable in production through the Next.js /api/* rewrite at
// https://<domain>/api/webhooks/qris. Authentication is HMAC over the raw
// body, not a browser session, so no auth middleware may be added here.
export const webhookRoutes = new Elysia({ prefix: "/api/webhooks" }).post(
  "/qris",
  async ({ request, set }) => {
    try {
      if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database pembayaran belum tersedia");
      }
      if (!webhookSecrets().length) {
        set.status = 503;
        return fail("Webhook QRIS belum dikonfigurasi");
      }
      const raw = Buffer.from(await request.arrayBuffer());
      if (
        !verifyWebhookSignature(
          raw,
          request.headers.get("X-QRIS-Signature") ?? "",
        )
      ) {
        set.status = 401;
        return fail("Signature tidak valid");
      }
      let event: WebhookEvent;
      try {
        event = webhookEventSchema.parse(JSON.parse(raw.toString("utf8")));
      } catch {
        set.status = 400;
        return fail("Event tidak valid");
      }
      const config = billingConfig();
      if (!config) {
        set.status = 503;
        return fail("Pembayaran langganan belum tersedia");
      }
      if (
        event.id !== request.headers.get("X-QRIS-Event-Id") ||
        event.data.environment !== request.headers.get("X-QRIS-Environment") ||
        event.data.environment !== config.environment ||
        !["paid", "expired", "cancelled", "failed"].includes(
          event.data.status,
        ) ||
        event.event !== `invoice.${event.data.status}`
      ) {
        set.status = 400;
        return fail("Event tidak valid atau environment berbeda");
      }
      const invoiceId = invoiceIdFromExternalId(config, event.data.external_id);
      const row = invoiceId
        ? await db.subscriptionInvoice.findUnique({ where: { id: invoiceId } })
        : null;
      if (
        !row ||
        row.gatewayAccount !== config.account ||
        (row.gatewayReference !== null &&
          row.gatewayReference !== event.data.id) ||
        event.data.amount !== row.baseAmount ||
        event.data.payable_amount < row.baseAmount ||
        event.data.payable_amount > row.baseAmount + 99 ||
        event.data.connection_id !== config.connectionId ||
        (config.provider !== null && event.data.provider !== config.provider)
      ) {
        set.status = 409;
        return fail("Invoice tidak cocok dengan pesanan");
      }
      if (event.data.status === "paid") {
        if (!event.data.paid_at) {
          set.status = 400;
          return fail("Event tidak valid");
        }
        // Replays land here too: applyPayment returns early once paid, so a
        // repeated invoice.paid event never activates the plan twice.
        await applyPayment(row.id, new Date(event.data.paid_at));
      } else if (event.data.status !== "expired") {
        // "expired" stays derived from local time so invoice.expired followed
        // by a late invoice.paid can still activate an on-time payment.
        await db.subscriptionInvoice.updateMany({
          where: { id: row.id, status: "pending" },
          data: { status: "failed", qrisCode: null, checkoutUrl: null },
        });
      }
      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof BillingError) {
        set.status = error.status;
        return fail(error.message);
      }
      throw error;
    }
  },
);
