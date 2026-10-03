import assert from "node:assert/strict";
import * as React from "react";
import type { Debt } from "../src/lib/types";
import { AmountInput } from "../src/components/ui/amount-input";

let deferred: () => void = () => {};
Object.defineProperty(globalThis, "React", {
  value: React,
  configurable: true,
});
let raw = "";
const input = {
  value: "",
  selectionStart: 0,
  setCustomValidity() {},
  setSelectionRange() {},
};
const element = (AmountInput as any).render(
  {
    value: "",
    onChange: (event: any) => {
      deferred = () => {
        raw = event.target.value;
      };
    },
  },
  null,
);
for (const digit of "1000000") {
  input.value += digit;
  input.selectionStart = input.value.length;
  element.props.onChange({ currentTarget: input, target: input });
  deferred();
}
assert.equal(input.value, "1.000.000");
assert.equal(
  raw,
  "1000000",
  "deferred React updater must receive the unformatted amount",
);
assert.equal(Number(raw), 1000000);

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
let reject = false;
let payload: any;
globalThis.fetch = async (_url, options) => {
  if (!options?.method || options.method === "GET")
    return Response.json({ success: true, data: [] });
  payload = JSON.parse(String(options?.body));
  return reject
    ? Response.json({ success: false, error: "Rejected" }, { status: 400 })
    : Response.json({ success: true, data: payload });
};
const { useFinanceStore } = await import("../src/store/useFinanceStore");
const debt: Debt = {
  id: "debt",
  direction: "owe",
  personName: "Contact",
  amount: 2000000,
  paidAmount: 1500000,
  isSettled: false,
  description: "Test",
  createdAt: "2026-10-04",
  installments: [
    { id: "first", amount: 1000000, date: "2026-10-04" },
    { id: "second", amount: 500000, date: "2026-10-04" },
  ],
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
try {
  useFinanceStore.setState({ debts: [debt] });
  useFinanceStore.getState().updateDebtInstallment("debt", "second", {
    amount: 1000000,
    date: "2026-10-04",
    note: "Edited",
  });
  await settle();
  assert.equal(payload.paidAmount, 2000000);
  assert.equal(useFinanceStore.getState().debts[0]!.isSettled, true);
  useFinanceStore.getState().deleteDebtInstallment("debt", "first");
  await settle();
  assert.equal(useFinanceStore.getState().debts[0]!.paidAmount, 1000000);
  assert.equal(useFinanceStore.getState().debts[0]!.isSettled, false);
  assert.equal(useFinanceStore.getState().debts[0]!.installments.length, 1);
  reject = true;
  useFinanceStore.getState().deleteDebtInstallment("debt", "second");
  await settle();
  assert.equal(useFinanceStore.getState().debts[0]!.paidAmount, 1000000);
  assert.equal(useFinanceStore.getState().debts[0]!.installments.length, 1);
  useFinanceStore
    .getState()
    .updateDebtInstallment("debt", "second", { amount: 1, date: "2026-10-04" });
  await settle();
  assert.equal(useFinanceStore.getState().debts[0]!.paidAmount, 1000000);
  console.log(
    "PASS: sequential rupiah typing, deferred updater raw value, installment edit/delete, settlement recalculation, failed-save rollback",
  );
} finally {
  globalThis.fetch = originalFetch;
}
