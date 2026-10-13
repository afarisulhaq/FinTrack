import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { signToken } from "../server/auth";
import { stockScreeningRoutes } from "../server/routes/stock-screening";
const app = new Elysia().use(stockScreeningRoutes);
const token = signToken({ sub: "test", email: "test@example.invalid", role: "owner" });
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { calls++; return new Response("rate limited", { status: 429 }); };
async function request() {
  return app.handle(new Request("http://localhost/api/stock-screening", { headers: { Authorization: `Bearer ${token}` } }));
}
try {
  const response = await request();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
  assert.ok(calls <= 3);
  const initialCalls = calls;
  assert.equal((await request()).status, 503);
  assert.equal(calls, initialCalls);
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: rate limit stops scan, unavailable data never becomes a buy signal, failed scan cached briefly to avoid request storms");
