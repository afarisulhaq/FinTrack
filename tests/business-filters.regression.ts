import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client";
import { businessRoutes } from "../server/routes/business";
import { signToken } from "../server/auth";

const rows = [
  {
    id: "sale",
    businessId: "business",
    type: "income",
    amount: 150000,
    description: "Pesanan Kopi",
    date: new Date(),
    wallet: { name: "Kas usaha" },
  },
  {
    id: "supplies",
    businessId: "business",
    type: "expense",
    amount: 50000,
    description: "Bahan kopi",
    date: new Date(),
    wallet: null,
  },
  {
    id: "rent",
    businessId: "business",
    type: "expense",
    amount: 25000,
    description: "Sewa tempat",
    date: new Date(),
    wallet: null,
  },
];
let lastWhere: any;
const filter = (where: any) =>
  rows.filter(
    (row) =>
      row.businessId === where.businessId &&
      (!where.type || row.type === where.type) &&
      (!where.description ||
        row.description
          .toLowerCase()
          .includes(where.description.contains.toLowerCase())),
  );
process.env.DATABASE_URL = "postgresql://mock/test";
(db as any).$queryRaw = async () => [{ ok: 1 }];
(db as any).business.findFirst = async ({ where }: any) =>
  where.id === "business" && where.userId === "owner"
    ? { id: "business" }
    : null;
(db as any).businessTransaction.count = async ({ where }: any) =>
  filter(where).length;
(db as any).businessTransaction.findMany = async ({
  where,
  skip,
  take,
}: any) => {
  lastWhere = where;
  return filter(where).slice(skip, skip + take);
};
(db as any).businessTransaction.groupBy = async ({ where }: any) =>
  ["income", "expense"].map((type) => ({
    type,
    _sum: {
      amount: filter(where)
        .filter((row) => row.type === type)
        .reduce((sum, row) => sum + row.amount, 0),
    },
    _count: filter(where).filter((row) => row.type === type).length,
  }));
const app = new Elysia().use(businessRoutes);
const token = (sub: string) =>
  signToken({ sub, email: "test@example.invalid", role: "owner" });
async function get(query = "", owner = "owner") {
  const response = await app.handle(
    new Request(
      `http://localhost/api/businesses/business/transactions${query}`,
      { headers: { Authorization: `Bearer ${token(owner)}` } },
    ),
  );
  return { status: response.status, json: await response.json() };
}
const all = await get();
assert.equal(all.status, 200);
assert.equal(all.json.data.total, 3);
const income = await get("?type=income");
assert.equal(income.json.data.total, 1);
assert.equal(income.json.data.items[0].id, "sale");
assert.deepEqual(
  income.json.data.summary,
  all.json.data.summary,
  "filtering must not turn the business-wide summary into a partial total",
);
const searched = await get("?type=expense&search=KOPI");
assert.equal(searched.json.data.total, 1);
assert.equal(searched.json.data.items[0].id, "supplies");
assert.equal(lastWhere.description.mode, "insensitive");
assert.equal(lastWhere.businessId, "business");
assert.equal((await get("?search=missing")).json.data.total, 0);
assert.equal((await get("?type=transfer")).status, 400);
assert.equal((await get("", "other")).status, 404);
console.log(
  "PASS: business entry search, case-insensitive matching, type filter, empty results, whole-business summary, invalid types and ownership",
);
