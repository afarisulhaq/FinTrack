import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { signToken } from "../server/auth";
import { stockScreeningRoutes } from "../server/routes/stock-screening";
import { z } from "zod";
const pageSchema = z.object({ success: z.literal(true), data: z.object({
  items: z.array(z.object({ symbol: z.string() }).passthrough()),
  page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number(),
  summary: z.object({ scanned: z.number(), analyzedCount: z.number(), unavailableCount: z.number() }).passthrough(),
}) });
const app = new Elysia().use(stockScreeningRoutes);
const token = signToken({ sub: "test", email: "test@example.invalid", role: "owner" });
let calls = 0, active = 0, maximum = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  calls++; active++; maximum = Math.max(maximum, active);
  await new Promise((resolve) => setTimeout(resolve, 2));
  active--;
  const url = String(input);
  assert.ok(url.includes("/v8/finance/chart/"));
  assert.ok(url.includes("range=6mo"));
  const symbol = decodeURIComponent(url.split("/chart/")[1].split("?")[0]);
  const timestamp = Array.from({ length: 60 }, (_, i) => Math.floor(Date.now() / 1000) - (60 - i) * 86400);
  const values = (value: number) => timestamp.map(() => value);
  return new Response(JSON.stringify({ chart: { result: [{ timestamp, meta: { currency: symbol === "GOTO.JK" ? "USD" : "IDR", shortName: symbol }, indicators: { quote: [{ open: values(100), high: values(102), low: values(98), close: values(100), volume: values(20_000_000) }] } }] } }), { status: 200 });
};
async function request(auth = true, query = "showAll=true&pageSize=6") {
  return app.handle(new Request(`http://localhost/api/stock-screening?${query}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} }));
}
try {
  assert.equal((await request(false)).status, 401);
  assert.equal(calls, 0);
  const [first, second] = await Promise.all([request(), request()]);
  assert.equal(first.status, 200);
  const result = pageSchema.parse(await first.json());
  assert.equal(result.data.summary.scanned, 20);
  assert.equal(result.data.summary.analyzedCount, 19);
  assert.equal(result.data.items.length, 6);
  assert.equal(result.data.totalPages, 4);
  const page2 = pageSchema.parse(await (await request(true, "showAll=true&pageSize=6&page=2")).json()).data;
  assert.ok(page2.items.every((item) => !result.data.items.some((firstItem) => item.symbol === firstItem.symbol)));
  const unavailable = pageSchema.parse(await (await request(true, "view=unavailable")).json()).data;
  assert.deepEqual(unavailable.items.map((item) => item.symbol), ["GOTO"]);
  assert.equal(calls, 20);
  assert.ok(maximum <= 3);
  assert.deepEqual(pageSchema.parse(await second.json()).data, result.data);
  await request();
  assert.equal(calls, 20);
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: authenticated screening, historical Yahoo endpoint, partial-data reporting, three-request concurrency, in-flight deduplication and cache");
