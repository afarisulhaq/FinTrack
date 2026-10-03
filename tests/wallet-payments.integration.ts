import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { financeRoutes, resourceRoutes } from "../server/routes/finance";
import { db } from "../server/data";
import { signToken } from "../server/auth";
import { flattenWalletTree } from "../src/lib/wallets";
delete process.env.DATABASE_URL;
const app = new Elysia().use(financeRoutes).use(resourceRoutes);
const token = signToken({
  sub: "usr-demo-001",
  email: "test@example.invalid",
  role: "owner",
});
const source = db.wallets[0]!;
const destination = db.wallets[1]!;
const startSource = source.balance;
const startDestination = destination.balance;
async function request(method: string, path: string, body?: unknown) {
  const response = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  const json = await response.json();
  return { status: response.status, json };
}
const expectOk = (result: any) => {
  assert.ok(result.status < 300, JSON.stringify(result));
  return result.json.data;
};
const bill = expectOk(
  await request("POST", "/bills", {
    id: "bill-test",
    name: "Test",
    amount: 100,
    status: "unpaid",
    category: "Test",
    icon: "Receipt",
    dueDate: "2026-10-04",
  }),
);
expectOk(
  await request("PUT", `/bills/${bill.id}`, {
    status: "paid",
    walletId: source.id,
  }),
);
assert.equal(source.balance, startSource - 100);
await Promise.all([
  request("PUT", `/bills/${bill.id}`, { status: "paid", walletId: source.id }),
  request("PUT", `/bills/${bill.id}`, { status: "paid", walletId: source.id }),
]);
assert.equal(
  source.balance,
  startSource - 100,
  "repeat payment cannot double deduct",
);
expectOk(await request("PUT", `/bills/${bill.id}`, { amount: 150 }));
assert.equal(source.balance, startSource - 150);
expectOk(await request("DELETE", `/bills/${bill.id}`));
assert.equal(source.balance, startSource);
const goal = expectOk(
  await request("POST", "/savingGoals", {
    id: "goal-test",
    name: "Test",
    targetAmount: 1000,
    currentAmount: 0,
    deadline: "2027-01-01",
    walletId: destination.id,
  }),
);
const contribution = {
  contributionAmount: 200,
  contributionId: "once",
  sourceWalletId: source.id,
  walletId: destination.id,
};
expectOk(await request("PUT", `/savingGoals/${goal.id}`, contribution));
expectOk(await request("PUT", `/savingGoals/${goal.id}`, contribution));
assert.equal(source.balance, startSource - 200);
assert.equal(destination.balance, startDestination + 200);
assert.equal(
  (db.savingGoals as any[]).find((g) => g.id === goal.id).currentAmount,
  200,
);
assert.equal(
  (
    await request("PUT", `/savingGoals/${goal.id}`, {
      ...contribution,
      contributionId: "invalid",
      walletId: source.id,
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("PUT", `/savingGoals/${goal.id}`, {
      ...contribution,
      contributionId: "invalid",
      walletId: "missing",
    })
  ).status,
  400,
);
assert.equal(
  source.balance,
  startSource - 200,
  "invalid destination cannot debit source",
);
expectOk(await request("DELETE", `/savingGoals/${goal.id}`));
assert.equal(source.balance, startSource);
assert.equal(destination.balance, startDestination);
for (const direction of ["owe", "lent"]) {
  const sign = direction === "owe" ? 1 : -1;
  const debt = expectOk(
    await request("POST", "/debts", {
      id: `debt-${direction}`,
      direction,
      personName: "Test",
      amount: 500,
      paidAmount: 0,
      installments: [],
      walletId: source.id,
      isSettled: false,
    }),
  );
  assert.equal(source.balance, startSource + sign * 500);
  expectOk(
    await request("PUT", `/debts/${debt.id}`, {
      paidAmount: 100,
      installments: [
        {
          id: "payment",
          amount: 100,
          date: "2026-10-04",
          walletId: destination.id,
        },
      ],
    }),
  );
  assert.equal(destination.balance, startDestination - sign * 100);
  expectOk(
    await request("PUT", `/debts/${debt.id}`, {
      paidAmount: 200,
      installments: [
        {
          id: "payment",
          amount: 200,
          date: "2026-10-04",
          walletId: destination.id,
        },
      ],
    }),
  );
  assert.equal(destination.balance, startDestination - sign * 200);
  expectOk(await request("DELETE", `/debts/${debt.id}`));
  assert.equal(source.balance, startSource);
  assert.equal(destination.balance, startDestination);
}
const split = expectOk(
  await request("POST", "/split-bills", {
    id: "split-test",
    title: "Test",
    paidBy: "Test",
    totalAmount: 300,
    walletId: source.id,
    participants: [{ id: "participant-test", name: "Test", amount: 100 }],
  }),
);
assert.equal(source.balance, startSource - 300);
const participantPath = `/split-bills/${split.id}/participants/participant-test`;
expectOk(
  await request("PUT", participantPath, {
    paid: true,
    walletId: destination.id,
  }),
);
expectOk(
  await request("PUT", participantPath, {
    paid: true,
    walletId: destination.id,
  }),
);
assert.equal(destination.balance, startDestination + 100);
expectOk(await request("PUT", participantPath, { paid: false }));
assert.equal(destination.balance, startDestination);
expectOk(
  await request("PUT", participantPath, {
    paid: true,
    walletId: destination.id,
  }),
);
expectOk(await request("DELETE", `/split-bills/${split.id}`));
assert.equal(source.balance, startSource);
assert.equal(destination.balance, startDestination);
console.log(
  "PASS: bills, savings transfers, debt principal/installments in both directions, split initial expense/receipts, idempotency, edits, delete reversal, invalid-wallet rollback",
);

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: { getItem: () => JSON.stringify({ state: { token } }) },
    location: { origin: "http://localhost" },
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) =>
  app.handle(new Request(String(url), options));
const { useFinanceStore } = await import("../src/store/useFinanceStore");
try {
  const paymentBill = expectOk(
    await request("POST", "/bills", {
      id: "store-bill",
      name: "Store test",
      amount: 75,
      status: "unpaid",
      category: "Test",
      dueDate: "2026-10-04",
    }),
  );
  useFinanceStore.setState({
    wallets: structuredClone(db.wallets) as any,
    bills: [paymentBill],
  });
  useFinanceStore
    .getState()
    .updateBillStatus(paymentBill.id, "paid", source.id);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    flattenWalletTree(useFinanceStore.getState().wallets).find(
      (wallet) => wallet.id === source.id,
    )!.balance,
    startSource - 75,
  );
  const storeSplit = {
    title: "Store test",
    description: "",
    paidBy: "Test",
    totalAmount: 100,
    currency: "IDR",
    walletId: source.id,
    date: "2026-10-04",
    splitMethod: "equal" as const,
    status: "active" as const,
    participants: [
      { id: "store-participant", name: "Test", amount: 100, paid: false },
    ],
  };
  await useFinanceStore.getState().addSplitBill(storeSplit);
  assert.equal(
    flattenWalletTree(useFinanceStore.getState().wallets).find(
      (wallet) => wallet.id === source.id,
    )!.balance,
    startSource - 175,
  );
  const createdSplit = useFinanceStore.getState().splitBills[0]!;
  await useFinanceStore
    .getState()
    .toggleParticipantPaid(
      createdSplit.id,
      "store-participant",
      true,
      destination.id,
    );
  assert.equal(
    flattenWalletTree(useFinanceStore.getState().wallets).find(
      (wallet) => wallet.id === destination.id,
    )!.balance,
    startDestination + 100,
  );
  console.log(
    "PASS: wallet balances refresh in the client store after bill payment, split creation, and participant receipt",
  );
} finally {
  globalThis.fetch = originalFetch;
}
