import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGateway } from "../src/server.mjs";
import { Store, passwordHash, passwordMatches } from "../src/store.mjs";
import { Provider } from "../src/provider.mjs";
import { crc16, parseQris, dynamicQris } from "../src/qris.mjs";

const payload = "0002010102115204000053033605802ID5908MERCHANT6007JAKARTA6304";
const template = payload + crc16(payload);

test("QRIS parser validates CRC, duplicate tags, currency, and dynamic amount", () => {
  assert.equal(parseQris(template).get("59"), "MERCHANT");
  assert.equal(parseQris(dynamicQris(template, 29001)).get("54"), "29001");
  assert.throws(() => parseQris(template.slice(0, -4) + "0000"), /checksum/);
  assert.throws(() => dynamicQris(template, 1.5), /Nominal/);
  const duplicate = payload.slice(0, -4) + "53033606304";
  assert.throws(() => parseQris(duplicate + crc16(duplicate)), /Panjang/);
});

test("dashboard, merchant OTP, API isolation, idempotency, settlement, refunds, and persistence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "qris-gateway-test-"));
  let rawTransactions = [],
    refreshes = 0;
  const upstream = async (url, options) => {
    assert.ok(
      String(url).startsWith("https://api.gobiz.co.id/") ||
        String(url).startsWith("https://api.gojekapi.com/"),
    );
    if (String(url).endsWith("/login/request"))
      return Response.json({ otp_token: "TEST_OTP" });
    if (String(url).endsWith("/goid/token")) {
      const body = JSON.parse(options.body);
      if (body.grant_type === "refresh_token") refreshes++;
      if (body.grant_type === "otp") {
        assert.equal(body.data.otp, "1234");
        assert.equal(body.data.otp_token, "TEST_OTP");
      }
      return Response.json({
        access_token: "TEST_ACCESS",
        refresh_token: "TEST_REFRESH",
        expires_in: 3600,
      });
    }
    assert.equal(options.headers.Authorization, "Bearer TEST_ACCESS");
    assert.ok(new URL(url).searchParams.get("payment_types") === "QRIS");
    return Response.json({ transactions: rawTransactions });
  };
  const gateway = createGateway({
    directory,
    publicUrl: "http://127.0.0.1:3010",
    providerFactory: (store) => new Provider(store, upstream),
  });
  await new Promise((resolve) =>
    gateway.server.listen(0, "127.0.0.1", resolve),
  );
  const base = "http://127.0.0.1:" + gateway.server.address().port;
  let cookie = "",
    csrf = "";
  async function request(
    path,
    {
      method = "GET",
      body,
      key,
      auth = true,
      origin = "http://127.0.0.1:3010",
      csrfToken = csrf,
      idempotency,
    } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(auth ? { Cookie: cookie, "X-CSRF-Token": csrfToken } : {}),
        ...(key ? { "X-Api-Key": key } : {}),
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    return { response, json, data: json.data, status: response.status };
  }
  try {
    assert.equal((await request("/dashboard/overview")).status, 401);
    assert.equal(
      (
        await request("/dashboard/login", {
          method: "POST",
          body: { username: "admin", password: "test-admin-password" },
        })
      ).status,
      503,
    );
    gateway.store.set("admin_username", "admin");
    gateway.store.set("admin_password", passwordHash("test-admin-password"));
    assert.equal(
      passwordMatches("wrong", gateway.store.get("admin_password")),
      false,
    );
    assert.equal(
      (
        await request("/dashboard/login", {
          method: "POST",
          body: { username: "admin", password: "wrong" },
        })
      ).status,
      401,
    );
    const login = await request("/dashboard/login", {
      method: "POST",
      body: { username: "admin", password: "test-admin-password" },
    });
    assert.equal(login.status, 200);
    cookie = login.response.headers.get("set-cookie").split(";")[0];
    csrf = login.data.csrf;
    assert.ok(login.response.headers.get("set-cookie").includes("HttpOnly"));
    assert.equal(
      (
        await request("/dashboard/keys", {
          method: "POST",
          body: { name: "blocked" },
          origin: "https://foreign.invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/dashboard/keys", {
          method: "POST",
          body: { name: "blocked" },
          csrfToken: "bad",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/dashboard/invoices", {
          method: "POST",
          body: { amount: 29000 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/dashboard/settings", {
          method: "POST",
          body: { merchant: "G_TEST", qris: template, dedicated: true },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/dashboard/otp/request", {
          method: "POST",
          body: { phone: "08123456789" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/dashboard/otp/verify", {
          method: "POST",
          body: { code: "1234" },
        })
      ).status,
      200,
    );
    assert.ok(
      !gateway.store.db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get("merchant_session")
        .value.includes("TEST_ACCESS"),
    );
    const overview = await request("/dashboard/overview");
    assert.equal(overview.data.merchant.connected, true);
    assert.equal(overview.data.stats.received, 0);
    const a = (
      await request("/dashboard/keys", {
        method: "POST",
        body: { name: "App A" },
      })
    ).data;
    const b = (
      await request("/dashboard/keys", {
        method: "POST",
        body: { name: "App B" },
      })
    ).data;
    const keys = await request("/dashboard/keys");
    assert.ok(!JSON.stringify(keys.json).includes(a.key));
    const invoice = await request("/v1/invoices", {
      method: "POST",
      body: {
        amount: 29000,
        reference: "order-1",
        description: "Test only",
        status: "paid",
      },
      key: a.key,
      idempotency: "order-1",
      auth: false,
    });
    assert.equal(invoice.status, 200);
    assert.equal(invoice.data.amount, 29001);
    assert.equal(invoice.data.status, "pending");
    assert.equal(
      (
        await request("/v1/invoices", {
          method: "POST",
          body: {
            amount: 29000,
            reference: "order-1",
            description: "Test only",
          },
          key: a.key,
          idempotency: "order-1",
          auth: false,
        })
      ).data.id,
      invoice.data.id,
    );
    assert.equal(
      (
        await request("/v1/invoices", {
          method: "POST",
          body: { amount: 30000, reference: "order-1" },
          key: a.key,
          idempotency: "order-1",
          auth: false,
        })
      ).status,
      400,
    );
    const second = await request("/v1/invoices", {
      method: "POST",
      body: { amount: 29000, reference: "order-2" },
      key: b.key,
      auth: false,
    });
    assert.equal(second.data.amount, 29002);
    assert.equal(
      (
        await request("/v1/invoices/" + invoice.data.id, {
          key: b.key,
          auth: false,
        })
      ).status,
      404,
    );
    const qr = await fetch(base + "/qris/" + invoice.data.id + ".svg");
    assert.equal(qr.status, 200);
    assert.ok((await qr.text()).includes("<svg"));
    const row = gateway.store.db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(invoice.data.id);
    rawTransactions = [
      {
        id: "test-payment",
        gross_amount: String(row.amount),
        transaction_time: new Date(Date.now()).toISOString(),
        transaction_status: "REFUND",
      },
    ];
    const checked = await request("/v1/invoices/" + row.id + "/check", {
      method: "POST",
      body: {},
      key: a.key,
      auth: false,
    });
    assert.equal(checked.data.status, "pending");
    assert.equal(
      (
        await request("/v1/invoices/" + row.id + "/check", {
          method: "POST",
          body: {},
          key: a.key,
          auth: false,
        })
      ).status,
      400,
    );
    gateway.store.db
      .prepare("UPDATE invoices SET checked=NULL WHERE id=?")
      .run(row.id);
    rawTransactions[0].transaction_status = "SETTLEMENT";
    const paid = await request("/v1/invoices/" + row.id + "/check", {
      method: "POST",
      body: {},
      key: a.key,
      auth: false,
    });
    assert.equal(paid.data.status, "paid");
    assert.equal(
      (
        await request("/public/invoices/" + row.id + "/check", {
          method: "POST",
          body: {},
          auth: false,
        })
      ).data.status,
      "paid",
    );
    assert.equal(
      (await request("/dashboard/overview")).data.stats.received,
      29001,
    );
    const claim = {
      id: "test-payment",
      amount: second.data.amount,
      status: "settlement",
      time: Date.now(),
    };
    assert.throws(
      () => gateway.store.settle(second.data.id, [claim]),
      /Transaksi sudah/,
    );
    assert.throws(
      () =>
        gateway.store.settle(second.data.id, [
          { ...claim, id: "one" },
          { ...claim, id: "two" },
        ]),
      /ambigu/,
    );
    const expired = await request("/v1/invoices", {
      method: "POST",
      body: { amount: 29000, reference: "expired" },
      key: a.key,
      auth: false,
    });
    gateway.store.db
      .prepare("UPDATE invoices SET expires=? WHERE id=?")
      .run(Date.now() - 1, expired.data.id);
    assert.equal(
      (await request("/public/invoices/" + expired.data.id, { auth: false }))
        .data.qris_code,
      null,
    );
    assert.equal(
      (await fetch(base + "/qris/" + expired.data.id + ".svg")).status,
      410,
    );
    const exact = await request("/create-qris", {
      method: "POST",
      body: { amount: 50001 },
      key: a.key,
      auth: false,
    });
    assert.equal(exact.data.amount, 50001);
    assert.equal(exact.data.unique_amount, 0);
    assert.equal(
      (
        await request("/create-qris", {
          method: "POST",
          body: { amount: 50001 },
          key: a.key,
          auth: false,
        })
      ).status,
      400,
    );
    const mutations = await request(
      "/transactions?startTime=" + Math.floor(row.created / 1000),
      { key: a.key, auth: false },
    );
    assert.equal(mutations.data.transactions[0].status, "settlement");
    const session = gateway.store.secret("merchant_session");
    session.expires_at = 0;
    gateway.store.setSecret("merchant_session", session);
    await Promise.all([gateway.provider.session(), gateway.provider.session()]);
    assert.equal(refreshes, 1);
    assert.equal(
      (
        await request("/dashboard/settings", {
          method: "POST",
          body: { merchant: "DIFFERENT", qris: template, dedicated: true },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/dashboard/keys/" + a.id + "/revoke", {
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/v1/invoices", { key: a.key, auth: false })).status,
      401,
    );
    assert.equal(
      (await request("/dashboard/logout", { method: "POST", body: {} })).status,
      200,
    );
    assert.equal((await request("/dashboard/overview")).status, 401);
    await new Promise((resolve) => gateway.server.close(resolve));
    gateway.store.close();
    const reopened = new Store(directory);
    assert.equal(
      reopened.db.prepare("SELECT status FROM invoices WHERE id=?").get(row.id)
        .status,
      "paid",
    );
    assert.equal(
      reopened.secret("merchant_session").access_token,
      "TEST_ACCESS",
    );
    assert.ok(
      !readFileSync(join(directory, "gateway.sqlite")).includes(
        Buffer.from(a.key),
      ),
    );
    reopened.close();
  } finally {
    if (gateway.server.listening)
      await new Promise((resolve) => gateway.server.close(resolve));
    try {
      gateway.store.close();
    } catch {}
    rmSync(directory, { recursive: true, force: true });
  }
});
