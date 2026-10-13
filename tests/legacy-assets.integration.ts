import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { financeRoutes, resourceRoutes } from "../server/routes/finance.js";
import { analyticsRoutes } from "../server/routes/analytics.js";
import { parsePage } from "../src/lib/page-schema.js";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.port !== "55432" || database.username !== "fintrack_test")
  throw new Error("Use the isolated fintrack_test database on port 55432");
const prefix = `legacy-${randomUUID()}`;
const owner = `${prefix}-owner`;
const foreign = `${prefix}-foreign`;
const root = `${prefix}-root`;
const pockets = Array.from({ length: 13 }, (_, index) => `${prefix}-pocket-${String(index).padStart(2, "0")}`);
const holdings = Array.from({ length: 13 }, (_, index) => `${prefix}-holding-${String(index).padStart(2, "0")}`);
const walletIds = [root, ...pockets, `${prefix}-owned-wallet`, `${prefix}-foreign-wallet`];
const holdingIds = [...holdings, `${prefix}-owned-holding`, `${prefix}-foreign-holding`];
const adminToken = signToken({ sub: `${prefix}-admin`, email: "admin@example.invalid", role: "admin" });
const ownerToken = signToken({ sub: owner, email: "owner@example.invalid", role: "owner" });
const foreignToken = signToken({ sub: foreign, email: "foreign@example.invalid", role: "member" });
const app = new Elysia().use(financeRoutes).use(resourceRoutes).use(analyticsRoutes);
const responseSchema = z.object({ success: z.literal(true), data: z.unknown() });
async function get(path: string, token: string) {
  const response = await app.handle(new Request(`http://localhost/api${path}`, { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 200, path);
  return responseSchema.parse(await response.json()).data;
}
async function page(path: string, token: string) {
  return parsePage<Record<string, unknown>, Record<string, unknown>>(await get(path, token), path);
}
try {
  await db.wallet.createMany({ data: [
    { id: root, name: `${prefix} legacy root`, type: "cash", balance: 100, userId: null },
    ...pockets.map((id) => ({ id, name: `${prefix} legacy pocket`, type: "cash", balance: 10, parentId: root, userId: null })),
    { id: `${prefix}-owned-wallet`, name: `${prefix} owned`, type: "cash", balance: 7, userId: owner },
    { id: `${prefix}-foreign-wallet`, name: `${prefix} foreign`, type: "cash", balance: 9, userId: foreign },
  ] });
  await db.investment.createMany({ data: [
    ...holdings.map((id) => ({ id, name: `${prefix} legacy holding`, symbol: "LEGACY", assetClass: "stock", broker: prefix, quantity: 1, avgBuyPrice: 100, currentPrice: 120, userId: null })),
    { id: `${prefix}-owned-holding`, name: `${prefix} owned holding`, symbol: "OWNED", assetClass: "stock", broker: prefix, quantity: 1, avgBuyPrice: 100, currentPrice: 140, userId: owner },
    { id: `${prefix}-foreign-holding`, name: `${prefix} foreign holding`, symbol: "FOREIGN", assetClass: "stock", broker: prefix, quantity: 1, avgBuyPrice: 100, currentPrice: 130, userId: foreign },
  ] });
  const before = await db.$transaction([
    db.wallet.findMany({ where: { id: { in: walletIds } }, orderBy: { id: "asc" } }),
    db.investment.findMany({ where: { id: { in: holdingIds } }, orderBy: { id: "asc" } }),
  ]);
  const roots = await page(`/wallets?view=parents&search=${prefix}&pageSize=6`, adminToken);
  assert.equal(roots.total, 3, "admin must retain access to legacy unassigned root wallets");
  const legacyRoot = roots.items.find((row) => row.id === root);
  assert.equal(legacyRoot?.groupBalance, 230);
  assert.equal(legacyRoot?.childCount, 13);
  const children1 = await page(`/wallets?parentId=${root}&pageSize=6`, adminToken);
  const children2 = await page(`/wallets?parentId=${root}&pageSize=6&page=2`, adminToken);
  assert.equal(children1.total, 13);
  assert.equal(children2.items.length, 6);
  assert.ok(children2.items.every((row) => !children1.items.some((other) => other.id === row.id)));
  const stocks1 = await page(`/investments?broker=${prefix}&sold=false&pageSize=6`, adminToken);
  const stocks2 = await page(`/investments?broker=${prefix}&sold=false&pageSize=6&page=2`, adminToken);
  assert.equal(stocks1.total, 15, "admin must retain all legacy and assigned holdings");
  assert.equal(stocks1.items.length, 6);
  assert.ok(stocks2.items.every((row) => !stocks1.items.some((other) => other.id === row.id)));
  assert.deepEqual(stocks1.summary, stocks2.summary);
  const stockLast = await page(`/investments?broker=${prefix}&sold=false&pageSize=6&page=3`, adminToken);
  assert.equal(stockLast.items.length, 3);
  const lookup = z.object({ wallets: z.array(z.object({ id: z.string(), children: z.array(z.object({ id: z.string() })).optional() })) }).parse(await get("/bootstrap", adminToken));
  assert.ok(lookup.wallets.some((row) => row.id === root && row.children?.length === 13));
  const ids = await page("/record-ids/investments?pageSize=48", adminToken);
  for (const id of holdingIds) assert.ok(ids.items.some((row) => row.id === id));
  const exported = z.object({ investments: z.array(z.object({ id: z.string() })), wallets: z.array(z.object({ id: z.string() })) }).parse(await get("/export", adminToken));
  for (const id of holdingIds) assert.ok(exported.investments.some((row) => row.id === id));
  assert.ok(exported.wallets.some((row) => row.id === root));
  for (const [token, walletId, holdingId] of [
    [ownerToken, `${prefix}-owned-wallet`, `${prefix}-owned-holding`],
    [foreignToken, `${prefix}-foreign-wallet`, `${prefix}-foreign-holding`],
  ]) {
    const wallets = await page(`/wallets?search=${prefix}&pageSize=48`, token);
    const investments = await page(`/investments?broker=${prefix}&pageSize=48`, token);
    assert.deepEqual(wallets.items.map((row) => row.id), [walletId]);
    assert.deepEqual(investments.items.map((row) => row.id), [holdingId]);
    const theirIds = await page("/record-ids/investments?pageSize=48", token);
    assert.deepEqual(theirIds.items.map((row) => row.id), [holdingId]);
  }
  const after = await db.$transaction([
    db.wallet.findMany({ where: { id: { in: walletIds } }, orderBy: { id: "asc" } }),
    db.investment.findMany({ where: { id: { in: holdingIds } }, orderBy: { id: "asc" } }),
  ]);
  assert.deepEqual(after, before, "restoring visibility must not reassign, delete, or rewrite legacy records");
  console.log("PASS: legacy admin wallets, nested pockets, holdings across pages, lookups, IDs and exports; owner/member isolation; read paths preserve database records");
} finally {
  await db.$transaction([
    db.investment.deleteMany({ where: { id: { in: holdingIds } } }),
    db.wallet.deleteMany({ where: { id: { in: walletIds } } }),
  ]);
  await db.$disconnect();
}
