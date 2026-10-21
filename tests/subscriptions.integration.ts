import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { crc16 } from "../src/lib/qris-utils.js";
import { subscriptionRoutes } from "../server/routes/subscriptions.js";
import { webhookRoutes } from "../server/routes/webhook.js";
import {
  applyPayment,
  createInvoice,
  verifyInvoice,
} from "../server/services/subscriptions.js";
import {
  billingConfig,
  validatePaymentQr,
  webhookEventSchema,
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
const gatewayOrigin = "http://127.0.0.1:3100";
Object.assign(process.env, {
  SUBSCRIPTIONS_ENABLED: "true",
  QRIS_BASE_URL: gatewayOrigin,
  QRIS_API_KEY: "test-key-never-use-in-production",
  QRIS_ENVIRONMENT: "sandbox",
  QRIS_PROVIDER: "gopay",
  QRIS_CONNECTION_ID: "",
  QRIS_WEBHOOK_SECRETS: "whsec_test_secret",
  SUBSCRIPTION_PLAN_NAME: "Test plan",
  SUBSCRIPTION_PRICE_IDR: "29000",
  SUBSCRIPTION_DURATION_DAYS: "30",
});

interface MockInvoice {
  id: string;
  external_id: string;
  description: string;
  environment: "sandbox" | "production";
  connection_id: string | null;
  amount: number;
  payable_amount: number;
  provider: "gopay" | "shopeepay";
  status: "pending" | "paid" | "expired" | "cancelled" | "failed";
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  checkout_url: string;
  qr_code: string | null;
  qr_url: string | null;
}

function dynamicQris(amount: number): string {
  const body = `00020101021252040000530336054${String(String(amount).length).padStart(2, "0")}${amount}5802ID6304`;
  return body + crc16(body);
}

const gatewayInvoices = new Map<string, MockInvoice>();
const createCalls = new Map<string, number>();
const originalFetch = globalThis.fetch;
let providerFails = false;
let forcedHttpError: number | null = null;
let payableExtra = 7;
let checkoutOrigin = gatewayOrigin;
let respondEnvironment: "sandbox" | "production" = "sandbox";

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(
    new Headers(init?.headers).get("X-API-Key"),
    process.env.QRIS_API_KEY,
  );
  if (providerFails) throw new TypeError("network down");
  if (url.pathname === "/v1/invoices" && init?.method === "POST") {
    const body = JSON.parse(String(init?.body));
    const externalId = String(body.external_id);
    assert.match(externalId, /^fintrack:sandbox:/);
    assert.equal(body.description, "Langganan Test plan");
    assert.equal(body.provider, "gopay");
    assert.equal(body.connection_id, undefined);
    createCalls.set(externalId, (createCalls.get(externalId) ?? 0) + 1);
    let invoice = gatewayInvoices.get(externalId);
    if (invoice) {
      // Idempotent replay: identical reference must return identical data.
      assert.equal(invoice.amount, body.amount);
      assert.equal(invoice.description, body.description);
    } else {
      const id = randomUUID();
      invoice = {
        id,
        external_id: externalId,
        description: body.description,
        environment: respondEnvironment,
        connection_id: body.connection_id ?? null,
        amount: body.amount,
        payable_amount: body.amount + payableExtra,
        provider: "gopay",
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300_000).toISOString(),
        paid_at: null,
        checkout_url: `${checkoutOrigin}/pay/${id}`,
        qr_code: dynamicQris(body.amount + payableExtra),
        qr_url: null,
      };
      gatewayInvoices.set(externalId, invoice);
    }
    if (forcedHttpError)
      return Response.json(
        { message: "respons hilang setelah invoice tersimpan" },
        { status: forcedHttpError },
      );
    return Response.json(invoice, { status: 201 });
  }
  const check = /^\/v1\/invoices\/([^/]+)\/check$/.exec(url.pathname);
  if (check && init?.method === "POST") {
    const invoice = [...gatewayInvoices.values()].find(
      (row) => row.id === check[1],
    );
    assert.ok(invoice, "check targets an invoice the gateway created");
    if (forcedHttpError)
      return Response.json(
        { message: "upstream" },
        { status: forcedHttpError },
      );
    return Response.json(invoice);
  }
  assert.fail(`Unexpected gateway call: ${url.pathname}`);
};

const app = new Elysia().use(subscriptionRoutes).use(webhookRoutes);
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

