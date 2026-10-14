import assert from "node:assert/strict";
import { Elysia } from "elysia";
import * as lucide from "lucide-react";
import { db } from "../server/prisma-client";
import { authRoutes } from "../server/routes/auth";
import { financeRoutes, resourceRoutes } from "../server/routes/finance";
import { signToken } from "../server/auth";
import {
  ensureCategoryDefaults,
  ensureMemoryCategoryDefaults,
} from "../server/services/default-categories";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";
import type { Category, SubCategory } from "../src/lib/types";

const now = new Date("2026-10-14T00:00:00Z");
let accounts = new Map<string, any>();
let categories: any[] = [];
let subs: any[] = [];
let failChildren = false;
let queue = Promise.resolve();
let locks = 0;
let sequence = 0;
const filterRows = (rows: any[], where: any) =>
  rows.filter(
    (row) =>
      (!where.userId || row.userId === where.userId) &&
      (!where.type || row.type === where.type) &&
      (!where.categoryId ||
        (typeof where.categoryId === "string"
          ? row.categoryId === where.categoryId
          : where.categoryId.in.includes(row.categoryId))),
  );
function groups(rows: any[], key: string) {
  return [...new Set(rows.map((row) => row[key]))].map((value) => ({
    [key]: value,
    _count: rows.filter((row) => row[key] === value).length,
  }));
}
const client = {
  $queryRawUnsafe: async (query: string) => {
    assert.match(query, /FOR UPDATE/);
    locks++;
    return [];
  },
  user: {
    findUnique: async ({ where }: any) =>
      where.id
        ? (accounts.get(where.id) ?? null)
        : ([...accounts.values()].find((row) => row.email === where.email) ??
          null),
    create: async ({ data }: any) => {
      const user = {
        ...data,
        id: data.id ?? `user-${++sequence}`,
        createdAt: now,
        categoryDefaultsVersion: 0,
      };
      accounts.set(user.id, user);
      return user;
    },
    update: async ({ where, data }: any) => {
      const user = { ...accounts.get(where.id), ...data };
      accounts.set(where.id, user);
      return user;
    },
  },
  category: {
    upsert: async ({ where, create, update }: any) => {
      assert.deepEqual(
        update,
        {},
        "seeding must not overwrite existing customizations",
      );
      const match = where.userId_type_name;
      let category = categories.find(
        (row) =>
          row.userId === match.userId &&
          row.type === match.type &&
          row.name === match.name,
      );
      if (!category) {
        category = {
          ...create,
          id: `category-${++sequence}`,
          createdAt: now,
          updatedAt: now,
        };
        categories.push(category);
      }
      return category;
    },
    findMany: async ({ where, skip = 0, take = categories.length }: any) =>
      filterRows(categories, where).slice(skip, skip + take),
    count: async ({ where }: any) => filterRows(categories, where).length,
    groupBy: async ({ where, by }: any) =>
      groups(filterRows(categories, where), by[0]),
  },
  subCategory: {
    createMany: async ({ data, skipDuplicates }: any) => {
      if (failChildren) throw new Error("Test child write failure");
      assert.equal(skipDuplicates, true);
      for (const child of data) {
        if (
          !subs.some(
            (row) =>
              row.userId === child.userId &&
              row.categoryId === child.categoryId &&
              row.name === child.name,
          )
        ) {
          subs.push({
            ...child,
            id: `sub-${++sequence}`,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      return { count: data.length };
    },
    findMany: async ({ where, skip = 0, take = subs.length }: any) =>
      filterRows(subs, where).slice(skip, skip + take),
    count: async ({ where }: any) => filterRows(subs, where).length,
    groupBy: async ({ where, by }: any) =>
      groups(filterRows(subs, where), by[0]),
  },
  wallet: { findMany: async () => [] },
  appSetting: { findFirst: async () => null },
  notificationSetting: { findUnique: async () => null },
};
process.env.DATABASE_URL = "postgresql://mock/test";
delete process.env.TURNSTILE_SECRET_KEY;
(db as any).$queryRaw = async (query: any) => {
  if (query?.sql?.includes("WITH categories AS")) {
    const userId = query.values[0];
    return ["expense", "income"].map((type) => ({
      type,
      count: subs.filter(
        (sub) =>
          sub.userId === userId &&
          categories.some(
            (category) =>
              category.id === sub.categoryId && category.type === type,
          ),
      ).length,
    }));
  }
  return [{ ok: 1 }];
};
for (const [key, value] of Object.entries(client))
  if (key !== "$queryRawUnsafe") (db as any)[key] = value;
(db as any).$transaction = (fn: any) => {
  const run = queue.then(async () => {
    const snapshot = structuredClone({ accounts, categories, subs });
    try {
      return await fn(client);
    } catch (error) {
      accounts = snapshot.accounts;
      categories = snapshot.categories;
      subs = snapshot.subs;
      throw error;
    }
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};
const user = (id: string, role = "owner") => ({
  id,
  role,
  name: id,
  email: `${id}@example.invalid`,
  password: "unused",
  status: "active",
  createdAt: now,
  categoryDefaultsVersion: 0,
});
for (const id of ["owner", "member", "admin", "failure"])
  accounts.set(
    id,
    user(id, id === "admin" ? "admin" : id === "member" ? "member" : "owner"),
  );
categories.push({
  id: "existing",
  userId: "owner",
  type: "expense",
  name: "Belanja",
  icon: "custom-icon",
  color: "#123456",
  sortOrder: 99,
  isSystem: false,
  createdAt: now,
  updatedAt: now,
});
subs.push({
  id: "existing-sub",
  userId: "owner",
  categoryId: "existing",
  name: "Pakaian",
  icon: "custom-sub-icon",
  color: "#654321",
  sortOrder: 99,
  isSystem: false,
  createdAt: now,
  updatedAt: now,
});
categories.push({
  id: "custom",
  userId: "owner",
  type: "expense",
  name: "Kategori pribadi",
  icon: "Tag",
  color: "#111111",
  sortOrder: 0,
  isSystem: false,
  createdAt: now,
  updatedAt: now,
});
for (const list of Object.values(DEFAULT_CATEGORIES))
  for (const preset of list) {
    for (const icon of [
      preset.icon,
      ...preset.subcategories.map((sub) => sub.icon),
    ]) {
      const name = icon
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
      assert.ok((lucide as any)[name], `Default icon ${icon} must exist`);
    }
  }
await Promise.all([
  ensureCategoryDefaults(db, "owner"),
  ensureCategoryDefaults(db, "owner"),
]);
assert.equal(categories.filter((row) => row.userId === "owner").length, 20);
assert.equal(subs.filter((row) => row.userId === "owner").length, 107);
assert.equal(
  categories.find((row) => row.id === "existing").icon,
  "custom-icon",
);
assert.equal(subs.find((row) => row.id === "existing-sub").color, "#654321");
assert.equal(accounts.get("owner").categoryDefaultsVersion, 1);
const firstCount = categories.length;
const firstLocks = locks;
await ensureCategoryDefaults(db, "owner");
assert.equal(categories.length, firstCount);
assert.equal(locks, firstLocks, "initialized accounts use the quick read path");
categories = categories.filter(
  (row) => !(row.userId === "owner" && row.name === "Hiburan"),
);
await ensureCategoryDefaults(db, "owner");
assert.ok(
  !categories.some((row) => row.userId === "owner" && row.name === "Hiburan"),
  "deleted defaults must not respawn",
);
for (const id of ["member", "admin"]) {
  await ensureCategoryDefaults(db, id);
  assert.equal(categories.filter((row) => row.userId === id).length, 19);
  assert.equal(subs.filter((row) => row.userId === id).length, 107);
}
failChildren = true;
await assert.rejects(ensureCategoryDefaults(db, "failure"));
assert.equal(accounts.get("failure").categoryDefaultsVersion, 0);
assert.equal(
  categories.filter((row) => row.userId === "failure").length,
  0,
  "failed initialization rolls back all categories",
);
failChildren = false;
await ensureCategoryDefaults(db, "failure");
assert.equal(subs.filter((row) => row.userId === "failure").length, 107);
const app = new Elysia().use(authRoutes).use(financeRoutes).use(resourceRoutes);
const adminToken = signToken({
  sub: "admin",
  email: "admin@example.invalid",
  role: "admin",
});
async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  const response = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  const text = await response.text();
  let responseBody;
  try {
    responseBody = JSON.parse(text);
  } catch {
    responseBody = text;
  }
  return { status: response.status, body: responseBody };
}
const registered = await request("POST", "/auth/register", {
  name: "Akun baru",
  email: "registered@example.invalid",
  password: "test-password",
});
assert.equal(registered.status, 200, JSON.stringify(registered));
assert.equal(registered.body.data.awaitingApproval, true);
assert.equal(registered.body.data.token, null);
const registeredId = registered.body.data.user.id;
assert.equal(
  categories.filter((row) => row.userId === registeredId).length,
  19,
);
assert.equal(subs.filter((row) => row.userId === registeredId).length, 107);
const previousAccounts = accounts.size;
failChildren = true;
const failedRegistration = await request("POST", "/auth/register", {
  name: "Gagal daftar",
  email: "failed-registration@example.invalid",
  password: "test-password",
});
assert.equal(failedRegistration.status, 500);
assert.equal(
  accounts.size,
  previousAccounts,
  "default failure rolls back account registration as well",
);
assert.ok(
  ![...accounts.values()].some(
    (row) => row.email === "failed-registration@example.invalid",
  ),
);
failChildren = false;
const created = await request(
  "POST",
  "/users",
  {
    name: "Anggota baru",
    email: "created@example.invalid",
    password: "test-password",
    role: "member",
  },
  adminToken,
);
assert.equal(created.status, 200, JSON.stringify(created));
assert.equal(
  categories.filter((row) => row.userId === created.body.data.id).length,
  19,
);
const bootstrap = await request("GET", "/bootstrap", undefined, adminToken);
assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap));
assert.equal(
  bootstrap.body.data.categories.length,
  19,
  "admin's form uses its own defaults, not copies from every account",
);
const categoryList = await request(
  "GET",
  "/categories?pageSize=48",
  undefined,
  adminToken,
);
assert.equal(categoryList.status, 200, JSON.stringify(categoryList));
assert.equal(
  categoryList.body.data.total,
  19,
  "admin's paginated list must not combine copies from all accounts",
);
assert.equal(categoryList.body.data.items.length, 19);
assert.equal(
  new Set(
    categoryList.body.data.items.map((row: any) => `${row.type}:${row.name}`),
  ).size,
  19,
);
assert.equal(categoryList.body.data.summary.expense, 14);
assert.equal(categoryList.body.data.summary.income, 5);
const food = categories.find(
  (row) => row.userId === "admin" && row.name === "Makanan & Minum",
);
const subList = await request(
  "GET",
  `/subCategories?categoryId=${food.id}&pageSize=48`,
  undefined,
  adminToken,
);
assert.equal(subList.status, 200, JSON.stringify(subList));
assert.equal(
  subList.body.data.total,
  11,
  "subcategory pagination also stays within the account and selected parent",
);
accounts.set("old-account", user("old-account"));
const oldToken = signToken({
  sub: "old-account",
  email: "old-account@example.invalid",
  role: "owner",
});
const oldBootstrap = await request("GET", "/bootstrap", undefined, oldToken);
assert.equal(oldBootstrap.status, 200, JSON.stringify(oldBootstrap));
assert.equal(oldBootstrap.body.data.categories.length, 19);
assert.equal(oldBootstrap.body.data.subCategories.length, 107);
const memoryCategories: Category[] = [];
const memorySubs: SubCategory[] = [];
ensureMemoryCategoryDefaults("memory-owner", memoryCategories, memorySubs);
ensureMemoryCategoryDefaults("memory-member", memoryCategories, memorySubs);
ensureMemoryCategoryDefaults("memory-owner", memoryCategories, memorySubs);
assert.equal(memoryCategories.length, 38);
assert.equal(memorySubs.length, 214);
delete process.env.DATABASE_URL;
const memoryToken = signToken({
  sub: "memory-endpoint",
  email: "memory-endpoint@example.invalid",
  role: "owner",
});
const memoryLookup = await request("GET", "/bootstrap", undefined, memoryToken);
assert.equal(memoryLookup.status, 200, JSON.stringify(memoryLookup));
assert.equal(memoryLookup.body.data.categories.length, 19);
assert.equal(memoryLookup.body.data.subCategories.length, 107);
assert.equal(
  memoryLookup.body.data.categories.flatMap((row: any) => row.subCategories)
    .length,
  107,
);
console.log(
  "PASS: supplied 19 categories and 107 subcategories, valid icons, all account roles, concurrent initialization, custom-data preservation, idempotence, deleted defaults, atomic rollback/retry, registration and admin-created users, own-account lookups and memory fallback",
);
