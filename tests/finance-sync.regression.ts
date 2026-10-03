import assert from "node:assert/strict";
import { createFinanceSync } from "../src/lib/finance-sync";
import type { Wallet } from "../src/lib/types";

const sync = createFinanceSync();
const before = sync.snapshot();
const finishFirst = sync.beginWrite();
const finishSecond = sync.beginWrite();
let settled = false;
const waiting = sync.waitForWrites().then(() => {
  settled = true;
});
finishFirst();
await Promise.resolve();
assert.equal(settled, false);
finishSecond();
await waiting;
assert.equal(sync.isCurrent(before), false);
assert.equal(sync.isCurrent(sync.snapshot()), true);

let token = "session-a";
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: { getItem: () => JSON.stringify({ state: { token } }) },
    location: { origin: "http://localhost" },
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;
const requests: {
  path: string;
  options?: RequestInit;
  resolve: (response: Response) => void;
}[] = [];
globalThis.fetch = async (url, options) =>
  new Promise<Response>((resolve) => {
    requests.push({ path: new URL(String(url)).pathname, options, resolve });
  });
const { useFinanceStore } = await import("../src/store/useFinanceStore");
const wallet: Wallet = {
  id: "wallet",
  name: "Dompet",
  type: "cash",
  balance: 100,
  currency: "IDR",
  color: "#d97706",
  icon: "Wallet",
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const respond = (index: number, data: unknown) =>
  requests[index]!.resolve(Response.json({ success: true, data }));
try {
  useFinanceStore.setState({ wallets: [wallet] });
  const first = useFinanceStore.getState().refreshAll({ silent: true });
  const duplicate = useFinanceStore.getState().refreshAll({ silent: true });
  await settle();
  assert.equal(
    requests.length,
    1,
    "concurrent navigation and focus share one request",
  );
  assert.equal(requests[0]!.options?.cache, "no-store");
  respond(0, { wallets: [{ ...wallet, balance: 200 }] });
  assert.equal(await first, true);
  assert.equal(await duplicate, true);
  assert.equal(useFinanceStore.getState().wallets[0]!.balance, 200);

  const race = useFinanceStore.getState().refreshAll({ silent: true });
  await settle();
  useFinanceStore.getState().updateWallet(wallet.id, { balance: 300 });
  respond(1, { wallets: [{ ...wallet, balance: 100 }] });
  await settle();
  assert.equal(
    useFinanceStore.getState().wallets[0]!.balance,
    300,
    "old bootstrap cannot overwrite an optimistic edit",
  );
  respond(2, { ...wallet, balance: 300 });
  await settle();
  assert.equal(
    requests[3]!.path,
    "/api/bootstrap",
    "read repeats after the write completes",
  );
  respond(3, { wallets: [{ ...wallet, balance: 300 }] });
  assert.equal(await race, true);

  const failed = useFinanceStore.getState().refreshAll({ silent: true });
  await settle();
  requests[4]!.resolve(
    Response.json({ success: false, error: "offline" }, { status: 503 }),
  );
  assert.equal(await failed, false);
  assert.equal(useFinanceStore.getState().wallets[0]!.balance, 300);
  assert.ok(useFinanceStore.getState().syncError);
  const retry = useFinanceStore.getState().refreshAll({ silent: true });
  await settle();
  respond(5, { wallets: [] });
  assert.equal(await retry, true);
  assert.equal(
    useFinanceStore.getState().wallets.length,
    0,
    "remote deletion is applied",
  );
  assert.equal(useFinanceStore.getState().syncError, null);

  const oldSession = useFinanceStore.getState().refreshAll({ silent: true });
  await settle();
  token = "session-b";
  respond(6, { wallets: [wallet] });
  assert.equal(await oldSession, false);
  assert.equal(
    useFinanceStore.getState().wallets.length,
    0,
    "previous session response is discarded",
  );
  console.log(
    "PASS: deduplication, uncached reads, optimistic-write race, retry, failure preserves data, remote deletion, stale session",
  );
} finally {
  globalThis.fetch = originalFetch;
}
