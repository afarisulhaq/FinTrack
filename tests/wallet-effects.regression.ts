import assert from "node:assert/strict";
import {
  reconcileWalletEffects,
  resourceWalletUpdate,
} from "../server/services/wallet-effects";
import { toggleSplitWalletPayment } from "../server/services/split-wallet-payments";
const wallets = new Map([
  ["source", { id: "source", userId: "owner", currency: "IDR", balance: 500 }],
  [
    "destination",
    { id: "destination", userId: "owner", currency: "IDR", balance: 100 },
  ],
  [
    "foreign",
    { id: "foreign", userId: "other", currency: "IDR", balance: 100 },
  ],
]);
const bill: any = {
  id: "split",
  userId: "owner",
  status: "active",
  participants: [
    { id: "participant", amount: 50, paid: false, walletEffects: [] },
  ],
};
let locks = 0;
const client = {
  $queryRawUnsafe: async () => {
    locks++;
  },
  wallet: {
    findFirst: async ({ where }: any) => {
      const wallet = wallets.get(where.id);
      return wallet && (!where.userId || wallet.userId === where.userId)
        ? wallet
        : null;
    },
    update: async ({ where, data }: any) => {
      const wallet = wallets.get(where.id)!;
      wallet.balance += data.balance.increment;
      return wallet;
    },
  },
  splitBill: {
    findFirst: async ({ where }: any) =>
      where.id === bill.id && (!where.userId || where.userId === bill.userId)
        ? bill
        : null,
    update: async ({ data }: any) => Object.assign(bill, data),
  },
  splitBillParticipant: {
    update: async ({ where, data }: any) =>
      Object.assign(
        bill.participants.find((p: any) => p.id === where.id),
        data,
      ),
  },
};
async function transaction(fn: () => Promise<unknown>) {
  const snapshot = structuredClone(wallets);
  const oldBill = structuredClone(bill);
  try {
    return await fn();
  } catch (error) {
    wallets.clear();
    for (const [id, wallet] of snapshot) wallets.set(id, wallet);
    Object.assign(bill, oldBill);
    throw error;
  }
}
await assert.rejects(
  transaction(() =>
    reconcileWalletEffects(
      client,
      [],
      [
        { key: "out", walletId: "source", amount: -50 },
        { key: "in", walletId: "foreign", amount: 50 },
      ],
      "owner",
    ),
  ),
);
assert.equal(wallets.get("source")!.balance, 500);
assert.equal(wallets.get("foreign")!.balance, 100);
await transaction(() =>
  toggleSplitWalletPayment(
    client,
    "split",
    "participant",
    true,
    undefined,
    "owner",
    true,
  ),
);
assert.equal(
  wallets.get("destination")!.balance,
  100,
  "public paid claim cannot automatically credit a wallet",
);
await transaction(() =>
  toggleSplitWalletPayment(
    client,
    "split",
    "participant",
    true,
    "destination",
    "owner",
  ),
);
assert.equal(wallets.get("destination")!.balance, 150);
await transaction(() =>
  toggleSplitWalletPayment(
    client,
    "split",
    "participant",
    true,
    "destination",
    "owner",
  ),
);
assert.equal(wallets.get("destination")!.balance, 150);
await assert.rejects(
  transaction(() =>
    toggleSplitWalletPayment(
      client,
      "split",
      "wrong-participant",
      false,
      undefined,
      "owner",
    ),
  ),
);
await assert.rejects(
  transaction(() =>
    toggleSplitWalletPayment(
      client,
      "split",
      "participant",
      false,
      undefined,
      "other",
    ),
  ),
);
await transaction(() =>
  toggleSplitWalletPayment(
    client,
    "split",
    "participant",
    false,
    undefined,
    "owner",
    true,
  ),
);
assert.equal(wallets.get("destination")!.balance, 100);
assert.equal(bill.status, "active");
assert.ok(locks > 0);
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
console.log(
  "PASS: scoped-wallet validation, transaction rollback, parent locking, participant scope, public claims do not credit wallets, owner confirmation, idempotency, cancellation reversal, internal effects protected, legacy records",
);
