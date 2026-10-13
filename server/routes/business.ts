import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { db, canUseDatabase } from "../prisma-client.js";
import { extractToken, verifyToken, type AuthPayload } from "../auth.js";
import { ok, fail } from "../utils.js";
import { databasePage, readPage } from "../services/pagination.js";

async function businessTotals(businessId: string) {
  const groups = await db.businessTransaction.groupBy({
    by: ["type"], where: { businessId }, _sum: { amount: true }, _count: true,
  });
  const income = Number(groups.find((row) => row.type === "income")?._sum.amount ?? 0);
  const expense = Number(groups.find((row) => row.type === "expense")?._sum.amount ?? 0);
  return { income, expense, difference: income - expense,
    returnPercent: expense > 0 ? ((income - expense) / expense) * 100 : null,
    transactionCount: groups.reduce((total, row) => total + row._count, 0) };
}

const businessBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  description: t.String({ maxLength: 1000 }),
});
const transactionBody = t.Object({
  type: t.Union([t.Literal("income"), t.Literal("expense")]),
  amount: t.Number({ minimum: 0.01, maximum: 1e12 }),
  description: t.String({ minLength: 1, maxLength: 1000 }),
  date: t.String({ format: "date-time" }),
  walletId: t.Union([t.String({ minLength: 1 }), t.Null()]),
});
const params = t.Object({ businessId: t.String() });
const entryParams = t.Object({ businessId: t.String(), entryId: t.String() });

function authUser(request: Request) {
  return verifyToken(
    extractToken(request.headers.get("authorization") ?? undefined) ?? "",
  )!;
}

function delta(entry: { type: string; amount: Prisma.Decimal }) {
  return entry.type === "income" ? entry.amount : entry.amount.negated();
}

