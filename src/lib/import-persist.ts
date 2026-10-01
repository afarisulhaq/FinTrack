import { api } from "./api";
import type { BackupBundle } from "./import-export";
import type { Transaction, Wallet } from "./types";

type RecordWithId = { id: string; [key: string]: unknown };
type ImportCollection = Exclude<keyof BackupBundle, "version" | "exportedAt" | "appName">;

const collectionOrder: ImportCollection[] = [
  "categories", "subCategories", "wallets", "transactions", "budgets",
  "investments", "bills", "savingGoals", "debts", "cards", "wishlist",
  "reimbursements", "notes", "recurringTransactions", "splitBills",
];

const resourcePath: Record<ImportCollection, string> = {
  categories: "/categories",
  subCategories: "/subCategories",
  wallets: "/wallets",
  transactions: "/transactions",
  budgets: "/budgets",
  investments: "/investments",
  bills: "/bills",
  savingGoals: "/savingGoals",
  debts: "/debts",
  cards: "/cards",
  wishlist: "/wishlist",
  reimbursements: "/reimbursements",
  notes: "/notes",
  recurringTransactions: "/recurringTransactions",
  splitBills: "/split-bills",
};

export function flattenWalletList(wallets: readonly Wallet[]): Wallet[] {
  return wallets.flatMap((wallet) => {
    const { children, ...parent } = wallet;
    return [parent, ...(children ?? []).map((child) => ({ ...child, parentId: wallet.id }))];
  });
}

function recordsFor(bundle: BackupBundle, key: ImportCollection): RecordWithId[] {
  if (key === "wallets") return flattenWalletList(bundle.wallets) as unknown as RecordWithId[];
  if (key === "categories") return bundle.categories.map(({ subCategories: _children, ...category }) => category) as unknown as RecordWithId[];
  return bundle[key] as unknown as RecordWithId[];
}

function cleanRecord(key: ImportCollection, record: RecordWithId): RecordWithId {
  const { userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = record;
  if (key === "wallets") {
    const { isArchived: _isArchived, children: _children, ...wallet } = data;
    return wallet;
  }
  if (key === "transactions") {
    const { tags: _tags, receiptUrl: _receiptUrl, isRecurring: _isRecurring, recurringId: _recurringId, ...transaction } = data;
    return transaction;
  }
  if (key === "splitBills") {
    const { participants, ...bill } = data;
    return {
      ...bill,
      participants: Array.isArray(participants)
        ? participants.map((participant) => {
            const { createdAt: _created, updatedAt: _updated, ...person } = participant as RecordWithId;
            return person;
          })
        : [],
    };
  }
  return data;
}

export interface ImportProgress {
  added: number;
  skipped: number;
}

export async function persistBackup(
  bundle: BackupBundle,
  token: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  const existing = await api.bootstrap<BackupBundle>(token);
  const progress = { added: 0, skipped: 0 };
  for (const key of collectionOrder) {
    const known = new Set(recordsFor(existing, key).map((item) => item.id));
    for (const item of recordsFor(bundle, key)) {
      if (known.has(item.id)) {
        progress.skipped += 1;
        onProgress?.({ ...progress });
        continue;
      }
      try {
        await api.post(key === "investments" || key === "transactions" ? `${resourcePath[key]}?restore=1` : resourcePath[key], token, cleanRecord(key, item));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${key}: ${item.id || "tanpa ID"} gagal disimpan (${reason}). ${progress.added} data sudah tersimpan; ulangi import untuk melanjutkan.`);
      }
      known.add(item.id);
      progress.added += 1;
      onProgress?.({ ...progress });
    }
  }
  return progress;
}

export async function persistTransactions(
  transactions: readonly Transaction[],
  token: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  const existing = await api.get<Transaction[]>("/transactions", token);
  const known = new Set(existing.map((item) => item.id));
  const progress = { added: 0, skipped: 0 };
  for (const transaction of transactions) {
    if (known.has(transaction.id)) {
      progress.skipped += 1;
      onProgress?.({ ...progress });
      continue;
    }
    const { tags: _tags, receiptUrl: _receiptUrl, isRecurring: _isRecurring, recurringId: _recurringId, ...data } = transaction;
    try {
      await api.post("/transactions", token, data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Transaksi ${transaction.id} gagal disimpan (${reason}). ${progress.added} transaksi sudah tersimpan; ulangi import untuk melanjutkan.`);
    }
    known.add(transaction.id);
    progress.added += 1;
    onProgress?.({ ...progress });
  }
  return progress;
}
