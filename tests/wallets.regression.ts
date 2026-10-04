import assert from "node:assert/strict";
import {
  flattenWalletTree,
  walletOptionLabel,
  normalizeWalletTree,
  totalWalletBalance,
  walletGroupBalance,
  updateWalletTree,
} from "../src/lib/wallets";
import type { Wallet } from "../src/lib/types";

const make = (id: string, balance: number, parentId?: string): Wallet => ({
  id,
  balance,
  parentId,
  name: id,
  type: "bank",
  currency: "IDR",
  color: "#d97706",
  icon: "Wallet",
});
const child = make("child", 100, "parent");
const parent = { ...make("parent", 200), children: [child] };
const other = make("other", 300);
const tree = [parent, other];
assert.equal(totalWalletBalance(tree), 600);
assert.equal(walletGroupBalance(parent), 300);
assert.equal(totalWalletBalance([parent, child, other]), 600);
const edited = updateWalletTree(tree, "child", { balance: 150 });
assert.equal(edited.length, 2);
assert.equal(walletGroupBalance(edited[0]), 350);
assert.equal(totalWalletBalance(edited), 650);
const moved = updateWalletTree(edited, "child", { parentId: "other" });
assert.equal(moved.length, 2);
assert.equal(moved[0].children?.length, 0);
assert.equal(moved[1].children?.[0].balance, 150);
assert.equal(totalWalletBalance(moved), 650);
assert.equal(
  updateWalletTree(tree, "child", { parentId: undefined }).length,
  3,
);
assert.equal(
  totalWalletBalance(normalizeWalletTree([make("orphan", 50, "missing")])),
  50,
);
assert.equal(
  totalWalletBalance(
    normalizeWalletTree([make("a", 10, "b"), make("b", 20, "a")]),
  ),
  30,
);

const nested = {
  ...make("bank", 0),
  children: [{ ...make("pocket", 0), children: [make("holiday", 0)] }],
};
const nestedOptions = flattenWalletTree([nested]);
assert.equal(walletOptionLabel(nestedOptions[2], [nested]), "bank > pocket > holiday");
assert.equal(walletOptionLabel(other, tree), "other");
assert.equal(walletOptionLabel(make("a", 0, "b"), [make("a", 0, "b"), make("b", 0, "a")]), "b > a");

const storage = {
  getItem: (key: string) =>
    key === "fintrack_auth"
      ? JSON.stringify({ state: { token: "test-token" } })
      : null,
  setItem: () => {},
  removeItem: () => {},
};
Object.defineProperty(globalThis, "window", {
  value: { localStorage: storage, location: { origin: "http://localhost" } },
  configurable: true,
});
let calls = 0;
let resolveFetch: (response: Response) => void = () => {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  calls++;
  return new Promise<Response>((resolve) => {
    resolveFetch = resolve;
  });
};
const { useFinanceStore } = await import("../src/store/useFinanceStore");
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
try {
  useFinanceStore.setState({ wallets: tree });
  useFinanceStore
    .getState()
    .updateWallet("child", { balance: 150, parentId: "parent" });
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 650);
  resolveFetch(
    Response.json({ success: true, data: { ...child, balance: 150 } }),
  );
  await settle();
  assert.equal(
    calls,
    1,
    "editing must not replace all wallets through a second fetch",
  );
  assert.equal(useFinanceStore.getState().wallets.length, 2);
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 650);
  useFinanceStore.getState().updateWallet("child", { balance: 999 });
  resolveFetch(
    Response.json({ success: false, error: "Test rejection" }, { status: 400 }),
  );
  await settle();
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 650);
  assert.equal(
    flattenWalletTree(useFinanceStore.getState().wallets).find(
      (w) => w.id === "child",
    )?.balance,
    150,
  );
  useFinanceStore
    .getState()
    .hydrateFromBackend({
      wallets: [
        { ...make("parent", 200), children: [{ ...child, balance: 175 }] },
        other,
      ],
    });
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 675);
  useFinanceStore.getState().deleteWallet("child");
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 500);
  resolveFetch(
    Response.json({ success: false, error: "Test rejection" }, { status: 400 }),
  );
  await settle();
  assert.equal(totalWalletBalance(useFinanceStore.getState().wallets), 675);
  console.log(
    "PASS: nested/flat deduplication, group/overall balances, child edits, move/detach, orphan/cycle recovery, save response, no extra fetch, rollback, hydration, child deletion rollback",
  );
} finally {
  globalThis.fetch = originalFetch;
}
