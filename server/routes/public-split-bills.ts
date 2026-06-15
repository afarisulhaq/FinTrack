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
import { db } from "../prisma-client.js";
import { fail, ok } from "../utils.js";

interface PublicBillData {
  /** The bill ID (useful for deep links). */
  billId: string;
  /** Bill title, e.g. "Makan Siang". */
  title: string;
  /** Optional description / notes. */
  description: string;
  /** Total amount for the whole bill. */
  totalAmount: number;
  /** ISO currency code (e.g. "IDR"). */
  currency: string;
  /** Person who originally paid. */
  paidBy: string;
  /** ISO date string of the bill. */
  date: string;
  /** "active" | "settled" | "cancelled". */
  status: string;
  /**
   * Brand name configured by the bill owner in admin Pengaturan App.
   * Exposed on this public endpoint (it's a label, not user data) so
   * the unauthenticated pay page can render the same brand as the
   * in-app sidebar/login page without needing to know about
   * useAppConfigStore.
   */
  appName: string;
  /** This participant's slot. */
  participant: {
    id: string;
    name: string;
    amount: number;
    paid: boolean;
    paidAt?: string;
  };
  /** Per-participant counts (for context, not data). */
  meta: {
    participantCount: number;
    paidCount: number;
  };
  /**
   * The merchant's static QRIS string. Exposed here so the public pay
   * page can render a per-participant dynamic QR code without requiring
   * the participant to log in. This is the same string the merchant
   * pasted into Settings; it is by design shareable (the participant
   * needs it to be able to pay).
   */
  staticQris?: string;
}

async function loadPublicBill(
  billId: string,
  token: string,
): Promise<PublicBillData | { error: string; status: number }> {
  const bill = await (db as any).splitBill.findUnique({
    where: { id: billId },
    include: { participants: true },
  });

  if (!bill) {
    return { error: "Tagihan tidak ditemukan", status: 404 };
  }

  const me = (bill.participants ?? []).find((p: any) => p.payToken === token);
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
  let staticQris: string | undefined;
  let appName: string | undefined;
  try {
    const setting = await db.appSetting.findFirst();
    staticQris = setting?.qrisStatic ?? undefined;
    appName = setting?.appName ?? undefined;
  } catch (e) {
    console.warn("[public-bill] appSetting read failed", e);
  }
  if (!staticQris) {
    const mem = (appConfig as { qrisStatic?: string | null }).qrisStatic;
    if (mem) staticQris = mem;
  }
  if (!appName) {
    const mem = (appConfig as { appName?: string | null }).appName;
    if (mem) appName = mem;
  }
  console.log(
    `[public-bill] bill=${billId} staticQris.length=${staticQris?.length ?? 0} appName=${appName ?? "<none>"}`,
  );

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
      paidCount: (bill.participants ?? []).filter((p: any) => p.paid).length,
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
    const bill = await (db as any).splitBill.findUnique({
      where: { id: params.id },
      include: { participants: true },
    });
    if (!bill) {
      set.status = 404;
      return fail("Tagihan tidak ditemukan");
    }
    const me = (bill.participants ?? []).find(
      (p: any) => p.payToken === params.token,
    );
    if (!me) {
      set.status = 404;
      return fail("Link tidak valid atau sudah tidak berlaku");
    }

    const data = (body ?? {}) as { paid?: boolean };
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

    const updated = await (db as any).splitBillParticipant.update({
      where: { id: me.id },
      data: {
        paid: desired,
        paidAt: desired ? new Date() : null,
      },
    });

    // Auto-settle the bill when everyone has paid.
    const refreshed = await (db as any).splitBill.findUnique({
      where: { id: bill.id },
      include: { participants: true },
    });
    if (refreshed) {
      const allPaid =
        refreshed.participants.length > 0 &&
        refreshed.participants.every((p: any) => p.paid);
      const anyUnpaid = refreshed.participants.some((p: any) => !p.paid);
      const newStatus = allPaid
        ? "settled"
        : anyUnpaid && refreshed.status === "settled"
          ? "active"
          : refreshed.status;
      if (newStatus !== refreshed.status) {
        await (db as any).splitBill.update({
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
