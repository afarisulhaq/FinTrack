import assert from "node:assert/strict";
import {
  invalidateServerLists,
  removePageRecords,
  setPageRecords,
  subscribePageRecords,
  subscribeServerListInvalidation,
} from "../src/lib/page-records";

Object.defineProperty(globalThis, "window", {
  value: Object.assign(new EventTarget(), { location: { origin: "http://localhost" } }),
  configurable: true,
});
const reloads = { wallets: 0, business: 0, otherBusiness: 0, notes: 0 };
const unsubscribeWallets = subscribeServerListInvalidation("/wallets/?view=parents", () => reloads.wallets++);
const unsubscribeBusiness = subscribeServerListInvalidation("/businesses/company/transactions?page=2", () => reloads.business++);
const unsubscribeOther = subscribeServerListInvalidation("/businesses/company-other/transactions", () => reloads.otherBusiness++);
const unsubscribeNotes = subscribeServerListInvalidation("/notes", () => reloads.notes++);
try {
  invalidateServerLists(["/wallets-other", "/transactions"]);
  assert.deepEqual(reloads, { wallets: 0, business: 0, otherBusiness: 0, notes: 0 });
  invalidateServerLists(["/wallets"]);
  assert.deepEqual(reloads, { wallets: 1, business: 0, otherBusiness: 0, notes: 0 });
  invalidateServerLists(["/businesses/company"]);
  assert.deepEqual(reloads, { wallets: 1, business: 1, otherBusiness: 0, notes: 0 });
  invalidateServerLists(["/businesses"]);
  assert.deepEqual(reloads, { wallets: 1, business: 2, otherBusiness: 1, notes: 0 });
  unsubscribeWallets();
  invalidateServerLists("all");
  assert.deepEqual(reloads, { wallets: 1, business: 3, otherBusiness: 2, notes: 1 });
} finally {
  unsubscribeWallets();
  unsubscribeBusiness();
  unsubscribeOther();
  unsubscribeNotes();
}

const snapshots: { token: string; ids: string[] }[] = [];
const unsubscribeRecords = subscribePageRecords((resource, rows, token) => {
  if (resource === "notes") snapshots.push({ token, ids: rows.map((row) => row.id) });
});
try {
  setPageRecords("page-a", "notes", [{ id: "visible-a" }], "account-a");
  setPageRecords("page-b", "notes", [{ id: "private-b" }], "account-b");
  setPageRecords("page-a", "notes", [{ id: "updated-a" }], "account-a");
  assert.deepEqual(snapshots, [
    { token: "account-a", ids: ["visible-a"] },
    { token: "account-b", ids: ["private-b"] },
    { token: "account-a", ids: ["updated-a"] },
  ], "publishing a new page replaces rows without an empty snapshot or cross-account records");
  removePageRecords("page-a");
  assert.deepEqual(snapshots.at(-1), { token: "account-a", ids: [] });
} finally {
  unsubscribeRecords();
  removePageRecords("page-a");
  removePageRecords("page-b");
}
console.log("PASS: scoped refresh, slash boundaries, nested resources, explicit all, unsubscribe, stable account-isolated page replacement");
