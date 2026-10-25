import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { financeRoutes, resourceRoutes } from "../server/routes/finance.js";
import { pagedPeopleRoutes } from "../server/routes/paged-people.js";
import { analyticsRoutes } from "../server/routes/analytics.js";
import { publicSplitBillRoutes } from "../server/routes/public-split-bills.js";
import { parsePage } from "../src/lib/page-schema.js";
process.env.TZ = "Asia/Jakarta";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "55432" ||
  url.username !== "fintrack_test"
)
  throw new Error(
    "Use the disposable fintrack_test database on localhost:55432",
  );
const owner = `pagination-${randomUUID()}`;
const foreign = `${owner}-foreign`;
const token = signToken({
  sub: owner,
  role: "owner",
  email: `${owner}@example.invalid`,
});
const otherToken = signToken({
  sub: foreign,
  role: "owner",
  email: `${foreign}@example.invalid`,
});
const adminToken = signToken({
  sub: owner,
  role: "admin",
  email: `${owner}@example.invalid`,
});
const app = new Elysia()
  .use(financeRoutes)
  .use(pagedPeopleRoutes)
  .use(resourceRoutes)
  .use(analyticsRoutes)
  .use(publicSplitBillRoutes);
const envelope = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const month = date.toISOString().slice(0, 7);
const parentId = `${owner}-wallet-parent`;
const catId = `${owner}-category-parent`;
const splitId = `${owner}-split-parent`;
const debtId = `${owner}-debt-parent`;
const indices = Array.from({ length: 25 }, (_, index) => index);
const recordId = (kind: string, index: number) =>
  `${owner}-${kind}-${String(index).padStart(2, "0")}`;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  auth = token,
) {
  const response = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { status: response.status, ...envelope.parse(await response.json()) };
}
async function page(path: string, auth = token) {
  const response = await request(path, "GET", undefined, auth);
  assert.equal(response.status, 200, `${path}: ${response.error}`);
  return parsePage<Record<string, unknown>, Record<string, unknown>>(
    response.data,
    path,
  );
}
try {
  await db.user.create({
    data: {
      id: owner,
      name: "Pagination test",
      email: `${owner}@example.invalid`,
      password: "unused",
      role: "owner",
      status: "active",
      timezone: "UTC",
    },
  });
  await db.wallet.create({
    data: {
      id: parentId,
      name: "Parent wallet",
      type: "cash",
      balance: 10000,
      userId: owner,
    },
  });
  const foreignWalletId = `${owner}-foreign-wallet`;
  await db.wallet.create({
    data: {
      id: foreignWalletId,
      name: "Foreign wallet visible to admin",
      type: "cash",
      balance: 0,
      userId: foreign,
    },
  });
  const adminDebt = await request(
    "/debts",
    "POST",
    {
      id: `${owner}-admin-debt`,
      direction: "owe",
      personName: "Admin wallet scope",
      amount: 500,
      paidAmount: 0,
      installments: [],
      walletId: foreignWalletId,
      isSettled: false,
    },
    adminToken,
  );
  assert.equal(adminDebt.status, 201, adminDebt.error);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: foreignWalletId } }))
        .balance,
    ),
    500,
  );
  await db.category.create({
    data: {
      id: catId,
      name: "Parent category",
      type: "expense",
      userId: owner,
    },
  });
  await db.splitBill.create({
    data: {
      id: splitId,
      title: "Participant pagination",
      totalAmount: 2500,
      paidBy: "Owner",
      date,
      userId: owner,
      participants: {
        create: indices.map((index) => ({
          id: recordId("participant", index),
          name: `Participant ${String(index).padStart(2, "0")}`,
          amount: 100,
          payToken: recordId("paytoken", index),
        })),
      },
    },
  });
  await db.debt.create({
    data: {
      id: debtId,
      direction: "owe",
      personName: "Installment pagination",
      amount: 4000,
      paidAmount: 2500,
      installments: indices.map((index) => ({
        id: recordId("installment", index),
        amount: 100,
        date: date.toISOString(),
        walletId: parentId,
      })),
      userId: owner,
    },
  });
  await db.$transaction([
    db.wallet.createMany({
      data: indices.map((index) => ({
        id: recordId("wallet", index),
        name: `Pocket ${index}`,
        type: "cash",
        balance: 100,
        parentId,
        userId: owner,
      })),
    }),
    db.transaction.createMany({
      data: indices.map((index) => ({
        id: recordId("transaction", index),
        type: index % 2 ? "income" : "expense",
        amount: index % 2 ? 200 : 100,
        category: "Essentials",
        walletId: parentId,
        walletName: "Parent wallet",
        description:
          index === 24 ? "needle outside first page" : `Transaction ${index}`,
        date,
        userId: owner,
      })),
    }),
    db.budget.createMany({
      data: indices.map((index) => ({
        id: recordId("budget", index),
        category: index === 24 ? "Essentials" : `Budget ${index}`,
        categoryIcon: "Circle",
        limit: 100,
        spent: index * 10,
        period: index % 2 ? "weekly" : "monthly",
        userId: owner,
      })),
    }),
    db.investment.createMany({
      data: indices.map((index) => ({
        id: recordId("investment", index),
        name: `Investment ${index}`,
        symbol: `TEST${index}`,
        assetClass: "stock",
        broker: "Test",
        quantity: 1,
        avgBuyPrice: 100,
        currentPrice: 120,
        userId: owner,
      })),
    }),
    db.bill.createMany({
      data: indices.map((index) => ({
        id: recordId("bill", index),
        name: `Bill ${index}`,
        amount: 100,
        category: "Essentials",
        dueDate: date,
        status: index % 2 ? "paid" : "unpaid",
        userId: owner,
      })),
    }),
    db.savingGoal.createMany({
      data: indices.map((index) => ({
        id: recordId("goal", index),
        name: `Goal ${index}`,
        targetAmount: 1000,
        currentAmount: 100,
        deadline: date,
        userId: owner,
      })),
    }),
    db.note.createMany({
      data: indices.map((index) => ({
        id: recordId("note", index),
        title: `Note ${index}`,
        content: "Content",
        tags: index === 24 ? ["needle-tag"] : [],
        userId: owner,
      })),
    }),
    db.recurringTransaction.createMany({
      data: indices.map((index) => ({
        id: recordId("recurring", index),
        name: `Recurring ${index}`,
        amount: 100,
        type: "expense",
        category: "Essentials",
        walletId: parentId,
        nextDate: date,
        userId: owner,
      })),
    }),
    db.debt.createMany({
      data: indices.map((index) => ({
        id: recordId("debt", index),
        personName: `Contact ${index}`,
        direction: index % 2 ? "lent" : "owe",
        amount: 100,
        userId: owner,
      })),
    }),
    db.debtContact.createMany({
      data: indices.map((index) => ({
        id: recordId("contact", index),
        name: `Saved ${index}`,
        userId: owner,
      })),
    }),
    db.card.createMany({
      data: indices.map((index) => ({
        id: recordId("card", index),
        name: `Card ${index}`,
        bank: "Test",
        type: "credit",
        last4Digits: "1234",
        billingCycleStart: 1,
        statementDate: 5,
        dueDate: 20,
        userId: owner,
      })),
    }),
    db.wishlistItem.createMany({
      data: indices.map((index) => ({
        id: recordId("wish", index),
        name: `Wish ${index}`,
        price: 100,
        userId: owner,
      })),
    }),
    db.reimbursement.createMany({
      data: indices.map((index) => ({
        id: recordId("reimbursement", index),
        title: `Claim ${index}`,
        amount: 100,
        paidFrom: parentId,
        userId: owner,
      })),
    }),
    db.teamMember.createMany({
      data: indices.map((index) => ({
        id: recordId("member", index),
        name: `Member ${index}`,
        email: `member-${index}@example.invalid`,
        permissions: {
          canViewAllWallets: false,
          canAddTransactions: true,
          canManageBudgets: false,
          walletIds: [],
        },
        userId: owner,
      })),
    }),
    db.category.createMany({
      data: indices.map((index) => ({
        id: recordId("category", index),
        name: `Category ${index}`,
        type: "expense",
        userId: owner,
      })),
    }),
    db.subCategory.createMany({
      data: indices.map((index) => ({
        id: recordId("subcategory", index),
        name: `Subcategory ${index}`,
        categoryId: catId,
        userId: owner,
      })),
    }),
    db.splitBill.createMany({
      data: indices.map((index) => ({
        id: recordId("split", index),
        title: `Split ${index}`,
        totalAmount: 100,
        paidBy: "Owner",
        date,
        userId: owner,
      })),
    }),
  ]);
  await db.transaction.createMany({
    data: [
      {
        id: `${owner}-foreign-transaction`,
        type: "expense",
        amount: 999,
        category: "Essentials",
        walletId: parentId,
        walletName: "Foreign",
        description: "needle foreign",
        date,
        userId: foreign,
      },
      {
        id: `${owner}-orphan-transaction`,
        type: "expense",
        amount: 999,
        category: "Essentials",
        walletId: parentId,
        walletName: "Orphan",
        description: "needle orphan",
        date,
        userId: null,
      },
    ],
  });
  const lists = [
    "wallets",
    "transactions",
    "budgets",
    "investments",
    "bills",
    "savingGoals",
    "notes",
    "recurringTransactions",
    "debts",
    "debtContacts",
    "cards",
    "wishlist",
    "reimbursements",
    "teamMembers",
    "categories",
    "subCategories",
    "splitBills",
  ];
  for (const resource of lists) {
    const extra = resource === "debtContacts" ? "&view=saved" : "";
    const first = await page(`/${resource}?page=1&pageSize=6${extra}`);
    const second = await page(`/${resource}?page=2&pageSize=6${extra}`);
    assert.equal(first.items.length, 6, resource);
    assert.ok(first.total >= 25, resource);
    assert.equal(second.page, 2, resource);
    assert.ok(
      second.items.every(
        (row) => !first.items.some((item) => item.id === row.id),
      ),
      resource,
    );
    assert.deepEqual(
      first.summary,
      second.summary,
      `${resource}: summaries must not shrink to the visible page`,
    );
  }
  const defaultPage = await page("/transactions");
  assert.equal(defaultPage.pageSize, 10);
  assert.equal(defaultPage.items.length, 10);
  assert.equal(defaultPage.totalPages, 3);
  const defaultSecondPage = await page("/transactions?page=2");
  assert.equal(defaultSecondPage.pageSize, 10);
  assert.equal(defaultSecondPage.items.length, 10);
  assert.ok(
    defaultSecondPage.items.every(
      (row) => !defaultPage.items.some((item) => item.id === row.id),
    ),
  );
  for (const pageSize of [50, 100, 200]) {
    const enlarged = await page(`/transactions?pageSize=${pageSize}`);
    assert.equal(enlarged.pageSize, pageSize);
    assert.equal(enlarged.items.length, 25);
    assert.equal(enlarged.totalPages, 1);
  }
  const transactions = await page(`/transactions?month=${month}&pageSize=6`);
  assert.equal(transactions.total, 25);
  assert.deepEqual(transactions.summary?.monthStats, {
    income: 2400,
    expense: 1300,
    net: 1100,
  });
  assert.ok(
    z
      .array(z.string())
      .parse(transactions.summary?.budgetCategories)
      .includes("Essentials"),
  );
  const found = await page(
    `/transactions?month=${month}&search=needle&pageSize=6`,
  );
  assert.deepEqual(
    found.items.map((row) => row.id),
    [recordId("transaction", 24)],
  );
  assert.deepEqual(found.summary?.monthStats, transactions.summary?.monthStats);
  assert.equal((await page("/transactions?pageSize=6", otherToken)).total, 1);
  assert.equal(
    (await page(`/transactions?search=${owner}&pageSize=6`, adminToken)).total,
    0,
  );
  const adminRows = await page(
    `/transactions?walletId=${parentId}&pageSize=48`,
    adminToken,
  );
  assert.equal(adminRows.total, 27);
  assert.ok(
    adminRows.items.some((row) => row.id === `${owner}-foreign-transaction`),
  );
  assert.ok(
    adminRows.items.some((row) => row.id === `${owner}-orphan-transaction`),
  );
  const last = await page("/transactions?page=999&pageSize=6");
  assert.equal(last.page, 5);
  assert.deepEqual(
    last.items.map((row) => row.id),
    [recordId("transaction", 24)],
  );
  const empty = await page(
    "/transactions?search=does-not-exist&page=999&pageSize=6",
  );
  assert.equal(empty.page, 1);
  assert.equal(empty.totalPages, 1);
  assert.deepEqual(empty.items, []);
  for (const query of [
    "page=0",
    "page=-1",
    "pageSize=201",
    "pageSize=0",
    "page=NaN",
  ])
    assert.equal((await request(`/transactions?${query}`)).status, 400);
  assert.equal((await request("/record-ids/constructor")).status, 404);
  const userDays = z.array(z.object({ day: z.string(), users: z.number() }));
  const usersBefore = userDays.parse(
    (await page("/users?pageSize=1", adminToken)).summary?.last7,
  );
  const localToday = new Date();
  await db.user.create({
    data: {
      id: `${owner}-midnight`,
      name: "Midnight signup",
      email: `${owner}-midnight@example.invalid`,
      password: "unused",
      role: "member",
      status: "active",
      createdAt: new Date(
        localToday.getFullYear(),
        localToday.getMonth(),
        localToday.getDate(),
      ),
    },
  });
  const usersAfter = userDays.parse(
    (await page("/users?pageSize=1", adminToken)).summary?.last7,
  );
  assert.equal(
    usersAfter[6].users,
    usersBefore[6].users + 1,
    "signup at local midnight belongs to today's bucket",
  );
  const budget = await page("/budgets?period=monthly&pageSize=6");
  assert.equal(budget.total, 13);
  assert.equal(budget.summary?.totalLimit, 1300);
  assert.equal(budget.summary?.totalSpent, 1560);
  assert.equal(budget.summary?.overspentCount, 7);
  assert.deepEqual(
    (await page("/notes?search=needle-tag&pageSize=6")).items.map(
      (row) => row.id,
    ),
    [recordId("note", 24)],
  );
  const performance = await page("/investments?view=performance&pageSize=10");
  const fullSeries = z
    .array(z.object({ id: z.string(), value: z.number(), pl: z.number() }))
    .parse(performance.summary?.series);
  assert.deepEqual(
    fullSeries.map((row) => row.id),
    indices.map((index) => recordId("investment", index)),
  );
  assert.ok(fullSeries.every((row) => row.value === 20 && row.pl === 20));
  assert.deepEqual(performance.items, []);
  const investments = await page("/investments?pageSize=6");
  assert.equal(investments.summary?.totalValue, 3000);
  assert.equal(investments.summary?.totalPL, 500);
  const pockets = await page(`/wallets?parentId=${parentId}&pageSize=6`);
  assert.equal(pockets.total, 25);
  const roots = await page("/wallets?view=parents&pageSize=6");
  assert.equal(roots.items[0]?.groupBalance, 12500);
  assert.equal(roots.items[0]?.childCount, 25);
  assert.ok(!("children" in roots.items[0]!));
  const subcategories = await page(
    `/subCategories?categoryId=${catId}&pageSize=6`,
  );
  assert.equal(subcategories.total, 25);
  const categories = await page("/categories?pageSize=48");
  assert.equal(
    categories.items.find((row) => row.id === catId)?.subCategoryCount,
    25,
  );
  assert.ok(categories.items.every((row) => !("subCategories" in row)));
  assert.equal((await page("/cards?view=billing&pageSize=6")).total, 50);
  assert.equal(
    (
      await page(
        `/recurringTransactions?view=calendar&week=${Math.min(Math.ceil(date.getUTCDate() / 7), 4)}&pageSize=6`,
      )
    ).total,
    25,
  );
  await db.recurringTransaction.create({
    data: {
      id: `${owner}-calendar-boundary`,
      name: "Calendar midnight boundary",
      amount: 100,
      type: "expense",
      category: "Essentials",
      walletId: parentId,
      userId: owner,
      nextDate: new Date(`${month}-07T20:00:00.000Z`),
    },
  });
  const calendarWeek = await page(
    "/recurringTransactions?view=calendar&week=2&pageSize=48",
  );
  assert.equal(
    calendarWeek.items.find((row) => row.id === `${owner}-calendar-boundary`)
      ?.day,
    8,
  );
  assert.ok(
    calendarWeek.items.every(
      (row) => Math.min(Math.ceil(Number(row.day) / 7), 4) === 2,
    ),
  );
  const bootstrap = z
    .record(z.unknown())
    .parse((await request("/bootstrap")).data);
  for (const key of [
    "transactions",
    "budgets",
    "investments",
    "bills",
    "notes",
    "debts",
    "debtContacts",
    "splitBills",
    "teamMembers",
  ])
    assert.ok(!(key in bootstrap), `bootstrap must not preload ${key}`);
  const exported = z.record(z.unknown()).parse((await request("/export")).data);
  assert.equal(z.array(z.unknown()).parse(exported.transactions).length, 25);
  assert.equal(
    (await page("/record-ids/transactions?page=2&pageSize=6")).total,
    25,
  );
  const analytics = await page("/analytics/summary?period=year");
  assert.equal(analytics.summary?.totalIncome, 2400);
  assert.equal(analytics.summary?.totalExpense, 1300);
  assert.equal(analytics.summary?.walletBalance, 12500);
  const installments = await page(
    `/debts?view=installments&debtId=${debtId}&pageSize=6`,
  );
  assert.equal(installments.total, 25);
  const [year, monthNumber] = month.split("-").map(Number);
  await db.transaction.createMany({
    data: [
      {
        id: `${owner}-boundary-before`,
        type: "income",
        amount: 5,
        category: "Boundary",
        walletId: parentId,
        walletName: "Parent wallet",
        description: "UTC month boundary",
        date: new Date(Date.UTC(year, monthNumber - 1, 1) - 1),
        userId: owner,
      },
      {
        id: `${owner}-boundary-end`,
        type: "expense",
        amount: 7,
        category: "Boundary",
        walletId: parentId,
        walletName: "Parent wallet",
        description: "UTC month boundary",
        date: new Date(Date.UTC(year, monthNumber, 1) - 1),
        userId: owner,
      },
    ],
  });
  assert.deepEqual(
    (
      await page(`/transactions?month=${month}&search=UTC%20month%20boundary`)
    ).items.map((row) => row.id),
    [`${owner}-boundary-end`],
  );
  const edited = await request(
    `/debts/${debtId}/installments/${recordId("installment", 24)}`,
    "PUT",
    { amount: 200, date: date.toISOString(), walletId: parentId },
  );
  assert.equal(edited.status, 200, edited.error);
  const updatedDebt = await db.debt.findUniqueOrThrow({
    where: { id: debtId },
  });
  assert.equal(
    z
      .array(z.object({ id: z.string(), amount: z.number() }).passthrough())
      .parse(updatedDebt.installments).length,
    25,
  );
  assert.equal(Number(updatedDebt.paidAmount), 2600);
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: parentId } })).balance,
    ),
    7400,
  );
  const denied = await request(
    `/debts/${debtId}/installments/${recordId("installment", 24)}`,
    "PUT",
    { amount: 300, date: date.toISOString(), walletId: parentId },
    otherToken,
  );
  assert.equal(denied.status, 400);
  const removed = await request(
    `/debts/${debtId}/installments/${recordId("installment", 24)}`,
    "DELETE",
  );
  assert.equal(removed.status, 200);
  assert.equal(
    (await page(`/debts?view=installments&debtId=${debtId}&pageSize=6`)).total,
    24,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: parentId } })).balance,
    ),
    7600,
  );
  const participantPage = await page(
    `/splitBills?view=participants&billId=${splitId}&pageSize=6`,
  );
  assert.equal(participantPage.total, 25);
  assert.equal(participantPage.summary?.participantCount, 25);
  assert.ok(!("participants" in participantPage.summary!));
  const participantPath = `/split-bills/${splitId}/participants/${recordId("participant", 24)}`;
  assert.equal(
    (
      await request(
        participantPath,
        "PUT",
        { paid: true, walletId: parentId },
        otherToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/public/split-bills/${splitId}/${recordId("paytoken", 24)}/pay`,
        "PUT",
        { paid: true },
      )
    ).status,
    200,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: parentId } })).balance,
    ),
    7600,
  );
  assert.equal(
    (await request(participantPath, "PUT", { paid: true, walletId: parentId }))
      .status,
    200,
  );
  assert.equal(
    (await request(participantPath, "PUT", { paid: true, walletId: parentId }))
      .status,
    200,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: parentId } })).balance,
    ),
    7700,
  );
  assert.equal(
    (
      await page(
        `/splitBills?view=participants&billId=${splitId}&reminders=true&pageSize=6`,
      )
    ).total,
    24,
  );
  assert.equal(
    (await request(participantPath, "PUT", { paid: false })).status,
    200,
  );
  assert.equal(
    Number(
      (await db.wallet.findUniqueOrThrow({ where: { id: parentId } })).balance,
    ),
    7600,
  );
  assert.equal(
    (await db.splitBill.findUniqueOrThrow({ where: { id: splitId } })).status,
    "active",
  );
  console.log(
    "PASS: 17 persisted lists; bounded/disjoint pages; server search/filter; stable summaries; tenant isolation; admin debt wallet scope; clamp/validation; paged children; lean bootstrap/full export; analytics; unseen installment mutation; public payment, owner receipt, idempotency and reversal",
  );
} finally {
  const owned = { userId: { in: [owner, foreign] } };
  await db.$transaction([
    db.transaction.deleteMany({
      where: { OR: [owned, { id: `${owner}-orphan-transaction` }] },
    }),
    db.subCategory.deleteMany({ where: owned }),
    db.category.deleteMany({ where: owned }),
    db.budget.deleteMany({ where: owned }),
    db.investment.deleteMany({ where: owned }),
    db.bill.deleteMany({ where: owned }),
    db.savingGoal.deleteMany({ where: owned }),
    db.note.deleteMany({ where: owned }),
    db.recurringTransaction.deleteMany({ where: owned }),
    db.debt.deleteMany({ where: owned }),
    db.debtContact.deleteMany({ where: owned }),
    db.card.deleteMany({ where: owned }),
    db.wishlistItem.deleteMany({ where: owned }),
    db.reimbursement.deleteMany({ where: owned }),
    db.teamMember.deleteMany({ where: owned }),
    db.splitBill.deleteMany({ where: owned }),
    db.wallet.deleteMany({ where: owned }),
    db.user.deleteMany({
      where: { id: { in: [owner, foreign, `${owner}-midnight`] } },
    }),
  ]);
  await db.$disconnect();
}
