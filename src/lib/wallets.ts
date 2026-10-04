import type { Wallet } from "./types";

export function flattenWalletTree(wallets: Wallet[]): Wallet[] {
  const records = new Map<string, Wallet>();
  function visit(wallet: Wallet, parentId?: string) {
    const { children, ...record } = wallet;
    records.set(wallet.id, {
      ...record,
      parentId: record.parentId ?? parentId,
    });
    for (const child of children ?? []) visit(child, wallet.id);
  }
  for (const wallet of wallets) visit(wallet);
  return [...records.values()];
}

export function normalizeWalletTree(wallets: Wallet[]): Wallet[] {
  const records = flattenWalletTree(wallets);
  const byId = new Map(
    records.map((wallet) => [
      wallet.id,
      { ...wallet, children: [] as Wallet[] },
    ]),
  );
  const roots: Wallet[] = [];
  for (const wallet of byId.values()) {
    const seen = new Set([wallet.id]);
    let ancestor = wallet.parentId;
    let cyclic = false;
    while (ancestor && byId.has(ancestor)) {
      if (seen.has(ancestor)) {
        cyclic = true;
        break;
      }
      seen.add(ancestor);
      ancestor = byId.get(ancestor)?.parentId;
    }
    const parent =
      wallet.parentId && !cyclic ? byId.get(wallet.parentId) : undefined;
    if (parent) parent.children.push(wallet);
    else {
      wallet.parentId = undefined;
      roots.push(wallet);
    }
  }
  return roots;
}

export function walletGroupBalance(wallet: Wallet): number {
  return flattenWalletTree([wallet]).reduce(
    (sum, item) => sum + item.balance,
    0,
  );
}

export function totalWalletBalance(wallets: Wallet[]): number {
  return flattenWalletTree(wallets).reduce(
    (sum, wallet) => sum + wallet.balance,
    0,
  );
}

export function updateWalletTree(
  wallets: Wallet[],
  id: string,
  changes: Partial<Wallet>,
): Wallet[] {
  return normalizeWalletTree(
    flattenWalletTree(wallets).map((wallet) =>
      wallet.id === id
        ? { ...wallet, ...changes, children: undefined }
        : wallet,
    ),
  );
}

export function walletOptionLabel(wallet: Wallet, wallets: Wallet[]): string {
  const byId = new Map(flattenWalletTree(wallets).map((item) => [item.id, item]));
  const names = [wallet.name];
  const seen = new Set([wallet.id]);
  let parentId = wallet.parentId ?? byId.get(wallet.id)?.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" > ");
}