function signWebhook(
  raw: string,
  secret = process.env.QRIS_WEBHOOK_SECRETS!.split(",")[0],
) {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}
async function postWebhook(
  raw: string,
  overrides: {
    signature?: string;
    eventId?: string;
    environment?: string;
  } = {},
) {
  let eventId = overrides.eventId;
  if (!eventId) {
    try {
      const parsed: unknown = JSON.parse(raw);
      eventId =
        parsed !== null &&
        typeof parsed === "object" &&
        "id" in parsed &&
        typeof parsed.id === "string"
          ? parsed.id
          : "unparsable";
    } catch {
      eventId = "unparsable";
    }
  }
  const response = await app.handle(
    new Request("http://localhost/api/webhooks/qris", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QRIS-Signature": overrides.signature ?? signWebhook(raw),
        "X-QRIS-Event-Id": eventId,
        "X-QRIS-Environment": overrides.environment ?? "sandbox",
      },
      body: raw,
    }),
  );
  return response.status;
}
function invoiceEvent(
  invoice: MockInvoice,
  status: MockInvoice["status"],
  eventId = randomUUID(),
) {
  return JSON.stringify({
    id: eventId,
    event: `invoice.${status}`,
    created_at: new Date().toISOString(),
    data: {
      ...invoice,
      status,
      ...(status === "paid" && !invoice.paid_at
        ? { paid_at: new Date().toISOString() }
        : {}),
    },
  });
}

