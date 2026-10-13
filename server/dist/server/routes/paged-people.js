import { Elysia, t } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { db as prisma, canUseDatabase, isDatabaseConfigured } from "../prisma-client.js";
import { db as memory } from "../data.js";
import { fail, ok, id } from "../utils.js";
import { lockFinanceRecord, reconcileWalletEffects, resourceWalletUpdate, readWalletEffects } from "../services/wallet-effects.js";
import { ownership } from "../services/pagination.js";
const installmentBody = t.Object({ amount: t.Number({ exclusiveMinimum: 0 }), date: t.String({ format: "date-time" }), note: t.Optional(t.String()), walletId: t.String({ minLength: 1 }) });
function isInstallment(row) {
    return row !== null && typeof row === "object" && !Array.isArray(row)
        && typeof row.id === "string" && typeof row.amount === "number" && Number.isFinite(row.amount)
        && typeof row.date === "string"
        && (row.note === undefined || typeof row.note === "string")
        && (row.walletId === undefined || typeof row.walletId === "string");
}
function readInstallments(value) {
    if (!Array.isArray(value) || !value.every(isInstallment))
        throw new Error("Catatan cicilan tidak valid");
    return value;
}
function updateInstallments(installments, paidAmount, installmentId, body) {
    const previous = installmentId ? installments.find((row) => row.id === installmentId) : undefined;
    if (installmentId && !previous)
        throw new Error("Cicilan tidak ditemukan");
    const installment = body ? { ...previous, ...body, id: installmentId ?? id("installment") } : undefined;
    const next = installmentId ? installments.flatMap((row) => row.id !== installmentId ? [row] : installment ? [installment] : []) : [...installments, installment];
    const nextPaid = body ? paidAmount - (previous?.amount ?? 0) + body.amount : Math.max(0, paidAmount - previous.amount);
    return { next, nextPaid, installment };
}
async function mutate(scope, debtId, installmentId, body) {
    if (await canUseDatabase())
        return prisma.$transaction(async (client) => {
            await lockFinanceRecord(client, "debts", debtId);
            const debt = await client.debt.findFirst({ where: { ...ownership(scope), id: debtId } });
            if (!debt)
                throw new Error("Utang tidak ditemukan");
            const { next, nextPaid, installment } = updateInstallments(readInstallments(debt.installments), Number(debt.paidAmount), installmentId, body);
            const isSettled = nextPaid >= Number(debt.amount);
            const prepared = resourceWalletUpdate("debts", debt, { installments: next, paidAmount: nextPaid, isSettled });
            const effects = readWalletEffects(prepared.walletEffects);
            await reconcileWalletEffects(client, debt.walletEffects, effects, debt.userId);
            await client.debt.update({ where: { id: debt.id }, data: { installments: next, paidAmount: nextPaid, isSettled, walletEffects: effects } });
            return { id: debt.id, paidAmount: nextPaid, isSettled, installmentCount: next.length, installment };
        });
    if (isDatabaseConfigured())
        throw Object.assign(new Error("Database belum tersedia"), { status: 503 });
    const debts = memory.debts;
    const debt = debts.find((row) => row.id === debtId && (row.userId ? !scope.userId || row.userId === scope.userId : scope.authId === "usr-demo-001"));
    if (!debt)
        throw new Error("Utang tidak ditemukan");
    const { next, nextPaid, installment } = updateInstallments(debt.installments, debt.paidAmount, installmentId, body);
    const isSettled = nextPaid >= debt.amount;
    const prepared = resourceWalletUpdate("debts", debt, { installments: next, paidAmount: nextPaid, isSettled });
    const deltas = new Map();
    for (const effect of readWalletEffects(debt.walletEffects))
        deltas.set(effect.walletId, (deltas.get(effect.walletId) ?? 0) - effect.amount);
    for (const effect of readWalletEffects(prepared.walletEffects))
        deltas.set(effect.walletId, (deltas.get(effect.walletId) ?? 0) + effect.amount);
    const wallets = memory.wallets.flatMap((wallet) => [wallet, ...("children" in wallet ? wallet.children ?? [] : [])]);
    for (const walletId of deltas.keys()) {
        const wallet = wallets.find((row) => row.id === walletId);
        if (!wallet || wallet.currency !== "IDR")
            throw new Error("Dompet pembayaran tidak tersedia");
        const walletOwner = "userId" in wallet && typeof wallet.userId === "string" ? wallet.userId : undefined;
        if (walletOwner ? walletOwner !== debt.userId : scope.authId !== "usr-demo-001")
            throw new Error("Dompet pembayaran tidak tersedia");
    }
    for (const [walletId, delta] of deltas)
        wallets.find((row) => row.id === walletId).balance += delta;
    Object.assign(debt, prepared);
    return { id: debt.id, paidAmount: nextPaid, isSettled, installmentCount: next.length, installment };
}
async function handle(request, debtId, installmentId, body) {
    const auth = verifyToken(extractToken(request.headers.get("authorization") ?? undefined) ?? "");
    if (!auth)
        return { status: 401, value: fail("Unauthorized") };
    try {
        return { status: 200, value: ok(await mutate({ userId: auth.role === "admin" ? null : auth.sub, authId: auth.sub }, debtId, installmentId, body)) };
    }
    catch (error) {
        const status = error instanceof Error && "status" in error && error.status === 503 ? 503 : 400;
        return { status, value: fail(error instanceof Error ? error.message : "Gagal menyimpan cicilan") };
    }
}
export const pagedPeopleRoutes = new Elysia({ prefix: "/api" })
    .post("/debts/:id/installments", async ({ request, params, body, set }) => {
    const result = await handle(request, params.id, undefined, body);
    set.status = result.status;
    return result.value;
}, { body: installmentBody })
    .put("/debts/:id/installments/:installmentId", async ({ request, params, body, set }) => {
    const result = await handle(request, params.id, params.installmentId, body);
    set.status = result.status;
    return result.value;
}, { body: installmentBody })
    .delete("/debts/:id/installments/:installmentId", async ({ request, params, set }) => {
    const result = await handle(request, params.id, params.installmentId);
    set.status = result.status;
    return result.value;
});
