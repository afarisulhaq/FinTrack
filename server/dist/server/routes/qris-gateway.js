import { Elysia, t } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { canUseDatabase, db } from "../prisma-client.js";
import { createSplitBillQrisInvoice, getQrisGatewaySettings, putQrisGatewaySettings, } from "../services/split-bill-qris.js";
import { BillingError } from "../services/subscription-gateway.js";
import { fail, ok } from "../utils.js";
function userId(request) {
    return verifyToken(extractToken(request.headers.get("authorization") ?? undefined) ?? "").sub;
}
export const qrisGatewayRoutes = new Elysia({ prefix: "/api" })
    .onBeforeHandle(async ({ request, set }) => {
    const auth = verifyToken(extractToken(request.headers.get("authorization") ?? undefined) ?? "");
    if (!auth) {
        set.status = 401;
        return fail("Unauthorized");
    }
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database QRIS belum tersedia");
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
    return fail(error instanceof BillingError
        ? error.message
        : "Layanan QRIS belum tersedia. Coba lagi nanti.");
})
    .get("/user/qris-gateway-settings", async ({ request }) => ok(await getQrisGatewaySettings(userId(request))))
    .put("/user/qris-gateway-settings", async ({ request, body }) => ok(await putQrisGatewaySettings(userId(request), body)), {
    body: t.Object({
        baseUrl: t.String({ minLength: 1, maxLength: 2048 }),
        environment: t.Union([
            t.Literal("sandbox"),
            t.Literal("production"),
        ]),
        provider: t.Optional(t.Nullable(t.Union([t.Literal("gopay"), t.Literal("shopeepay")]))),
        connectionId: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
        apiKey: t.Optional(t.String({ minLength: 16, maxLength: 200 })),
    }),
})
    .post("/split-bills/:id/participants/:participantId/qris-invoice", async ({ request, params }) => ok(await createSplitBillQrisInvoice(userId(request), params.id, params.participantId)), {
    params: t.Object({
        id: t.String({ minLength: 1, maxLength: 200 }),
        participantId: t.String({ minLength: 1, maxLength: 200 }),
    }),
    body: t.Object({}),
});
