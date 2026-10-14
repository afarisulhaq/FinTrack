import assert from "node:assert/strict";
import type { Investment } from "../src/lib/types";

Object.defineProperty(globalThis, "window", {
  value: Object.assign(new EventTarget(), {
    localStorage: {
      getItem: () => JSON.stringify({ state: { token: "test" } }),
    },
    location: { origin: "http://localhost" },
    setTimeout: globalThis.setTimeout,
  }),
  configurable: true,
});
const originalFetch = globalThis.fetch;
let respond!: (value: Response) => void;
globalThis.fetch = async () =>
  new Promise<Response>((resolve) => {
    respond = resolve;
  });
const { useFinanceStore } = await import("../src/store/useFinanceStore");
const investment: Investment = {
  id: "existing",
  name: "BBCA",
  symbol: "BBCA",
  assetClass: "stock",
  broker: "Ajaib",
  walletId: "ajaib",
  quantity: 100,
  soldQuantity: 0,
  avgBuyPrice: 1000,
  currentPrice: 1100,
  currency: "IDR",
  color: "#d97706",
  buyFee: 100,
  sellFee: null,
  sellPrice: null,
  soldAt: null,
};
const reject = async () => {
  respond(
    Response.json({ success: false, error: "Test failure" }, { status: 400 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
};
try {
  useFinanceStore.setState({ investments: [investment] });
  useFinanceStore
    .getState()
    .addInvestment({
      ...investment,
      quantity: 100,
      avgBuyPrice: 2000,
      buyFee: 200,
    });
  assert.equal(useFinanceStore.getState().investments.length, 1);
  assert.equal(useFinanceStore.getState().investments[0]!.quantity, 200);
  assert.equal(useFinanceStore.getState().investments[0]!.buyFee, 300);
  await reject();
  assert.deepEqual(
    useFinanceStore.getState().investments,
    [investment],
    "failed merged purchase restores original quantities, cost and fee",
  );
  useFinanceStore
    .getState()
    .addInvestment({ ...investment, walletId: "stockbit" });
  assert.equal(
    useFinanceStore.getState().investments.length,
    2,
    "different funding pocket cannot merge locally",
  );
  await reject();
  assert.deepEqual(useFinanceStore.getState().investments, [investment]);
  const closed = { ...investment, quantity: 0, soldQuantity: 100 };
  useFinanceStore.setState({ investments: [closed] });
  useFinanceStore.getState().addInvestment(investment);
  assert.equal(
    useFinanceStore.getState().investments.length,
    2,
    "closed holdings stay separate from a new purchase",
  );
  await reject();
  assert.deepEqual(useFinanceStore.getState().investments, [closed]);
  console.log(
    "PASS: funding-wallet isolation, fee merge, closed-position isolation, failed-buy rollback",
  );
} finally {
  globalThis.fetch = originalFetch;
}
