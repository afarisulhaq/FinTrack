import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client";
import { signToken } from "../server/auth";
import { resourceRoutes } from "../server/routes/finance";

const wallets = new Map([
  [
    "source",
    {
      id: "source",
      name: "Asal",
      userId: "owner",
      currency: "IDR",
      balance: 500,
    },
  ],
  [
    "destination",
    {
      id: "destination",
      name: "Tujuan",
      userId: "owner",
      currency: "IDR",
      balance: 100,
    },
  ],
  [
    "foreign",
    {
      id: "foreign",
      name: "Lain",
      userId: "other",
      currency: "IDR",
      balance: 100,
    },
  ],
]);
let rows = new Map<string, any>();
let failDestination = false;
const client = {
  wallet: {
    findFirst: async ({ where }: any) => {
      const wallet = wallets.get(where.id);
      return wallet && (!where.userId || wallet.userId === where.userId)
        ? wallet
        : null;
    },
    update: async ({ where, data }: any) => {
      if (failDestination && where.id === "destination")
        throw new Error("Simulated failure");
      const wallet = wallets.get(where.id)!;
      wallet.balance += data.balance.increment;
      return wallet;
    },
  },
  transaction: {
    findFirst: async ({ where }: any) => rows.get(where.id),
    create: async ({ data }: any) => {
      rows.set(data.id, data);
      return data;
    },
    update: async ({ where, data }: any) => {
      const row = { ...rows.get(where.id), ...data };
      rows.set(where.id, row);
      return row;
    },
    delete: async ({ where }: any) => rows.delete(where.id),
  },
  budget: { updateMany: async () => ({ count: 0 }) },
};
process.env.DATABASE_URL = "postgresql://mock/test";
(db as any).$queryRaw = async () => [{ ok: 1 }];
(db as any).$transaction = async (fn: any) => {
  const oldWallets = structuredClone(wallets);
  const oldRows = structuredClone(rows);
  try {
    return await fn(client);
  } catch (error) {
    wallets.clear();
    for (const [id, wallet] of oldWallets) wallets.set(id, wallet);
    rows = oldRows;
    throw error;
  }
};
const app = new Elysia().use(resourceRoutes);
const token = signToken({
  sub: "owner",
  email: "test@example.invalid",
  role: "owner",
});
async function request(method: string, path: string, body?: unknown) {
  const response = await app.handle(
    new Request(`http://localhost/api/transactions${path}`, {
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
const transfer = {
  id: "transfer",
  type: "transfer",
  amount: 50,
  walletId: "source",
  destinationWalletId: "destination",
  category: "Transfer",
  categoryIcon: "ArrowLeftRight",
  description: "",
  date: "2026-10-03T00:00:00Z",
};
assert.equal((await request("POST", "", transfer)).status, 201);
assert.equal(wallets.get("source")!.balance, 450);
assert.equal(wallets.get("destination")!.balance, 150);
assert.equal((await request("PUT", "/transfer", { amount: 80 })).status, 200);
assert.equal(wallets.get("source")!.balance, 420);
assert.equal(wallets.get("destination")!.balance, 180);
assert.equal((await request("DELETE", "/transfer")).status, 200);
assert.equal(wallets.get("source")!.balance, 500);
assert.equal(wallets.get("destination")!.balance, 100);
for (const destinationWalletId of ["source", "foreign", "missing", ""]) {
  assert.equal(
    (await request("POST", "", { ...transfer, destinationWalletId })).status,
    400,
  );
}
failDestination = true;
assert.equal((await request("POST", "", transfer)).status, 400);
assert.equal(wallets.get("source")!.balance, 500);
assert.equal(rows.size, 0);
console.log(
  "PASS: transfer create/edit/delete, same-wallet and ownership validation, atomic rollback",
);
