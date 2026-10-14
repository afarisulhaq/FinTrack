import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client";
import { signToken } from "../server/auth";
import { resourceRoutes } from "../server/routes/finance";

let wallets = new Map<string, any>([
  [
    "rdn",
    { id: "rdn", name: "RDN", balance: 0, currency: "IDR", userId: "owner" },
  ],
  [
    "ajaib",
    {
      id: "ajaib",
      name: "Ajaib",
      parentId: "rdn",
      balance: 1_000_000,
      currency: "IDR",
      userId: "owner",
    },
  ],
  [
    "stockbit",
    {
      id: "stockbit",
      name: "Stockbit",
      parentId: "rdn",
      balance: 1_000_000,
      currency: "IDR",
      userId: "owner",
    },
  ],
  [
    "legacy",
    {
      id: "legacy",
      name: "Legacy",
      balance: 1_000_000,
      currency: "IDR",
      userId: null,
    },
  ],
  [
    "foreign",
    { id: "foreign", balance: 1_000_000, currency: "IDR", userId: "other" },
  ],
  ["usd", { id: "usd", balance: 1_000_000, currency: "USD", userId: "owner" }],
]);
let rows = new Map<string, any>();
let rejectWrite = false;
const matches = (row: any, where: any) =>
  Object.entries(where).every(([key, value]) =>
    typeof value === "object" && value !== null
      ? row[key] > (value as any).gt
      : row[key] === value,
  );
