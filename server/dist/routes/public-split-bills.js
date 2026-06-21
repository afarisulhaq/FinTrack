/**
 * Public split-bill routes.
 *
 * These endpoints do NOT require authentication. The URL itself
 * (`/api/public/split-bills/:billId/:participantToken`) is the credential:
 * the random `payToken` is generated per-participant when a bill is
 * created, so anyone with the link can view the bill context and toggle
 * the participant's paid status.
 *
 * Security notes:
 *  - Tokens are 16 bytes of crypto-random (132 bits) so they are not
 *    guessable.
 *  - The bill owner can revoke a link by deleting the bill.
 *  - We never expose other participants' payTokens or contact info in
 *    the public response — only the requesting participant's own slot.
 */
import { Elysia } from "elysia";
import { appConfig } from "../data.js";
import { canUseDatabase, db } from "../prisma-client.js";
import { fail, ok } from "../utils.js";
async function loadPublicBill(billId, token) {
    if (!(await canUseDatabase())) {
        return { error: "Database tidak tersedia", status: 503 };
    }
    const bill = await db.splitBill.findUnique({
        where: { id: billId },
        include: { participants: true },
    });
    if (!bill) {
        return { error: "Tagihan tidak ditemukan", status: 404 };
    }
    const me = (bill.participants ?? []).find((p) => p.payToken === token);
    if (!me) {
        // Don't reveal whether the bill exists vs. the token being wrong.
        return { error: "Link tidak valid atau sudah tidak berlaku", status: 404 };
    }
    // Look up the merchant's static QRIS so the pay page can render a QR
    // without requiring the participant to log in. The string is the
    // merchant's payment receiver, so it is inherently public.
    //
    // Fallback chain:
    //  1. AppSetting table (the canonical store when DB is configured).
    //  2. In-memory `appConfig` (used by the no-DB / dev-fallback path).
    //  3. undefined → pay page will show "QRIS belum tersedia".
    let staticQris;
    let appName;
    try {
        const setting = await db.appSetting.findFirst();
        staticQris = setting?.qrisStatic ?? undefined;
        appName = setting?.appName ?? undefined;
    }
    catch (e) {
        console.warn("[public-bill] appSetting read failed", e);
    }
    if (!staticQris) {
        const mem = appConfig.qrisStatic;
        if (mem)
            staticQris = mem;
    }
    if (!appName) {
        const mem = appConfig.appName;
        if (mem)
            appName = mem;
    }
    console.log(`[public-bill] bill=${billId} staticQris.length=${staticQris?.length ?? 0} appName=${appName ?? "<none>"}`);
    return {
        billId: bill.id,
        title: bill.title,
        description: bill.description ?? "",
        totalAmount: Number(bill.totalAmount),
        currency: bill.currency,
        paidBy: bill.paidBy,
        date: bill.date instanceof Date ? bill.date.toISOString() : bill.date,
        status: bill.status,
        appName: appName ?? "FinTrack",
        participant: {
            id: me.id,
            name: me.name,
            amount: Number(me.amount),
            paid: Boolean(me.paid),
            paidAt: me.paidAt
                ? me.paidAt instanceof Date
                    ? me.paidAt.toISOString()
                    : me.paidAt
                : undefined,
        },
        meta: {
            participantCount: (bill.participants ?? []).length,
            paidCount: (bill.participants ?? []).filter((p) => p.paid).length,
        },
        staticQris,
    };
}
export const publicSplitBillRoutes = new Elysia({
    prefix: "/api/public/split-bills",
})
    // Public read — anyone with the URL can view the bill context.
    .get("/:id/:token", async ({ params, set }) => {
    const result = await loadPublicBill(params.id, params.token);
    if ("error" in result) {
        set.status = result.status;
        return fail(result.error);
    }
    return ok(result);
})
    // Public toggle — anyone with the URL can mark THIS participant as paid
    // (or unmark). Idempotent.
    .put("/:id/:token/pay", async ({ params, body, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database tidak tersedia");
    }
    const bill = await db.splitBill.findUnique({
        where: { id: params.id },
        include: { participants: true },
    });
    if (!bill) {
        set.status = 404;
        return fail("Tagihan tidak ditemukan");
    }
    const me = (bill.participants ?? []).find((p) => p.payToken === params.token);
    if (!me) {
        set.status = 404;
        return fail("Link tidak valid atau sudah tidak berlaku");
    }
    const data = (body ?? {});
    const desired = data.paid !== false; // default = mark as paid
    const wasPaid = Boolean(me.paid);
    if (wasPaid === desired) {
        // No-op — return current state.
        return ok({
            participantId: me.id,
            paid: wasPaid,
            paidAt: me.paidAt
                ? me.paidAt instanceof Date
                    ? me.paidAt.toISOString()
                    : me.paidAt
                : undefined,
        });
    }
    const updated = await db.splitBillParticipant.update({
        where: { id: me.id },
        data: {
            paid: desired,
            paidAt: desired ? new Date() : null,
        },
    });
    // Auto-settle the bill when everyone has paid.
    const refreshed = await db.splitBill.findUnique({
        where: { id: bill.id },
        include: { participants: true },
    });
    if (refreshed) {
        const allPaid = refreshed.participants.length > 0 &&
            refreshed.participants.every((p) => p.paid);
        const anyUnpaid = refreshed.participants.some((p) => !p.paid);
        const newStatus = allPaid
            ? "settled"
            : anyUnpaid && refreshed.status === "settled"
                ? "active"
                : refreshed.status;
        if (newStatus !== refreshed.status) {
            await db.splitBill.update({
                where: { id: refreshed.id },
                data: { status: newStatus },
            });
        }
    }
    return ok({
        participantId: updated.id,
        paid: Boolean(updated.paid),
        paidAt: updated.paidAt
            ? updated.paidAt instanceof Date
                ? updated.paidAt.toISOString()
                : updated.paidAt
            : undefined,
    });
});
