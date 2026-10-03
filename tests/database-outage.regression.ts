import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client";
import { signToken } from "../server/auth";
import { financeRoutes, resourceRoutes } from "../server/routes/finance";
process.env.DATABASE_URL = "postgresql://mock/test";
(db as any).$queryRaw = async () => {
  throw new Error("Test database outage");
};
const app = new Elysia().use(financeRoutes).use(resourceRoutes);
const token = signToken({
  sub: "owner",
  email: "test@example.invalid",
  role: "owner",
});
for (const [method, path] of [
  ["GET", "/bootstrap"],
  ["GET", "/wallets"],
  ["GET", "/transactions"],
  ["POST", "/wallets"],
  ["PUT", "/wallets/test"],
  ["DELETE", "/wallets/test"],
] as const) {
  const response = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(["POST", "PUT"].includes(method) ? { body: "{}" } : {}),
    }),
  );
  assert.equal(response.status, 503, `${method} ${path}`);
  assert.equal((await response.json()).success, false);
}
console.log(
  "PASS: database outage rejects bootstrap and persisted-resource reads/writes instead of returning fallback data",
);