const client = {
  $queryRawUnsafe: async () => [],
  wallet: {
    findFirst: async ({ where }: any) =>
      [...wallets.values()].find((row) => matches(row, where)) ?? null,
    update: async ({ where, data }: any) => {
      const row = wallets.get(where.id)!;
      row.balance += data.balance.increment;
      return row;
    },
  },
  investment: {
    findFirst: async ({ where }: any) =>
      [...rows.values()].find((row) => matches(row, where)) ?? null,
    create: async ({ data }: any) => {
      if (rejectWrite) throw new Error("Simulated database write failure");
      const row = { ...data, id: data.id ?? `position-${rows.size}` };
      rows.set(row.id, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      if (rejectWrite) throw new Error("Simulated database write failure");
      const row = { ...rows.get(where.id), ...data };
      rows.set(row.id, row);
      return row;
    },
    delete: async ({ where }: any) => rows.delete(where.id),
  },
};
process.env.DATABASE_URL = "postgresql://mock/test";
(db as any).$queryRaw = async () => [{ ok: 1 }];
(db as any).$transaction = async (fn: any) => {
  const oldWallets = structuredClone(wallets);
  const oldRows = structuredClone(rows);
  try {
    return await fn(client);
  } catch (error) {
    wallets = oldWallets;
    rows = oldRows;
    throw error;
  }
};
const app = new Elysia().use(resourceRoutes);
const owner = signToken({
  sub: "owner",
  email: "owner@example.invalid",
  role: "owner",
});
const admin = signToken({
  sub: "admin",
  email: "admin@example.invalid",
  role: "admin",
});
async function request(
  method: string,
  path: string,
  body?: unknown,
  token = owner,
) {
  const response = await app.handle(
    new Request(`http://localhost/api/investments${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return { status: response.status, body: await response.json() };
}
function ok(result: any) {
  assert.ok(
    result.status >= 200 && result.status < 300,
    JSON.stringify(result),
  );
  return result.body.data;
}
const buy = {
  id: "buy",
  name: "BBCA",
  symbol: "BBCA.JK",
  assetClass: "stock",
  broker: "Ajaib",
  quantity: 100,
  avgBuyPrice: 1000,
  currentPrice: 1100,
  buyFee: 100,
  walletId: "ajaib",
};
let position = ok(await request("POST", "", buy));
assert.equal(position.walletId, "ajaib");
assert.equal(
  wallets.get("ajaib").balance,
  899900,
  "one lot debits 100 shares plus fee",
);
assert.equal(
  wallets.get("rdn").balance,
  0,
  "parent balance is not also debited",
);
position = ok(
  await request("POST", "", {
    ...buy,
    id: "add",
    quantity: 100,
    avgBuyPrice: 2000,
    buyFee: 200,
  }),
);
assert.equal(position.id, "buy");
assert.equal(position.quantity, 200);
assert.equal(position.avgBuyPrice, 1500);
assert.equal(wallets.get("ajaib").balance, 699700);
const other = ok(
  await request("POST", "", {
    ...buy,
    id: "other-pocket",
    walletId: "stockbit",
  }),
);
assert.notEqual(
  other.id,
  position.id,
  "different funding wallets must retain separate relations",
);
assert.equal(wallets.get("stockbit").balance, 899900);
ok(await request("PUT", "/buy", { currentPrice: 2500 }));
assert.equal(
  wallets.get("ajaib").balance,
  699700,
  "market price refresh has no cash effect",
);
position = ok(
  await request("PUT", "/buy", {
    sellPrice: 2500,
    sellQuantity: 50,
    sellFee: 50,
    sellWalletId: "stockbit",
    quantity: 9999,
    soldQuantity: 9999,
  }),
);
assert.equal(position.quantity, 150, "sell quantities are server controlled");
assert.equal(position.soldQuantity, 50);
assert.equal(wallets.get("stockbit").balance, 1024850);
position = ok(
  await request("PUT", "/buy", {
    sellPrice: 3000,
    sellQuantity: 150,
    sellFee: 100,
  }),
);
assert.equal(position.quantity, 0);
assert.equal(wallets.get("ajaib").balance, 1149600);
ok(
  await request("PUT", "/buy", {
    sellPrice: null,
    soldAt: null,
    sellFee: null,
  }),
);
assert.equal(rows.get("buy").quantity, 200);
assert.equal(wallets.get("ajaib").balance, 699700);
assert.equal(
  wallets.get("stockbit").balance,
  899900,
  "undo reverses every recorded sale to its actual wallet",
);
ok(await request("PUT", "/buy", { avgBuyPrice: 1600 }));
assert.equal(wallets.get("ajaib").balance, 679700);
ok(await request("DELETE", "/buy"));
assert.equal(
  wallets.get("ajaib").balance,
  1000000,
  "delete reverses the recorded purchase after corrections",
);
for (const walletId of ["missing", "foreign", "legacy", "usd"])
  assert.equal((await request("POST", "", { ...buy, walletId })).status, 400);
for (const body of [
  { quantity: -1 },
  { quantity: "NaN" },
  { buyFee: -1 },
  { avgBuyPrice: 0 },
])
  assert.equal((await request("POST", "", { ...buy, ...body })).status, 400);
const before = wallets.get("stockbit").balance;
for (const body of [
  { sellPrice: 2000, sellQuantity: 101 },
  { sellPrice: 2000, sellQuantity: "NaN" },
  { sellPrice: 2000, sellQuantity: 1, sellFee: 3000 },
  { sellPrice: 2000, sellQuantity: 1, sellWalletId: "foreign" },
]) {
  assert.equal((await request("PUT", "/other-pocket", body)).status, 404);
  assert.equal(wallets.get("stockbit").balance, before);
}
rejectWrite = true;
assert.equal(
  (await request("POST", "", { ...buy, id: "rollback" })).status,
  400,
);
assert.equal(
  wallets.get("ajaib").balance,
  1000000,
  "failed investment write rolls back wallet debit",
);
rejectWrite = false;
ok(
  await request(
    "POST",
    "",
    { ...buy, id: "legacy-admin", walletId: "legacy" },
    admin,
  ),
);
assert.equal(wallets.get("legacy").balance, 899900);
assert.equal(rows.get("legacy-admin").userId, "admin");
const unlinked = ok(
  await request("POST", "", { ...buy, id: "unlinked", walletId: null }),
);
assert.equal(unlinked.walletId, null);
assert.equal(wallets.get("ajaib").balance, 1000000);
ok(
  await request("POST", "?restore=1", {
    ...buy,
    id: "restored",
    quantity: 0,
    soldQuantity: 100,
  }),
);
assert.equal(
  wallets.get("ajaib").balance,
  1000000,
  "restore does not replay purchases",
);
assert.deepEqual(rows.get("restored").walletEffects, []);
console.log(
  "PASS: RDN pockets, buys and merges, per-wallet positions, fee, partial/full sell, payout wallet, undo, corrections, deletion, ownership, invalid inputs, atomic rollback, admin legacy wallets, unlinked holdings and restore",
);
