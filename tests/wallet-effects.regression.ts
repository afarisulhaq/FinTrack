import assert from "node:assert/strict";
import { resourceWalletUpdate } from "../server/services/wallet-effects";
const changes = resourceWalletUpdate(
  "bills",
  { status: "unpaid", amount: 20, walletEffects: [] },
  {
    status: "paid",
    walletId: "source",
    walletEffects: [{ walletId: "foreign", amount: 999 }],
  },
);
assert.deepEqual(changes.walletEffects, [
  { key: "payment", walletId: "source", amount: -20 },
]);
assert.deepEqual(
  resourceWalletUpdate(
    "bills",
    { status: "paid", amount: 20, walletEffects: [] },
    { name: "Legacy edit" },
  ).walletEffects,
  [],
);
console.log("PASS: internal wallet effects protected and legacy records retained");
