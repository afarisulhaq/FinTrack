import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { publicSplitBillRoutes } from "../server/routes/public-split-bills.js";
import { qrisGatewayRoutes } from "../server/routes/qris-gateway.js";

if (
  !process.env.DATABASE_URL?.startsWith(
    "postgresql://fintrack_test@127.0.0.1:55432/",
  )
) {
  throw new Error("Use the disposable fintrack_test database on port 55432");
}

process.env.QRIS_SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const gatewayOrigin = "http://127.0.0.1:3100";
const apiKey = "split-bill-test-key-never-production";
const originalFetch = globalThis.fetch;
const gatewayInvoices = new Map<string, Record<string, unknown>>();
let createCalls = 0;

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, gatewayOrigin);
  assert.equal(new Headers(init?.headers).get("X-API-Key"), apiKey);
  assert.equal(url.pathname, "/v1/invoices");
  assert.equal(init?.method, "POST");
  const body = JSON.parse(String(init?.body));
  assert.match(body.external_id, /^fintrack:sandbox:split:/);
  assert.equal(body.amount, 12500);
  assert.equal(body.provider, "gopay");
  assert.equal(body.connection_id, undefined);
  createCalls += 1;
  let invoice = gatewayInvoices.get(body.external_id);
  if (!invoice) {
    const id = randomUUID();
    invoice = {
      id,
      external_id: body.external_id,
      environment: "sandbox",
      connection_id: null,
      amount: body.amount,
      payable_amount: body.amount + 7,
      provider: "gopay",
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      paid_at: null,
      checkout_url: `${gatewayOrigin}/pay/${id}`,
      qr_code: "sandbox-qr-code",
      qr_url: null,
    };
    gatewayInvoices.set(body.external_id, invoice);
  }
  return Response.json(invoice, { status: 201 });
};

const ownerId = `split-qris-${randomUUID()}`;
const foreignId = `${ownerId}-foreign`;
const billId = `${ownerId}-bill`;
const participantId = `${ownerId}-participant`;
const payToken = randomUUID().replaceAll("-", "");
const app = new Elysia().use(qrisGatewayRoutes).use(publicSplitBillRoutes);
const token = (id: string) =>
  signToken({ sub: id, email: `${id}@example.invalid`, role: "owner" });

async function request(
  method: string,
  path: string,
  owner?: string,
  body?: unknown,
) {
  const response = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        ...(owner ? { Authorization: `Bearer ${token(owner)}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body === undefined && method === "POST"
        ? { body: "{}" }
        : body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
    }),
  );
  return { status: response.status, json: await response.json() };
}

try {
  await db.user.createMany({
    data: [
      {
        id: ownerId,
        name: "Split QRIS owner",
        email: `${ownerId}@example.invalid`,
        password: "unused",
        status: "active",
      },
      {
        id: foreignId,
        name: "Foreign owner",
        email: `${foreignId}@example.invalid`,
        password: "unused",
        status: "active",
      },
    ],
  });
  await db.splitBill.create({
    data: {
      id: billId,
      title: "Makan siang",
      totalAmount: 12500,
      paidBy: "Owner",
      date: new Date(),
      userId: ownerId,
      participants: {
        create: {
          id: participantId,
          name: "Peserta",
          amount: 12500,
          payToken,
        },
      },
    },
  });

  assert.equal(
    (await request("GET", "/user/qris-gateway-settings")).status,
    401,
  );
  const empty = (
    await request("GET", "/user/qris-gateway-settings", ownerId)
  ).json.data;
  assert.deepEqual(empty, {
    configured: false,
    baseUrl: "",
    environment: "sandbox",
    provider: null,
    connectionId: null,
    apiKeyMasked: null,
  });

  const saved = (
    await request("PUT", "/user/qris-gateway-settings", ownerId, {
      baseUrl: `${gatewayOrigin}/`,
      environment: "sandbox",
      provider: "gopay",
      connectionId: null,
      apiKey,
    })
  ).json.data;
  assert.deepEqual(Object.keys(saved).sort(), [
    "apiKeyMasked",
    "baseUrl",
    "configured",
    "connectionId",
    "environment",
    "provider",
  ]);
  assert.equal(saved.configured, true);
  assert.equal(saved.baseUrl, gatewayOrigin);
  assert.ok(saved.apiKeyMasked.endsWith(apiKey.slice(-4)));
  assert.ok(!JSON.stringify(saved).includes(apiKey));
  const stored = await db.qrisGatewaySetting.findUniqueOrThrow({
    where: { userId: ownerId },
  });
  assert.ok(!stored.apiKeyCiphertext.includes(apiKey));

  const invoicePath = `/split-bills/${billId}/participants/${participantId}/qris-invoice`;
  assert.equal(
    (await request("POST", invoicePath, foreignId, {})).status,
    404,
    "another user cannot create an invoice for the bill",
  );
  const first = (await request("POST", invoicePath, ownerId, {})).json.data;
  assert.deepEqual(Object.keys(first).sort(), [
    "amount",
    "checkoutUrl",
    "expiresAt",
    "qrisCode",
  ]);
  assert.equal(first.amount, 12507);
  assert.equal(first.qrisCode, "sandbox-qr-code");
  const second = (await request("POST", invoicePath, ownerId, {})).json.data;
  assert.deepEqual(second, first);
  assert.equal(createCalls, 1, "a still-pending invoice is reused");

  const publicBill = (
    await request("GET", `/public/split-bills/${billId}/${payToken}`)
  ).json.data;
  assert.deepEqual(publicBill.qrisPayment, first);
  assert.equal("staticQris" in publicBill, false);
  assert.ok(!JSON.stringify(publicBill).includes(apiKey));

  const updated = (
    await request("PUT", "/user/qris-gateway-settings", ownerId, {
      baseUrl: gatewayOrigin,
      environment: "sandbox",
      provider: "shopeepay",
      connectionId: null,
    })
  ).json.data;
  assert.equal(updated.provider, "shopeepay");
  assert.equal(updated.apiKeyMasked, saved.apiKeyMasked);

  const invalid = await request(
    "PUT",
    "/user/qris-gateway-settings",
    ownerId,
    {
      baseUrl: "http://gateway.example.com",
      environment: "production",
      provider: "gopay",
      connectionId: null,
    },
  );
  assert.equal(invalid.status, 400);

  console.log(
    "PASS: per-user encrypted QRIS settings, secret-safe responses, owner scope, pending invoice reuse, and safe public qrisPayment",
  );
} finally {
  globalThis.fetch = originalFetch;
  await db.qrisSplitInvoice.deleteMany({ where: { ownerId } });
  await db.splitBill.deleteMany({ where: { userId: ownerId } });
  await db.qrisGatewaySetting.deleteMany({
    where: { userId: { in: [ownerId, foreignId] } },
  });
  await db.user.deleteMany({ where: { id: { in: [ownerId, foreignId] } } });
  await db.$disconnect();
}
