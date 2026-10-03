import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { businessRoutes } from "../server/routes/business.js";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Use the disposable test database on localhost:55432");
}
const app = new Elysia().use(businessRoutes);
const owner = `business-test-${Date.now()}`;
const token = signToken({
  sub: owner,
  email: "test@example.invalid",
  role: "owner",
});
const foreignToken = signToken({
  sub: "other-owner",
  email: "other@example.invalid",
  role: "owner",
});
async function request(
  method: string,
  path: string,
  body?: unknown,
  auth = token,
) {
  const response = await app.handle(
    new Request(`http://localhost/api/businesses${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return { status: response.status, json: await response.json() };
}
const wallet = await db.wallet.create({
  data: { name: "Test wallet", type: "cash", userId: owner, balance: 500000 },
});
const second = await db.wallet.create({
  data: { name: "Second wallet", type: "cash", userId: owner, balance: 100000 },
});
let businessId = "";
try {
  assert.equal((await request("GET", "/", undefined, "invalid")).status, 401);
  assert.equal(
    (await request("POST", "/", { name: " ", description: "" })).status,
    400,
  );
  const created = await request("POST", "/", {
    name: "Pulsa",
    description: "Test only",
  });
  assert.equal(created.status, 201);
  businessId = created.json.data.id;
  const path = `/${businessId}/transactions`;
  const body = {
    type: "expense",
    amount: 100000,
    description: "Beli pulsa",
    date: "2026-10-03T00:00:00.000Z",
    walletId: wallet.id,
  };
  assert.equal((await request("POST", path, body, foreignToken)).status, 400);
  assert.equal(
    (await request("POST", path, { ...body, amount: 0 })).status,
    400,
  );
  assert.equal(
    (await request("POST", path, { ...body, amount: 1.001 })).status,
    400,
  );
  assert.equal(
    (await request("POST", path, { ...body, amount: -1 })).status,
    400,
  );
  assert.equal(
    (await request("POST", path, { ...body, date: "invalid" })).status,
    400,
  );
  const entry = await request("POST", path, body);
  assert.equal(entry.status, 201);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance,
    ),
    400000,
  );
  assert.equal((await request("DELETE", `/${businessId}`)).status, 409);
  const income = await request("POST", path, {
    ...body,
    type: "income",
    amount: 120000,
  });
  assert.equal(income.status, 201);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance,
    ),
    520000,
  );
  const none = await request("POST", path, { ...body, walletId: null });
  assert.equal(none.status, 201);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance,
    ),
    520000,
  );
  const edited = await request("PUT", `${path}/${entry.json.data.id}`, {
    ...body,
    amount: 50000,
    walletId: second.id,
  });
  assert.equal(edited.status, 200);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance,
    ),
    620000,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: second.id } })).balance,
    ),
    50000,
  );
  assert.equal(
    (
      await request("PUT", `${path}/${entry.json.data.id}`, {
        ...body,
        walletId: "unknown",
      })
    ).status,
    400,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: second.id } })).balance,
    ),
    50000,
  );
  assert.equal(
    (
      await request("PUT", `${path}/${entry.json.data.id}`, {
        ...body,
        walletId: null,
      })
    ).status,
    200,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: second.id } })).balance,
    ),
    100000,
  );
  assert.equal(
    (await request("GET", "/", undefined, foreignToken)).json.data.length,
    0,
  );
  for (const id of [
    entry.json.data.id,
    income.json.data.id,
    none.json.data.id,
  ]) {
    assert.equal((await request("DELETE", `${path}/${id}`)).status, 200);
  }
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance,
    ),
    500000,
  );
  assert.equal((await request("DELETE", `/${businessId}`)).status, 200);
  console.log(
    "PASS: authentication, ownership, validation, expense, income, no wallet, wallet changes, failed edits, deletion and balance restoration",
  );
} finally {
  await db.businessTransaction.deleteMany({ where: { businessId } });
  await db.business.deleteMany({ where: { id: businessId } });
  await db.wallet.deleteMany({ where: { userId: owner } });
  await db.$disconnect();
}