async function writeEntry(
  auth: AuthPayload,
  businessId: string,
  entryId: string | undefined,
  body: typeof transactionBody.static | undefined,
) {
  if (body && new Prisma.Decimal(body.amount).decimalPlaces() > 2) {
    throw new Error("Nominal maksimal dua angka desimal");
  }
  return db.$transaction(
    async (tx) => {
      const business = await tx.business.findFirst({
        where: { id: businessId, userId: auth.sub },
      });
      if (!business) throw new Error("Bisnis tidak ditemukan");
      const old = entryId
        ? await tx.businessTransaction.findFirst({
            where: { id: entryId, businessId },
          })
        : null;
      if (entryId && !old) throw new Error("Transaksi tidak ditemukan");
      if (body?.walletId) {
        const wallet = await tx.wallet.findFirst({
          where: {
            id: body.walletId,
            ...(auth.role === "admin" ? {} : { userId: auth.sub }),
          },
        });
        if (!wallet) throw new Error("Dompet tidak ditemukan");
      }
      if (body && !body.description.trim())
        throw new Error("Keterangan wajib diisi");
      if (old?.walletId) {
        await tx.wallet.update({
          where: { id: old.walletId },
          data: { balance: { decrement: delta(old) } },
        });
      }
      if (!body) {
        await tx.businessTransaction.delete({ where: { id: entryId! } });
        return { id: entryId };
      }
      const data = {
        ...body,
        description: body.description.trim(),
        date: new Date(body.date),
      };
      const saved = entryId
        ? await tx.businessTransaction.update({ where: { id: entryId }, data })
        : await tx.businessTransaction.create({
            data: { ...data, businessId },
          });
      if (saved.walletId) {
        await tx.wallet.update({
          where: { id: saved.walletId },
          data: { balance: { increment: delta(saved) } },
        });
      }
      return { ...saved, amount: Number(saved.amount) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export const businessRoutes = new Elysia({ prefix: "/api/businesses" })
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
      return fail("Database tidak tersedia; data bisnis belum tersimpan");
    }
  })
  .onError(({ error, code, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return fail("Periksa nama, nominal, tanggal, dan keterangan transaksi");
    }
    set.status = 400;
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan data bisnis";
    return fail(
      [
        "Bisnis tidak ditemukan",
        "Transaksi tidak ditemukan",
        "Dompet tidak ditemukan",
        "Keterangan wajib diisi",
        "Nominal maksimal dua angka desimal",
      ].includes(message)
        ? message
        : "Gagal memproses data bisnis. Silakan coba lagi.",
    );
  })
  .get("/", async ({ request, query }) => {
    const where = { userId: authUser(request).sub };
    const page = await databasePage(readPage(query),
      () => db.business.count({ where }),
      (skip, take) => db.business.findMany({
        where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }));
    return ok({ ...page, items: await Promise.all(page.items.map(async (row) => ({
      ...row, summary: await businessTotals(row.id),
    }))) });
  })
  .get("/:businessId", async ({ request, params, set }) => {
    const row = await db.business.findFirst({
      where: { id: params.businessId, userId: authUser(request).sub },
    });
    if (!row) { set.status = 404; return fail("Bisnis tidak ditemukan"); }
    return ok({ ...row, summary: await businessTotals(row.id) });
  }, { params })
  .get("/:businessId/transactions", async ({ request, params, query, set }) => {
    const business = await db.business.findFirst({
      where: { id: params.businessId, userId: authUser(request).sub }, select: { id: true },
    });
    if (!business) { set.status = 404; return fail("Bisnis tidak ditemukan"); }
    const where = { businessId: business.id };
    const page = await databasePage(readPage(query),
      () => db.businessTransaction.count({ where }),
      (skip, take) => db.businessTransaction.findMany({
        where, skip, take, orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: { wallet: { select: { name: true } } },
      }));
    return ok({ ...page, summary: await businessTotals(business.id),
      items: page.items.map(({ wallet, ...entry }) => ({
        ...entry, amount: Number(entry.amount), walletName: wallet?.name ?? null,
      })) });
  }, { params })
  .post(
    "/",
    async ({ request, body, set }) => {
      if (!body.name.trim()) {
        set.status = 400;
        return fail("Nama bisnis wajib diisi");
      }
      const saved = await db.business.create({
        data: {
          ...body,
          name: body.name.trim(),
          userId: authUser(request).sub,
        },
      });
      set.status = 201;
      return ok({ ...saved, summary: { income: 0, expense: 0, difference: 0, returnPercent: null, transactionCount: 0 } });
    },
    { body: businessBody },
  )
  .put(
    "/:businessId",
    async ({ request, params, body, set }) => {
      if (!body.name.trim()) {
        set.status = 400;
        return fail("Nama bisnis wajib diisi");
      }
      const result = await db.business.updateMany({
        where: { id: params.businessId, userId: authUser(request).sub },
        data: { ...body, name: body.name.trim() },
      });
      if (!result.count) {
        set.status = 404;
        return fail("Bisnis tidak ditemukan");
      }
      return ok({ id: params.businessId });
    },
    { params, body: businessBody },
  )
  .delete(
    "/:businessId",
    async ({ request, params, set }) => {
      const business = await db.business.findFirst({
        where: { id: params.businessId, userId: authUser(request).sub },
        include: { _count: { select: { transactions: true } } },
      });
      if (!business) {
        set.status = 404;
        return fail("Bisnis tidak ditemukan");
      }
      if (business._count.transactions) {
        set.status = 409;
        return fail(
          "Hapus transaksi bisnis terlebih dahulu agar saldo dompet dikembalikan",
        );
      }
      await db.business.delete({ where: { id: business.id } });
      return ok({ id: business.id });
    },
    { params },
  )
  .post(
    "/:businessId/transactions",
    async ({ request, params, body, set }) => {
      const saved = await writeEntry(
        authUser(request),
        params.businessId,
        undefined,
        body,
      );
      set.status = 201;
      return ok(saved);
    },
    { params, body: transactionBody },
  )
  .put(
    "/:businessId/transactions/:entryId",
    async ({ request, params, body }) =>
      ok(
        await writeEntry(
          authUser(request),
          params.businessId,
          params.entryId,
          body,
        ),
      ),
    { params: entryParams, body: transactionBody },
  )
  .delete(
    "/:businessId/transactions/:entryId",
    async ({ request, params }) =>
      ok(
        await writeEntry(
          authUser(request),
          params.businessId,
          params.entryId,
          undefined,
        ),
      ),
    { params: entryParams },
  );
