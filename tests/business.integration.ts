import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { resourceRoutes } from "../server/routes/finance.js";
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
  data: {
    name: "Child pocket",
    type: "cash",
    userId: owner,
    balance: 100000,
    parentId: wallet.id,
  },
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
  const adminTokenForWallets = signToken({
    sub: owner,
    email: "test@example.invalid",
    role: "admin",
  });
  const legacy = await db.wallet.create({
    data: {
      name: "Legacy admin pocket",
      type: "cash",
      balance: 0,
      parentId: wallet.id,
    },
  });
  try {
    assert.equal(
      (
        await request("POST", path, {
          ...body,
          type: "income",
          walletId: legacy.id,
        })
      ).status,
      400,
    );
    const legacyIncome = await request(
      "POST",
      path,
      { ...body, type: "income", walletId: legacy.id },
      adminTokenForWallets,
    );
    assert.equal(legacyIncome.status, 201);
    assert.equal(
      Number(
        (await db.wallet.findUniqueOrThrow({ where: { id: legacy.id } }))
          .balance,
      ),
      100000,
    );
    assert.equal(
      (
        await request(
          "DELETE",
          `${path}/${legacyIncome.json.data.id}`,
          undefined,
          adminTokenForWallets,
        )
      ).status,
      200,
    );
    assert.equal(
      Number(
        (await db.wallet.findUniqueOrThrow({ where: { id: legacy.id } }))
          .balance,
      ),
      0,
    );
    const finance = new Elysia().use(resourceRoutes);
    const createdWallet = await finance.handle(
      new Request("http://localhost/api/wallets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminTokenForWallets}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Admin child",
          type: "cash",
          balance: 0,
          parentId: wallet.id,
        }),
      }),
    );
    assert.equal(createdWallet.status, 201);
    const createdId = (await createdWallet.json()).data.id;
    assert.equal(
      (await db.wallet.findUniqueOrThrow({ where: { id: createdId } })).userId,
      owner,
    );
    const income = await request(
      "POST",
      path,
      { ...body, type: "income", walletId: createdId },
      adminTokenForWallets,
    );
    assert.equal(income.status, 201);
    assert.equal(
      Number(
        (await db.wallet.findUniqueOrThrow({ where: { id: createdId } }))
          .balance,
      ),
      100000,
    );
    assert.equal(
      (
        await request(
          "DELETE",
          `${path}/${income.json.data.id}`,
          undefined,
          adminTokenForWallets,
        )
      ).status,
      200,
    );
  } finally {
    await db.businessTransaction.deleteMany({ where: { walletId: legacy.id } });
    await db.wallet.delete({ where: { id: legacy.id } });
  }
  const foreignWallet = await db.wallet.create({
    data: {
      name: "Foreign pocket",
      type: "cash",
      userId: `${owner}-other`,
      balance: 100000,
      parentId: wallet.id,
    },
  });
  try {
    assert.equal(
      (await request("POST", path, { ...body, walletId: foreignWallet.id }))
        .status,
      400,
    );
    const adminToken = signToken({
      sub: owner,
      email: "test@example.invalid",
      role: "admin",
    });
    const adminEntry = await request(
      "POST",
      path,
      { ...body, walletId: foreignWallet.id },
      adminToken,
    );
    assert.equal(adminEntry.status, 201);
    assert.equal(
      Number(
        (await db.wallet.findUniqueOrThrow({ where: { id: foreignWallet.id } }))
          .balance,
      ),
      0,
    );
    assert.equal(
      (
        await request(
          "DELETE",
          `${path}/${adminEntry.json.data.id}`,
          undefined,
          adminToken,
        )
      ).status,
      200,
    );
    assert.equal(
      Number(
        (await db.wallet.findUniqueOrThrow({ where: { id: foreignWallet.id } }))
          .balance,
      ),
      100000,
    );
  } finally {
    await db.businessTransaction.deleteMany({
      where: { walletId: foreignWallet.id },
    });
    await db.wallet.delete({ where: { id: foreignWallet.id } });
  }
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