try {
  const a = await user("subscriber-a");
  const b = await user("subscriber-b");
  assert.equal((await request("GET", "/")).status, 401);
  process.env.SUBSCRIPTIONS_ENABLED = "false";
  assert.equal((await request("GET", "/", a.id)).json.data.available, false);
  assert.equal((await request("POST", "/invoices", a.id)).status, 503);
  process.env.SUBSCRIPTIONS_ENABLED = "true";

  // Konfigurasi
  const price = process.env.SUBSCRIPTION_PRICE_IDR;
  delete process.env.SUBSCRIPTION_PRICE_IDR;
  assert.throws(() => billingConfig(), /Konfigurasi/);
  process.env.SUBSCRIPTION_PRICE_IDR = price;
  const baseUrl = process.env.QRIS_BASE_URL;
  process.env.QRIS_BASE_URL = "http://gateway.example.com:3100";
  assert.throws(() => billingConfig(), /HTTPS/);
  process.env.QRIS_BASE_URL = baseUrl;
  const connection = process.env.QRIS_CONNECTION_ID;
  const environment = process.env.QRIS_ENVIRONMENT;
  process.env.QRIS_ENVIRONMENT = "production";
  process.env.QRIS_CONNECTION_ID = "";
  assert.throws(() => billingConfig(), /Konfigurasi/);
  process.env.QRIS_ENVIRONMENT = environment;
  process.env.QRIS_CONNECTION_ID = connection;
  assert.equal(billingConfig()?.url, baseUrl);

  // Pembuatan invoice
  const [one, two] = await Promise.all([
    createInvoice(a.id),
    createInvoice(b.id),
  ]);
  assert.equal(
    one.baseAmount,
    29000,
    "amount sent to the gateway is the plan price",
  );
  assert.equal(one.amount, 29007, "stored amount is the gateway payable total");
  assert.equal(one.uniqueAmount, 7, "gateway unique code is exposed as-is");
  assert.match(one.checkoutUrl ?? "", /^http:\/\/127\.0\.0\.1:3100\/pay\//);
  assert.equal(two.baseAmount, 29000);
  assert.equal(validatePaymentQr(one.qrisCode!, one.amount), true);
  assert.equal(validatePaymentQr(one.qrisCode!, one.amount + 1), false);
  assert.equal(
    validatePaymentQr(one.qrisCode!.slice(0, -4) + "FFFF", one.amount),
    false,
  );
  const externalIdA = `fintrack:sandbox:${one.id}`;
  assert.equal(createCalls.get(externalIdA), 1);
  assert.equal((await createInvoice(a.id)).id, one.id, "reuse an open invoice");
  assert.equal(
    createCalls.get(externalIdA),
    1,
    "open invoice is not recreated at the gateway",
  );
  assert.equal(
    (await request("POST", `/invoices/${one.id}/check`, b.id)).status,
    404,
    "invoice ownership",
  );

  // Riwayat dan pagination
  const reference = await db.subscriptionInvoice.findUniqueOrThrow({
    where: { id: one.id },
  });
  await db.subscriptionInvoice.createMany({
    data: Array.from({ length: 14 }, (_, index) => ({
      userId: a.id,
      plan: reference.plan,
      planName: reference.planName,
      baseAmount: reference.baseAmount,
      amount: 40000 + index,
      durationDays: reference.durationDays,
      gatewayAccount: reference.gatewayAccount,
      status: "failed",
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(
        reference.createdAt.getTime() - 7_200_000 - (index + 1) * 1000,
      ),
    })),
  });
  const overview = (await request("GET", "/", a.id)).json.data;
  assert.equal(overview.invoices, undefined);
  assert.equal(overview.latestInvoiceId, one.id);
  assert.equal(overview.openInvoice.id, one.id);
  const invoicePage = (await request("GET", "/invoices?pageSize=12", a.id)).json
    .data;
  const invoiceHistory = (
    await request("GET", "/invoices?pageSize=12&page=2", a.id)
  ).json.data;
  assert.equal(invoicePage.total, 15);
  assert.equal(invoicePage.items.length, 12);
  assert.equal(invoiceHistory.items.length, 3);
  assert.equal(
    invoicePage.items[0].qrisCode,
    null,
    "list never exposes QR payloads",
  );
  assert.equal(
    invoicePage.items[0].checkoutUrl,
    null,
    "list never exposes checkout links",
  );
  const detail = (await request("GET", `/invoices/${one.id}`, a.id)).json.data;
  assert.equal(detail.qrisCode, one.qrisCode);
  assert.equal(detail.checkoutUrl, one.checkoutUrl);
  const historicalId = invoiceHistory.items[0].id;
  assert.equal(
    (await request("GET", `/invoices/${historicalId}`, a.id)).status,
    200,
  );
  assert.equal(
    (await request("GET", `/invoices/${historicalId}`, b.id)).status,
    404,
  );
  assert.equal(
    (await request("GET", "/invoices?pageSize=201", a.id)).status,
    400,
  );

  // Pemeriksaan pembayaran
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
  const gatewayOne = [...gatewayInvoices.values()].find(
    (row) => row.external_id === externalIdA,
  )!;
  gatewayOne.status = "paid";
  gatewayOne.paid_at = new Date().toISOString();
  gatewayOne.qr_code = null;
  assert.equal((await verifyInvoice(a.id, one.id)).status, "paid");
  const active = await db.subscription.findUniqueOrThrow({
    where: { userId: a.id },
  });
  await Promise.all([
    applyPayment(one.id, new Date(gatewayOne.paid_at!)),
    applyPayment(one.id, new Date(gatewayOne.paid_at!)),
  ]);
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { userId: a.id } })
    ).expiresAt.getTime(),
    active.expiresAt.getTime(),
    "duplicate activation never extends twice",
  );
  await assert.rejects(
    () => applyPayment(two.id, new Date(Date.now() + 60_000)),
    /tidak cocok/,
    "paid_at after now is rejected",
  );
  await assert.rejects(
    () => applyPayment(two.id, new Date(0)),
    /tidak cocok/,
    "paid_at before the invoice exists is rejected",
  );
  assert.equal(
    (await db.subscriptionInvoice.findUniqueOrThrow({ where: { id: two.id } }))
      .status,
    "pending",
    "rejected windows leave the invoice pending",
  );

  // Perpanjangan
  const renewed = await createInvoice(a.id);
  assert.notEqual(renewed.id, one.id, "a paid invoice never gets reused");
  await applyPayment(renewed.id, new Date());
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { userId: a.id } })
    ).expiresAt.getTime(),
    active.expiresAt.getTime() + 30 * 86_400_000,
    "renewal adds exactly one period",
  );

  // Kegagalan gateway: jaringan mempertahankan baris untuk replay idempoten
  const c = await user("subscriber-failure");
  providerFails = true;
  await assert.rejects(() => createInvoice(c.id), /belum bisa dihubungi/);
  const retrying = await db.subscriptionInvoice.findFirstOrThrow({
    where: { userId: c.id },
  });
  assert.equal(
    retrying.status,
    "creating",
    "network failure keeps the row retryable",
  );
  providerFails = false;
  const afterRetry = await createInvoice(c.id);
  assert.equal(afterRetry.id, retrying.id, "retry reuses the same row");
  assert.equal(createCalls.get(`fintrack:sandbox:${retrying.id}`), 1);

  // Respons hilang setelah invoice tersimpan: replay mengembalikan invoice yang sama
  const d = await user("subscriber-lost");
  forcedHttpError = 504;
  await assert.rejects(() => createInvoice(d.id), /gagal memproses/);
  const dRow = await db.subscriptionInvoice.findFirstOrThrow({
    where: { userId: d.id },
  });
  assert.equal(
    dRow.status,
    "creating",
    "lost response keeps the row retryable",
  );
  forcedHttpError = null;
  const recovered = await createInvoice(d.id);
  assert.equal(
    recovered.id,
    dRow.id,
    "retry reuses the same row and external_id",
  );
  assert.equal(
    recovered.status,
    "pending",
    "reconciliation recovers the stored invoice",
  );
  assert.equal(
    createCalls.get(`fintrack:sandbox:${dRow.id}`),
    2,
    "both attempts carry the same reference; the second replays",
  );
  const recoveredRow = await db.subscriptionInvoice.findUniqueOrThrow({
    where: { id: recovered.id },
  });
  assert.equal(
    recoveredRow.gatewayReference,
    gatewayInvoices.get(`fintrack:sandbox:${dRow.id}`)!.id,
    "the gateway never opened a second invoice for the reference",
  );

  // Penolakan permanen menutup invoice
  const e = await user("subscriber-rejected");
  forcedHttpError = 401;
  await assert.rejects(() => createInvoice(e.id), /gagal memproses/);
  forcedHttpError = null;
  const rejected = await db.subscriptionInvoice.findFirstOrThrow({
    where: { userId: e.id },
  });
  assert.equal(
    rejected.status,
    "failed",
    "definitive gateway rejection fails the row",
  );
  const replacement = await createInvoice(e.id);
  assert.notEqual(
    replacement.id,
    rejected.id,
    "failed rows are replaced, not retried",
  );

  // Validasi respons gateway: seluruh pelanggaran ditolak sebagai 502
  const f = await user("subscriber-payable");
  payableExtra = 150;
  await assert.rejects(() => createInvoice(f.id), /tidak valid/);
  payableExtra = 7;
  const fRow = await db.subscriptionInvoice.findFirstOrThrow({
    where: { userId: f.id },
  });
  assert.equal(
    fRow.status,
    "creating",
    "invalid payable data keeps the row retryable",
  );
  const g = await user("subscriber-origin");
  checkoutOrigin = "https://evil.example";
  await assert.rejects(() => createInvoice(g.id), /tidak valid/);
  checkoutOrigin = gatewayOrigin;
  const h = await user("subscriber-environment");
  respondEnvironment = "production";
  await assert.rejects(() => createInvoice(h.id), /tidak valid/);
  respondEnvironment = "sandbox";

  // Perubahan konfigurasi menutup verifikasi invoice lama
  process.env.QRIS_BASE_URL = `${baseUrl}/changed`;
  await assert.rejects(() => verifyInvoice(b.id, two.id), /Akun gateway/);
  process.env.QRIS_BASE_URL = baseUrl;

  // Webhook
  const w = await user("subscriber-webhook");
  const wInvoice = await createInvoice(w.id);
  const wGateway = [...gatewayInvoices.values()].find(
    (row) => row.external_id === `fintrack:sandbox:${wInvoice.id}`,
  )!;
  const paidRaw = invoiceEvent(wGateway, "paid");
  const expiredRaw = invoiceEvent(wGateway, "expired");
  assert.equal(
    await postWebhook(expiredRaw),
    204,
    "expired event is accepted as a no-op",
  );
  assert.equal(
    (
      await db.subscriptionInvoice.findUniqueOrThrow({
        where: { id: wInvoice.id },
      })
    ).status,
    "pending",
    "expired never overwrites pending: late paid must stay possible",
  );
  assert.equal(await postWebhook(paidRaw), 204, "valid paid event activates");
  assert.equal(
    (
      await db.subscriptionInvoice.findUniqueOrThrow({
        where: { id: wInvoice.id },
      })
    ).status,
    "paid",
  );
  const wActive = await db.subscription.findUniqueOrThrow({
    where: { userId: w.id },
  });
  assert.equal(
    await postWebhook(paidRaw),
    204,
    "duplicate event still answers 204",
  );
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { userId: w.id } })
    ).expiresAt.getTime(),
    wActive.expiresAt.getTime(),
    "duplicate paid event does not extend twice",
  );
  assert.equal(
    await postWebhook(paidRaw, { signature: signWebhook(paidRaw, "wrong") }),
    401,
  );
  const tampered = paidRaw.replace("29007", "29008");
  assert.notEqual(tampered, paidRaw);
  assert.equal(
    await postWebhook(tampered, { signature: signWebhook(paidRaw) }),
    401,
    "signature covers raw bytes",
  );
  assert.equal(
    await postWebhook(expiredRaw, { eventId: "not-the-body-id" }),
    400,
    "event id header must match the body",
  );
  assert.equal(
    await postWebhook(expiredRaw, { environment: "production" }),
    400,
    "environment header must match",
  );
  const foreign = webhookEventSchema.parse(JSON.parse(paidRaw));
  foreign.data.external_id = "fintrack:sandbox:does-not-exist";
  assert.equal(
    await postWebhook(JSON.stringify(foreign)),
    409,
    "unknown reference is rejected",
  );
  const wrongAmount = webhookEventSchema.parse(JSON.parse(paidRaw));
  wrongAmount.data.amount = 12345;
  assert.equal(
    await postWebhook(JSON.stringify(wrongAmount)),
    409,
    "amount mismatch is rejected",
  );
  assert.equal(
    await postWebhook("not json at all", {
      signature: signWebhook("not json at all"),
    }),
    400,
    "garbage body is rejected after signature check",
  );

  // Webhook yang tiba sebelum respons create disimpan tetap terikat referensinya
  const early = await db.subscriptionInvoice.create({
    data: {
      userId: w.id,
      plan: "subscription",
      planName: "Test plan",
      baseAmount: 29000,
      amount: 29000,
      durationDays: 30,
      gatewayAccount: billingConfig()!.account,
      status: "creating",
      expiresAt: new Date(Date.now() + 300_000),
    },
  });
  const earlyGateway: MockInvoice = {
    ...wGateway,
    id: randomUUID(),
    external_id: `fintrack:sandbox:${early.id}`,
    amount: 29000,
    payable_amount: 29007,
    status: "pending",
    paid_at: new Date().toISOString(),
    qr_code: dynamicQris(29007),
  };
  const earlyRaw = invoiceEvent(earlyGateway, "paid");
  assert.equal(
    await postWebhook(earlyRaw),
    409,
    "paid before create is stored is rejected",
  );
  await db.subscriptionInvoice.update({
    where: { id: early.id },
    data: {
      status: "pending",
      amount: 29007,
      gatewayReference: earlyGateway.id,
      checkoutUrl: `${gatewayOrigin}/pay/${earlyGateway.id}`,
    },
  });
  assert.equal(
    await postWebhook(earlyRaw),
    204,
    "gateway retry after the save lands",
  );
  assert.equal(
    (
      await db.subscriptionInvoice.findUniqueOrThrow({
        where: { id: early.id },
      })
    ).status,
    "paid",
  );

  // Webhook terminal menutup invoice yang masih pending
  const x = await user("subscriber-failed-event");
  const xInvoice = await createInvoice(x.id);
  const xGateway = [...gatewayInvoices.values()].find(
    (row) => row.external_id === `fintrack:sandbox:${xInvoice.id}`,
  )!;
  assert.equal(await postWebhook(invoiceEvent(xGateway, "failed")), 204);
  assert.equal(
    (
      await db.subscriptionInvoice.findUniqueOrThrow({
        where: { id: xInvoice.id },
      })
    ).status,
    "failed",
    "invoice.failed closes the local invoice",
  );

  // Secret tidak pernah bocor ke browser
  const payload = JSON.stringify((await request("GET", "/", a.id)).json);
  assert.ok(!payload.includes(process.env.QRIS_API_KEY!));
  assert.ok(!payload.includes("gatewayReference"));

  console.log(
    "PASS: disabled checkout, auth, ownership, config validation, idempotent create, payable totals, QR/checkout validation, history, check throttle, paid activation, renewal, network replay, lost response reconciliation, permanent rejection, config change, webhook signature/idempotency/mismatch, secret hygiene",
  );
} finally {
  globalThis.fetch = originalFetch;
  await db.subscriptionInvoice.deleteMany({ where: { userId: { in: users } } });
  await db.subscription.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
