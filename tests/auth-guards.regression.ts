import assert from "node:assert/strict";
import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import { signToken } from "../server/auth";
import { financeRoutes, resourceRoutes } from "../server/routes/finance";

const app = new Elysia()
  .use(financeRoutes)
  .use(resourceRoutes)
  .get("/public-smoke", () => "public");
const owner = signToken({ sub: "guard-owner", email: "owner@example.invalid", role: "owner" });
const expired = jwt.sign({ sub: "guard-expired", email: "expired@example.invalid", role: "owner", exp: 1 }, process.env.JWT_SECRET ?? "fintrack-dev-secret");
for (const token of [null, "invalid-token", expired]) {
  for (const path of ["/bootstrap", "/users", "/admin/users", "/wallets"]) {
    const response = await app.handle(new Request(`http://localhost/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }));
    assert.equal(response.status, 401, `${path} must reject missing or invalid credentials`);
    assert.deepEqual(await response.json(), { success: false, error: "Unauthorized" });
  }
}
for (const path of ["/users", "/admin/users"]) {
  const response = await app.handle(new Request(`http://localhost/api${path}`, {
    headers: { Authorization: `Bearer ${owner}` },
  }));
  assert.equal(response.status, 403, `${path} must reject a valid non-admin session`);
}
const publicResponse = await app.handle(new Request("http://localhost/public-smoke"));
assert.equal(publicResponse.status, 200, "auth plugins must not leak into sibling public routes");
assert.equal(await publicResponse.text(), "public");
console.log("PASS: missing, invalid, expired credentials return 401; non-admin returns 403; public sibling remains accessible");
