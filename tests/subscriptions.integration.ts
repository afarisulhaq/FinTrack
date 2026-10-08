import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { crc16 } from "../src/lib/qris-utils.js";
import { subscriptionRoutes } from "../server/routes/subscriptions.js";
import {
  applyPayment,
  createInvoice,
  verifyInvoice,
} from "../server/services/subscriptions.js";
import {
  billingConfig,
  matchPayment,
  type PaymentCandidate,
  validatePaymentQr,
} from "../server/services/subscription-gateway.js";

if (
  !process.env.DATABASE_URL?.startsWith(
    "postgresql://fintrack_test@127.0.0.1:55432/",
  )
) {
  throw new Error(
    "Use the disposable subscription test database on port 55432",
  );
}
Object.assign(process.env, {
  SUBSCRIPTIONS_ENABLED: "true",
  GOPAY_GATEWAY_URL: "http://127.0.0.1:3010",
  GOPAY_GATEWAY_API_KEY: "test-key-never-use-in-production",
  GOPAY_DEDICATED_MERCHANT: "true",
  GOPAY_GATEWAY_MERCHANT_ID: "test-merchant",
  SUBSCRIPTION_PLAN_NAME: "Test plan",
  SUBSCRIPTION_PRICE_IDR: "29000",
  SUBSCRIPTION_DURATION_DAYS: "30",
});
const originalFetch = globalThis.fetch;
let payments: PaymentCandidate[] = [];
let providerFails = false;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  assert.equal(
    new Headers(init?.headers).get("X-Api-Key"),
    process.env.GOPAY_GATEWAY_API_KEY,
  );
  assert.equal(
    new Headers(init?.headers).get("X-Gopay-Merchant-Id"),
    "test-merchant",
  );
  if (providerFails) throw new Error("secret upstream payload");
  if (url.endsWith("/create-qris")) {
    const { amount } = JSON.parse(String(init?.body));
    const amountText = String(amount);
    const payload = `00020101021252040000530336054${String(amountText.length).padStart(2, "0")}${amountText}5802ID6304`;
    return Response.json({
      success: true,
      data: {
        amount,
        qris_code: payload + crc16(payload),
        trx_id: `test-${amount}`,
        expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
    });
  }
  assert.ok(url.includes("/transactions?"));
  return Response.json({ success: true, data: { transactions: payments } });
};
const app = new Elysia().use(subscriptionRoutes);
const users: string[] = [];
async function user(name: string) {
  const row = await db.user.create({
    data: {
      name,
      email: `${name}-${Date.now()}@example.invalid`,
      password: "test-hash",
      status: "active",
    },
  });
  users.push(row.id);
  return row;
}
async function request(method: string, path: string, id?: string) {
  const token = id
    ? signToken({ sub: id, email: "test@example.invalid", role: "owner" })
    : "invalid";
  const response = await app.handle(
    new Request(`http://localhost/api/subscriptions${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: "{}" } : {}),
    }),
  );
  return { status: response.status, json: await response.json() };
}
try {
  const a = await user("subscriber-a");
  const b = await user("subscriber-b");
  assert.equal((await request("GET", "/")).status, 401);
  process.env.SUBSCRIPTIONS_ENABLED = "false";
  assert.equal((await request("GET", "/", a.id)).json.data.available, false);
  assert.equal((await request("POST", "/invoices", a.id)).status, 503);
  process.env.SUBSCRIPTIONS_ENABLED = "true";
  const price = process.env.SUBSCRIPTION_PRICE_IDR;
  delete process.env.SUBSCRIPTION_PRICE_IDR;
  assert.throws(() => billingConfig(), /Konfigurasi/);
  process.env.SUBSCRIPTION_PRICE_IDR = price;
  const gatewayUrl = process.env.GOPAY_GATEWAY_URL;
  process.env.GOPAY_GATEWAY_URL = "http://qris-gateway:3010";
  assert.equal(billingConfig()?.url, "http://qris-gateway:3010");
  process.env.GOPAY_GATEWAY_URL = "http://gateway.example.com:3010";
  assert.throws(() => billingConfig(), /HTTPS/);
  process.env.GOPAY_GATEWAY_URL = gatewayUrl;
  const [one, two] = await Promise.all([
    createInvoice(a.id),
    createInvoice(b.id),
  ]);
  assert.notEqual(
    one.amount,
    two.amount,
    "concurrent users receive distinct amounts",
  );
  assert.equal(validatePaymentQr(one.qrisCode!, one.amount), true);
  assert.equal(validatePaymentQr(one.qrisCode!, one.amount + 1), false);
  assert.equal(
    validatePaymentQr(one.qrisCode!.slice(0, -4) + "FFFF", one.amount),
    false,
  );
  assert.equal((await createInvoice(a.id)).id, one.id, "reuse an open invoice");
  assert.equal(
    (await request("POST", `/invoices/${one.id}/check`, b.id)).status,
    404,
  );
  const reference = await db.subscriptionInvoice.findUniqueOrThrow({
    where: { id: one.id },
  });
  const time = new Date().toISOString();
  const candidate = {
    transaction_id: "subscription-test-payment",
    amount: one.amount,
    status: "settlement",
    time,
  };
  assert.equal(
    matchPayment([{ ...candidate, status: "refund" }], reference),
    null,
  );
  assert.equal(
    matchPayment([{ ...candidate, status: "success" }], reference),
    null,
  );
  assert.equal(
    matchPayment([{ ...candidate, amount: one.amount + 100 }], reference),
    null,
  );
  assert.equal(
    matchPayment(
      [
        {
          ...candidate,
          time: new Date(reference.createdAt.getTime() - 1000).toISOString(),
        },
      ],
      reference,
    ),
    null,
  );
  assert.equal(
    matchPayment(
      [
        {
          ...candidate,
          time: new Date(reference.expiresAt.getTime() + 1000).toISOString(),
        },
      ],
      reference,
    ),
    null,
  );
  assert.throws(
    () =>
      matchPayment(
        [candidate, { ...candidate, transaction_id: "another" }],
        reference,
      ),
    /lebih dari satu/,
  );
  assert.throws(
    () =>
      matchPayment(
        Array.from({ length: 100 }, () => candidate),
        reference,
      ),
    /terlalu banyak/,
  );
  payments = [{ ...candidate, status: "refund" }];
  assert.equal((await verifyInvoice(a.id, one.id)).status, "pending");
  assert.equal(
    await db.subscription.findUnique({ where: { userId: a.id } }),
    null,
  );
  await assert.rejects(() => verifyInvoice(a.id, one.id), /15 detik/);
  await db.subscriptionInvoice.update({
    where: { id: one.id },
    data: { lastCheckedAt: null },
  });
  payments = [candidate];
  assert.equal((await verifyInvoice(a.id, one.id)).status, "paid");
  const active = await db.subscription.findUniqueOrThrow({
    where: { userId: a.id },
  });
  await Promise.all([
    applyPayment(one.id, candidate.transaction_id, new Date(time)),
    applyPayment(one.id, candidate.transaction_id, new Date(time)),
  ]);
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { userId: a.id } })
    ).expiresAt.getTime(),
    active.expiresAt.getTime(),
  );
  await assert.rejects(
    () => applyPayment(two.id, candidate.transaction_id, new Date(time)),
    /sudah digunakan/,
  );
  const renewed = await createInvoice(a.id);
  await applyPayment(renewed.id, "subscription-test-renewal", new Date());
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { userId: a.id } })
    ).expiresAt.getTime(),
    active.expiresAt.getTime() + 30 * 86_400_000,
  );
  await db.$disconnect();
  assert.equal(
    (await db.subscriptionInvoice.findUniqueOrThrow({ where: { id: one.id } }))
      .providerTransactionId,
    candidate.transaction_id,
    "claim survives reconnection",
  );
  process.env.GOPAY_GATEWAY_MERCHANT_ID = "changed-merchant";
  await assert.rejects(() => verifyInvoice(b.id, two.id), /Akun gateway/);
  process.env.GOPAY_GATEWAY_MERCHANT_ID = "test-merchant";
  const c = await user("subscriber-failure");
  providerFails = true;
  await assert.rejects(() => createInvoice(c.id), /belum bisa dihubungi/);
  const failed = await db.subscriptionInvoice.findFirstOrThrow({
    where: { userId: c.id },
  });
  assert.equal(failed.status, "failed");
  providerFails = false;
  assert.notEqual(
    (await createInvoice(c.id)).amount,
    failed.amount,
    "failed reservations are never recycled",
  );
  const payload = JSON.stringify((await request("GET", "/", a.id)).json);
  assert.ok(!payload.includes(process.env.GOPAY_GATEWAY_API_KEY!));
  assert.ok(!payload.includes("gatewayReference"));
  console.log(
    "PASS: disabled checkout, authentication, ownership, unique reservations, strict settlement matching, refunds, ambiguity, rate limit, atomic activation, duplicate claims, renewal, durable claims, account changes, gateway failure",
  );
} finally {
  globalThis.fetch = originalFetch;
  await db.subscriptionInvoice.deleteMany({ where: { userId: { in: users } } });
  await db.subscription.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
