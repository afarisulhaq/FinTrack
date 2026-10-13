import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { signToken } from "../server/auth";
import { marketWatchlistRoutes } from "../server/routes/market-watchlist";
delete process.env.DATABASE_URL;
const app = new Elysia().use(marketWatchlistRoutes);
async function request(user: string | null, method = "GET", body?: unknown) {
  const token = user ? signToken({ sub: user, role: "owner", email: "test@example.invalid" }) : null;
  const response = await app.handle(new Request("http://localhost/api/market-watchlist/", {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  return { status: response.status, json: await response.json() };
}
assert.equal((await request(null)).status, 401);
assert.equal((await request("a")).json.data.summary.symbols, null);
assert.deepEqual((await request("a", "POST", { symbols: ["bbca.JK", "BBCA", "TLKM"] })).json.data.symbols, ["BBCA", "TLKM"]);
assert.deepEqual((await request("a", "POST", { symbols: ["GOTO"] })).json.data.symbols, ["BBCA", "TLKM"]);
assert.equal((await request("b")).json.data.summary.symbols, null);
await Promise.all([request("a", "PUT", { action: "add", symbol: "ANTM" }), request("a", "PUT", { action: "add", symbol: "BBRI" })]);
assert.deepEqual((await request("a")).json.data.summary.symbols, ["BBCA", "TLKM", "ANTM", "BBRI"]);
for (const symbol of ["BBCA", "TLKM", "ANTM", "BBRI"]) await request("a", "PUT", { action: "remove", symbol });
assert.deepEqual((await request("a", "POST", { symbols: ["GOTO"] })).json.data.symbols, []);
assert.equal((await request("a", "POST", { symbols: ["<bad>"] })).status, 422);
process.env.DATABASE_URL = "postgresql://localhost:1/unavailable";
assert.equal((await request("a")).status, 503);
delete process.env.DATABASE_URL;
console.log("PASS: authentication, per-account isolation, one-time import, deduplication, concurrent additions, empty watchlist, validation, database outage does not fall back");
