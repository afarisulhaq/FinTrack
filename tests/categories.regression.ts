import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client";
import { signToken } from "../server/auth";
import { resourceRoutes } from "../server/routes/finance";
import type { Category, SubCategory } from "../src/lib/types";
const date = "2026-10-04T00:00:00Z";
const sub: SubCategory = {
  id: "sub",
  categoryId: "first",
  name: "Sub",
  icon: "Tag",
  color: "#d97706",
  sortOrder: 0,
  isSystem: false,
  createdAt: date,
  updatedAt: date,
};
const first: Category = {
  id: "first",
  type: "expense",
  name: "First",
  icon: "Folder",
  color: "#d97706",
  sortOrder: 0,
  isSystem: false,
  subCategories: [sub],
  createdAt: date,
  updatedAt: date,
};
const second: Category = {
  ...first,
  id: "second",
  name: "Second",
  subCategories: [],
};
process.env.DATABASE_URL = "postgresql://mock/test";
(db as any).$queryRaw = async () => [];
let filter: any;
for (const model of ["category", "subCategory"]) {
  (db as any)[model].findMany = async ({ where }: any) => {
    filter = where;
    return [];
  };
}
const app = new Elysia().use(resourceRoutes);
for (const resource of ["categories", "subCategories"]) {
  for (const role of ["admin", "owner"] as const) {
    const token = signToken({
      sub: "owner",
      email: "test@example.invalid",
      role,
    });
    const response = await app.handle(
      new Request(`http://localhost/api/${resource}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(
      filter,
      role === "admin" ? undefined : { userId: "owner" },
    );
  }
}
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: {
      getItem: () => JSON.stringify({ state: { token: "test" } }),
    },
    location: { origin: "http://localhost" },
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;
let calls = 0;
let reject = false;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(
    options?.method,
    "PUT",
    "edit must not replace the list via an extra GET",
  );
  if (reject)
    return Response.json(
      { success: false, error: "Rejected" },
      { status: 400 },
    );
  const updates = JSON.parse(String(options?.body));
  const saved = String(url).includes("/subCategories/")
    ? { ...sub, ...updates }
    : { ...first, ...updates, name: "Server name" };
  return Response.json({ success: true, data: saved });
};
const { useFinanceStore } = await import("../src/store/useFinanceStore");
try {
  useFinanceStore.setState({
    categories: [first, second],
    subCategories: [sub],
  });
  await useFinanceStore.getState().updateCategory("first", { name: "Edited" });
  assert.equal(calls, 1);
  assert.equal(useFinanceStore.getState().categories.length, 2);
  assert.equal(useFinanceStore.getState().categories[0]!.name, "Server name");
  assert.equal(
    useFinanceStore.getState().categories[0]!.subCategories.length,
    1,
  );
  await useFinanceStore
    .getState()
    .updateSubCategory("sub", { name: "Edited sub", categoryId: "second" });
  assert.equal(calls, 2);
  assert.equal(useFinanceStore.getState().categories.length, 2);
  assert.equal(
    useFinanceStore.getState().categories[0]!.subCategories.length,
    0,
  );
  assert.equal(
    useFinanceStore.getState().categories[1]!.subCategories[0]!.name,
    "Edited sub",
  );
  reject = true;
  await useFinanceStore
    .getState()
    .updateCategory("first", { name: "Rejected change" });
  assert.equal(useFinanceStore.getState().categories[0]!.name, "Server name");
  assert.equal(useFinanceStore.getState().categories.length, 2);
  console.log(
    "PASS: admin/owner category scopes, edit preserves list and children, canonical save response, subcategory move, rollback, no extra GET",
  );
} finally {
  globalThis.fetch = originalFetch;
}
