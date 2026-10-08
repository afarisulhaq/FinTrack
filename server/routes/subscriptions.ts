import { Elysia, t } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { canUseDatabase, db } from "../prisma-client.js";
import { fail, ok } from "../utils.js";
import { BillingError } from "../services/subscription-gateway.js";
import {
  billingOverview,
  createInvoice,
  verifyInvoice,
} from "../services/subscriptions.js";

function userId(request: Request) {
  return verifyToken(
    extractToken(request.headers.get("authorization") ?? undefined) ?? "",
  )!.sub;
}

export const subscriptionRoutes = new Elysia({ prefix: "/api/subscriptions" })
  .onBeforeHandle(async ({ request, set }) => {
    const auth = verifyToken(
      extractToken(request.headers.get("authorization") ?? undefined) ?? "",
    );
    if (!auth) {
      set.status = 401;
      return fail("Unauthorized");
    }
    if (!(await canUseDatabase())) {
      set.status = 503;
      return fail("Database pembayaran belum tersedia");
    }
    const user = await db.user.findUnique({
      where: { id: auth.sub },
      select: { status: true },
    });
    if (user?.status !== "active") {
      set.status = 403;
      return fail("Akun belum aktif");
    }
  })
  .onError(({ error, set }) => {
    set.status = error instanceof BillingError ? error.status : 503;
    return fail(
      error instanceof BillingError
        ? error.message
        : "Layanan langganan belum tersedia. Coba lagi nanti.",
    );
  })
  .get("/", async ({ request }) => ok(await billingOverview(userId(request))))
  .post(
    "/invoices",
    async ({ request }) => ok(await createInvoice(userId(request))),
    { body: t.Object({}) },
  )
  .post(
    "/invoices/:id/check",
    async ({ request, params }) =>
      ok(await verifyInvoice(userId(request), params.id)),
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 100 }) }),
      body: t.Object({}),
    },
  );
