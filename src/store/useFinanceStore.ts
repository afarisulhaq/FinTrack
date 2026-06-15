"use client";

import { create } from "zustand";
import { api, getApiBaseUrl } from "~/lib/api";
import { genId } from "~/lib/utils";
import { toast } from "~/components/ui/toast";
import { useAppConfigStore, type AppConfig } from "./useAppConfigStore";
import type {
  Wallet,
  Transaction,
  Budget,
  Investment,
  Bill,
  BillStatus,
  SavingGoal,
  Debt,
  Card,
  WishlistItem,
  Reimbursement,
  Note,
  RecurringTransaction,
  GamificationState,
  UserProfile,
  TeamMember,
  NotificationSettings,
  SplitBill,
  SplitBillParticipant,
  Category,
  CategoryKind,
  SubCategory,
} from "~/lib/types";

const emptyGamification: GamificationState = {
  totalXP: 0,
  level: 1,
  levelName: "Pemula Finansial",
  healthScore: 0,
  breakdown: { savings: 0, budget: 0, debt: 0, investment: 0 },
  currentStreak: 0,
  longestStreak: 0,
  zeroSpendStreak: 0,
  totalZeroSpendDays: 0,
  badges: [],
  lastUpdated: new Date(0).toISOString(),
};

const emptyUserProfile: UserProfile = {
  id: "",
  name: "",
  email: "",
  currency: "IDR",
  language: "id",
  timezone: "Asia/Jakarta",
  joinedAt: new Date(0).toISOString(),
};

const emptyNotificationSettings: NotificationSettings = {
  channels: {
    whatsapp: { enabled: false, phone: "" },
    telegram: { enabled: false, chatId: "", botToken: "" },
    email: { enabled: false, address: "" },
    push: { enabled: false },
  },
  preferences: {
    dailyReminder: false,
    dailyReminderTime: "08:00",
    weeklyReport: false,
    weeklyReportDay: 1,
    monthlyReport: false,
    budgetAlert: false,
    budgetAlertThreshold: 80,
    billReminder: false,
    billReminderDays: 3,
    savingGoalUpdate: false,
    debtReminder: false,
    largeTransactionAlert: false,
    largeTransactionThreshold: 1000000,
  },
};

function getBackendToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("fintrack_auth");
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    return token && token !== "dev-fallback-token" ? String(token) : null;
  } catch {
    return null;
  }
}

export type PersistResult<T> =
  | { ok: true; data: T | null }
  | { ok: false; error: string; offline?: boolean };

/**
 * Fire a write to the backend and surface the outcome. Callers should
 * use this to decide whether to **roll back** their optimistic update
 * and to notify the user (toast) about the failure.
 *
 * Returns:
 *   - `{ ok: true, data }` on 2xx (data may be null for DELETE)
 *   - `{ ok: false, error, offline: true }` on network / no-token failures
 *   - `{ ok: false, error }` on 4xx/5xx (error is the server message)
 */
async function persistResource<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<PersistResult<T>> {
  const token = getBackendToken();
  if (!token) {
    return { ok: false, error: "Tidak ada sesi login", offline: true };
  }
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    console.warn("Backend request failed (network):", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Tidak bisa terhubung ke server",
      offline: true,
    };
  }
  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
  } | null;
  if (!response.ok || json?.success === false) {
    const error = json?.error ?? `Server error (${response.status})`;
    return { ok: false, error };
  }
  return { ok: true, data: json?.data ?? null };
}

/**
 * High-level wrapper that combines `persistResource` with toast
 * notifications and an optional rollback hook. Keeps the call sites
 * readable while ensuring every action surfaces success/failure the
 * same way.
 */
async function withPersist<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown | undefined,
  opts: {
    /**
     * Called on 2xx with the server's data. Use to overwrite the
     * optimistic local item (e.g. swap in the server-assigned id).
     */
    onSuccess?: (data: T | null) => void;
    /**
     * Called on failure with the error + whether the request never
     * reached the server (offline). Use to undo the optimistic update.
     */
    onError?: (error: string, offline: boolean) => void;
    /** Title for the error toast. */
    errorTitle?: string;
    /** Optional success toast title (omit to keep silent). */
    successTitle?: string;
  } = {},
): Promise<PersistResult<T>> {
  const result = await persistResource<T>(path, method, body);
  if (!result.ok) {
    opts.onError?.(result.error, !!result.offline);
    toast.error(
      opts.errorTitle ?? "Gagal menyimpan perubahan",
      result.offline
        ? `${result.error} (offline — perubahan dibatalkan)`
        : result.error,
    );
  } else {
    opts.onSuccess?.(result.data);
    if (opts.successTitle) toast.success(opts.successTitle);
  }
  return result;
}

// ── Store Interface ───────────────────────────────────────────────────────────

/**
 * Merge-by-ID: keep local records (with their in-flight optimistic
 * updates), overlay whatever the server returned for the same id, and
 * append any server-only records. The order is preserved from the
 * client array so the user’s own sort/filter stays intact.
 */
function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[] | undefined,
  mergeItem: (local: T, remote: T) => T = (l, r) => ({ ...l, ...r }),
): T[] {
  if (!remote) return local;
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const merged = local.map((item) => {
    seen.add(item.id);
    const r = remoteById.get(item.id);
    return r ? mergeItem(item, r) : item;
  });
  for (const r of remote) {
    if (!seen.has(r.id)) merged.push(r);
  }
  return merged;
}

interface BootstrapData {
  wallets?: Wallet[];
  transactions?: Transaction[];
  budgets?: Budget[];
  investments?: Investment[];
  bills?: Bill[];
  savingGoals?: SavingGoal[];
  debts?: Debt[];
  cards?: Card[];
  wishlist?: WishlistItem[];
  reimbursements?: Reimbursement[];
  notes?: Note[];
  recurringTransactions?: RecurringTransaction[];
  splitBills?: SplitBill[];
  categories?: Category[];
  subCategories?: SubCategory[];
  appConfig?: Partial<AppConfig>;
}

interface FinanceStore {
  // ── State ──────────────────────────────────────────────────────────────────
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  bills: Bill[];
  savingGoals: SavingGoal[];
  debts: Debt[];
  cards: Card[];
  wishlist: WishlistItem[];
  reimbursements: Reimbursement[];
  notes: Note[];
  recurringTransactions: RecurringTransaction[];
  splitBills: SplitBill[];
  categories: Category[];
  subCategories: SubCategory[];
  gamification: GamificationState;

  // ── Wallet Actions ─────────────────────────────────────────────────────────
  addWallet: (wallet: Omit<Wallet, "id">) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;

  // ── Transaction Actions ────────────────────────────────────────────────────
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // ── Budget Actions ─────────────────────────────────────────────────────────
  addBudget: (budget: Omit<Budget, "id">) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // ── Investment Actions ─────────────────────────────────────────────────────
  addInvestment: (investment: Omit<Investment, "id">) => void;
  updateInvestment: (id: string, updates: Partial<Investment>) => void;
  deleteInvestment: (id: string) => void;

  // ── Split Bill Actions ─────────────────────────────────────────────────────────
  addSplitBill: (
    bill: Omit<SplitBill, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  updateSplitBill: (id: string, updates: Partial<SplitBill>) => Promise<void>;
  toggleParticipantPaid: (
    billId: string,
    participantId: string,
    paid: boolean,
  ) => Promise<void>;
  deleteSplitBill: (id: string) => Promise<void>;
  refreshSplitBills: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  refreshBudgets: () => Promise<void>;
  refreshSavingGoals: () => Promise<void>;

  // ── Category & Sub-Category Actions ───────────────────────────────────────
  addCategory: (
    category: Omit<
      Category,
      "id" | "createdAt" | "updatedAt" | "subCategories"
    >,
  ) => Promise<Category | null>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addSubCategory: (
    sub: Omit<SubCategory, "id" | "createdAt" | "updatedAt">,
  ) => Promise<SubCategory | null>;
  updateSubCategory: (
    id: string,
    updates: Partial<SubCategory>,
  ) => Promise<void>;
  deleteSubCategory: (id: string) => Promise<void>;
  refreshCategories: () => Promise<void>;
  /**
   * Pull a full bootstrap snapshot from the server and run it through
   * the merge-by-ID path. Used by the manual “Sync” button in the top
   * bar and exposed in case other surfaces want to force a refresh.
   */
  refreshAll: () => Promise<boolean>;
  /**
   * Convenience: find or create a master Category by name + type.
   * Returns the resulting Category (with sub-categories) so the caller
   * can immediately use its id.
   */
  ensureCategory: (
    name: string,
    type: CategoryKind,
    icon?: string,
    color?: string,
  ) => Promise<Category | null>;
  /**
   * Convenience: find or create a SubCategory under a master Category.
   * Returns the SubCategory.
   */
  ensureSubCategory: (
    categoryId: string,
    name: string,
    icon?: string,
    color?: string,
  ) => Promise<SubCategory | null>;

  // ── Bill Actions ───────────────────────────────────────────────────────────
  addBill: (bill: Omit<Bill, "id">) => void;
  updateBillStatus: (id: string, status: BillStatus) => void;
  updateBill: (id: string, updates: Partial<Bill>) => void;
  deleteBill: (id: string) => void;

  // ── Saving Goal Actions ────────────────────────────────────────────────────
  addSavingGoal: (goal: Omit<SavingGoal, "id">) => void;
  updateSavingGoal: (id: string, updates: Partial<SavingGoal>) => void;
  deleteSavingGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number) => void;

  // ── Debt Actions ───────────────────────────────────────────────────────────
  addDebt: (debt: Omit<Debt, "id">) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addDebtInstallment: (
    debtId: string,
    installment: { amount: number; date: string; note?: string },
  ) => void;
  settleDebt: (id: string) => void;

  // ── Card Actions ───────────────────────────────────────────────────────────
  addCard: (card: Omit<Card, "id">) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;

  // ── Wishlist Actions ───────────────────────────────────────────────────────
  addWishlistItem: (item: Omit<WishlistItem, "id" | "createdAt">) => void;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  toggleWishlistPurchased: (id: string) => void;
  deleteWishlistItem: (id: string) => void;

  // ── Reimbursement Actions ──────────────────────────────────────────────────
  addReimbursement: (r: Omit<Reimbursement, "id">) => void;
  updateReimbursement: (id: string, updates: Partial<Reimbursement>) => void;
  settleReimbursement: (id: string) => void;
  deleteReimbursement: (id: string) => void;

  // ── Note Actions ───────────────────────────────────────────────────────────
  addNote: (note: Omit<Note, "id" | "createdAt" | "updatedAt">) => void;
  updateNote: (
    id: string,
    updates: Partial<Omit<Note, "id" | "createdAt">>,
  ) => void;
  deleteNote: (id: string) => void;

  // ── Recurring Transaction Actions ──────────────────────────────────────────
  addRecurringTransaction: (rt: Omit<RecurringTransaction, "id">) => void;
  updateRecurringTransaction: (
    id: string,
    updates: Partial<RecurringTransaction>,
  ) => void;
  toggleRecurringTransaction: (id: string) => void;
  deleteRecurringTransaction: (id: string) => void;

  // ── Gamification ────────────────────────────────────────────────────────────
  updateGamification: (updates: Partial<GamificationState>) => void;
  unlockBadge: (badgeId: string) => void;

  // ── User Profile ────────────────────────────────────────────────────────────
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;

  // ── Team Members ────────────────────────────────────────────────────────────
  teamMembers: TeamMember[];
  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void;
  removeTeamMember: (id: string) => void;

  // ── Notification Settings ────────────────────────────────────────────────────
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;

  /**
   * Timestamp (ms) of the last successful backend sync. `null` until
   * the first fetch completes. Surfaced in the topbar so the user can
   * tell at a glance whether the data on screen is fresh.
   */
  lastSyncedAt: number | null;

  // ── Backend Hydration ──────────────────────────────────────────────────────
  hydrateFromBackend: (data: BootstrapData) => void;
}

// ─── Store Implementation ──────────────────────────────────────────────────────

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  wallets: [],
  transactions: [],
  budgets: [],
  investments: [],
  bills: [],
  savingGoals: [],
  debts: [],
  cards: [],
  wishlist: [],
  reimbursements: [],
  notes: [],
  recurringTransactions: [],
  splitBills: [],
  categories: [],
  subCategories: [],
  gamification: emptyGamification,
  userProfile: emptyUserProfile,
  teamMembers: [],
  notificationSettings: emptyNotificationSettings,
  lastSyncedAt: null,

  hydrateFromBackend: (data) => {
    if (data.appConfig) {
      useAppConfigStore
        .getState()
        .hydrateFromBackend(data.appConfig as Partial<AppConfig>);
    }
    return set((state) => {
      // Merge-by-ID strategy: for every array the server sent, keep the
      // local optimistic record if it has the same id (so in-flight edits
      // don’t get clobbered), add any record we don’t have yet, and keep
      // local records the server has not seen (e.g. offline writes).
      return {
        wallets: mergeById(state.wallets, data.wallets),
        transactions: mergeById(state.transactions, data.transactions),
        budgets: mergeById(state.budgets, data.budgets),
        investments: (data.investments ?? state.investments).map((inv) => ({
          ...inv,
          symbol: inv.symbol.replace(/\.JK$/, ""),
        })),
        bills: mergeById(state.bills, data.bills),
        savingGoals: mergeById(state.savingGoals, data.savingGoals),
        debts: mergeById(state.debts, data.debts),
        cards: mergeById(state.cards, data.cards),
        wishlist: mergeById(state.wishlist, data.wishlist),
        reimbursements: mergeById(state.reimbursements, data.reimbursements),
        notes: mergeById(state.notes, data.notes),
        recurringTransactions: mergeById(
          state.recurringTransactions,
          data.recurringTransactions,
        ),
        splitBills: mergeById(state.splitBills, data.splitBills),
        categories: mergeById(state.categories, data.categories, (a, b) =>
          // Always take the server’s fresh `subCategories` since
          // sub-categories are managed as a separate sub-resource.
          ({ ...a, ...b, subCategories: b.subCategories ?? a.subCategories }),
        ),
        subCategories: mergeById(state.subCategories, data.subCategories),
        lastSyncedAt: Date.now(),
      };
    });
  },

  // ── Wallet Actions ─────────────────────────────────────────────────────────

  addWallet: (wallet) => {
    const item = { ...wallet, id: genId() };
    // Optimistic insert — if the server rejects (or we’re offline),
    // withPersist’s onError hook will remove it again.
    set((state) => ({ wallets: [...state.wallets, item] }));
    void withPersist<Wallet>("/wallets", "POST", item, {
      onSuccess: (serverItem) => {
        if (!serverItem) return;
        // Server echoes the wallet back (with its own ID metadata). Swap
        // the optimistic record so subsequent fetches don’t see a ghost.
        set((state) => ({
          wallets: state.wallets.map((w) =>
            w.id === item.id ? serverItem : w,
          ),
        }));
      },
      onError: () => {
        set((state) => ({
          wallets: state.wallets.filter((w) => w.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah dompet",
    });
  },

  updateWallet: (id, updates) => {
    // Snapshot the pre-update record so we can restore on failure.
    const previous = get().wallets.find((w) => w.id === id);
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    }));
    void withPersist<Wallet>(`/wallets/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          wallets: state.wallets.map((w) => (w.id === id ? previous : w)),
        }));
      },
      errorTitle: "Gagal memperbarui dompet",
    });
  },

  deleteWallet: (id) => {
    // Snapshot every record that will be removed (the wallet itself +
    // any child wallets) so the delete can be cleanly undone on failure.
    const previous = get().wallets.filter(
      (w) => w.id === id || w.parentId === id,
    );
    set((state) => ({
      wallets: state.wallets.filter((w) => w.id !== id && w.parentId !== id),
    }));
    void withPersist(`/wallets/${id}`, "DELETE", undefined, {
      onError: () => {
        // Restore the wallets in their original relative order.
        if (previous.length === 0) return;
        set((state) => {
          const filtered = state.wallets.filter(
            (w) => !previous.some((p) => p.id === w.id),
          );
          // Re-insert at the position the first removed wallet used to occupy.
          const insertAt = state.wallets.findIndex((w) =>
            previous.some((p) => p.id === w.id),
          );
          const restored =
            insertAt === -1
              ? [...filtered, ...previous]
              : [
                  ...filtered.slice(0, insertAt),
                  ...previous,
                  ...filtered.slice(insertAt),
                ];
          return { wallets: restored };
        });
      },
      errorTitle: "Gagal menghapus dompet",
      successTitle: "Dompet dihapus",
    });
  },

  // ── Transaction Actions ────────────────────────────────────────────────────

  addTransaction: (tx) => {
    const item = { ...tx, id: genId() };
    set((state) => ({ transactions: [item, ...state.transactions] }));
    void withPersist<Transaction>("/transactions", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          // Replace the optimistic record with the server’s canonical one
          // (same id here because we pass `id` through, but normalises
          // any server-side fields like `categoryIcon`).
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.id === item.id ? serverItem : t,
            ),
          }));
        }
        // Refresh the affected slices so wallet balance + budget spent
        // reflect the server’s authoritative values.
        void Promise.all([get().refreshWallets(), get().refreshBudgets()]);
      },
      onError: () => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah transaksi",
    });
  },

  updateTransaction: (id, updates) => {
    const previous = get().transactions.find((t) => t.id === id);
    set((state) => ({
      transactions: state.transactions.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx,
      ),
    }));
    void withPersist<Transaction>(`/transactions/${id}`, "PUT", updates, {
      onSuccess: () => {
        void Promise.all([get().refreshWallets(), get().refreshBudgets()]);
      },
      onError: () => {
        if (!previous) return;
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? previous : t,
          ),
        }));
      },
      errorTitle: "Gagal memperbarui transaksi",
    });
  },

  deleteTransaction: (id) => {
    const previous = get().transactions.find((t) => t.id === id);
    set((state) => ({
      transactions: state.transactions.filter((tx) => tx.id !== id),
    }));
    void withPersist(`/transactions/${id}`, "DELETE", undefined, {
      onSuccess: () => {
        void Promise.all([get().refreshWallets(), get().refreshBudgets()]);
      },
      onError: () => {
        if (!previous) return;
        // Re-insert at its original index so order is preserved.
        set((state) => {
          const idx = state.transactions.findIndex((t) => t.id === id);
          if (idx === -1)
            return { transactions: [previous, ...state.transactions] };
          return {
            transactions: [
              ...state.transactions.slice(0, idx),
              previous,
              ...state.transactions.slice(idx),
            ],
          };
        });
      },
      errorTitle: "Gagal menghapus transaksi",
    });
  },

  /**
   * Pull the latest wallet balances from the server. Called after any
   * transaction write so the UI sees the updated `balance` aggregate.
   * Safe to call when offline — the `set` is skipped if the request
   * throws, leaving the optimistic local state intact.
   */
  refreshWallets: async () => {
    const token = getBackendToken();
    if (!token) return;
    try {
      const wallets = await api.get<Wallet[]>("/wallets", token);
      set({ wallets });
    } catch (error) {
      console.warn("Failed to refresh wallets", error);
    }
  },

  /** Pull the latest budget spent amounts from the server. */
  refreshBudgets: async () => {
    const token = getBackendToken();
    if (!token) return;
    try {
      const budgets = await api.get<Budget[]>("/budgets", token);
      set({ budgets });
    } catch (error) {
      console.warn("Failed to refresh budgets", error);
    }
  },

  // ── Budget Actions ─────────────────────────────────────────────────────────

  addBudget: (budget) => {
    const item = { ...budget, id: genId() };
    set((state) => ({ budgets: [...state.budgets, item] }));
    void withPersist<Budget>("/budgets", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            budgets: state.budgets.map((b) =>
              b.id === item.id ? serverItem : b,
            ),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          budgets: state.budgets.filter((b) => b.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah anggaran",
    });
  },

  updateBudget: (id, updates) => {
    const previous = get().budgets.find((b) => b.id === id);
    set((state) => ({
      budgets: state.budgets.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    }));
    void withPersist<Budget>(`/budgets/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          budgets: state.budgets.map((b) => (b.id === id ? previous : b)),
        }));
      },
      errorTitle: "Gagal memperbarui anggaran",
    });
  },

  deleteBudget: (id) => {
    const previous = get().budgets.find((b) => b.id === id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
    void withPersist(`/budgets/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ budgets: [previous, ...state.budgets] }));
      },
      errorTitle: "Gagal menghapus anggaran",
    });
  },

  // ── Investment Actions ─────────────────────────────────────────────────────

  addInvestment: (investment) => {
    const item = { ...investment, id: genId() };
    const existingKey = `${item.broker}|${item.symbol}|${item.assetClass}`;

    set((state) => {
      const existing = state.investments.find(
        (inv) =>
          `${inv.broker}|${inv.symbol}|${inv.assetClass}` === existingKey,
      );
      if (!existing) return { investments: [...state.investments, item] };

      const nextQty = existing.quantity + item.quantity;
      const nextAvgBuyPrice =
        nextQty > 0
          ? (existing.quantity * existing.avgBuyPrice +
              item.quantity * item.avgBuyPrice) /
            nextQty
          : item.avgBuyPrice;

      return {
        investments: state.investments.map((inv) =>
          inv.id === existing.id
            ? {
                ...inv,
                name: item.name || inv.name,
                quantity: nextQty,
                avgBuyPrice: nextAvgBuyPrice,
                currentPrice: item.currentPrice || inv.currentPrice,
                color: item.color,
              }
            : inv,
        ),
      };
    });

    void withPersist<Investment>("/investments", "POST", item, {
      onSuccess: (saved) => {
        if (!saved) return;
        set((state) => ({
          investments: state.investments.some((inv) => inv.id === saved.id)
            ? state.investments.map((inv) =>
                inv.id === saved.id ? saved : inv,
              )
            : [
                ...state.investments.filter(
                  (inv) =>
                    `${inv.broker}|${inv.symbol}|${inv.assetClass}` !==
                    `${saved.broker}|${saved.symbol}|${saved.assetClass}`,
                ),
                saved,
              ],
        }));
      },
      onError: () => {
        // Hard to undo a merge cleanly; remove the optimistic add. The
        // update of an existing holding would need a fuller snapshot,
        // but `addInvestment` for an existing symbol is rare.
        set((state) => ({
          investments: state.investments.filter((i) => i.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah investasi",
    });
  },

  updateInvestment: (id, updates) => {
    const previous = get().investments.find((inv) => inv.id === id);
    set((state) => ({
      investments: state.investments.map((inv) =>
        inv.id === id ? { ...inv, ...updates } : inv,
      ),
    }));
    void withPersist<Investment>(`/investments/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          investments: state.investments.map((inv) =>
            inv.id === id ? previous : inv,
          ),
        }));
      },
      errorTitle: "Gagal memperbarui investasi",
    });
  },

  deleteInvestment: (id) => {
    const previous = get().investments.find((inv) => inv.id === id);
    set((state) => ({
      investments: state.investments.filter((inv) => inv.id !== id),
    }));
    void withPersist(`/investments/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ investments: [previous, ...state.investments] }));
      },
      errorTitle: "Gagal menghapus investasi",
    });
  },

  // ── Split Bill Actions ─────────────────────────────────────────────────────────
  addSplitBill: async (bill) => {
    // Local-only fallback when no token (offline-first).
    if (!getBackendToken()) {
      const item = {
        ...bill,
        id: genId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({ splitBills: [item, ...state.splitBills] }));
      toast.warning("Split bill tersimpan lokal", "Tidak ada sesi login.");
      return;
    }
    // We need the server-assigned bill to populate payTokens, so do an
    // awaited create and only insert into state on success.
    const result = await persistResource<SplitBill>(
      "/split-bills",
      "POST",
      bill,
    );
    if (result.ok && result.data) {
      set((state) => ({ splitBills: [result.data!, ...state.splitBills] }));
      toast.success("Split bill dibuat");
    } else if (!result.ok) {
      toast.error("Gagal membuat split bill", result.error);
    }
  },

  updateSplitBill: async (id, updates) => {
    const previous = get().splitBills.find((b) => b.id === id);
    set((state) => ({
      splitBills: state.splitBills.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    }));
    const result = await persistResource<SplitBill>(
      `/split-bills/${id}`,
      "PUT",
      updates,
    );
    if (!result.ok) {
      if (previous) {
        set((state) => ({
          splitBills: state.splitBills.map((b) => (b.id === id ? previous : b)),
        }));
      }
      toast.error("Gagal memperbarui split bill", result.error);
    }
  },

  toggleParticipantPaid: async (billId, participantId, paid) => {
    const previous = get().splitBills.find((b) => b.id === billId);
    set((state) => ({
      splitBills: state.splitBills.map((b) => {
        if (b.id !== billId) return b;
        const updatedParticipants = b.participants.map((p) =>
          p.id === participantId
            ? {
                ...p,
                paid,
                paidAt: paid ? new Date().toISOString() : undefined,
              }
            : p,
        );
        // Auto-settle when all paid
        const allPaid = updatedParticipants.every((p) => p.paid);
        return {
          ...b,
          participants: updatedParticipants,
          status: allPaid ? ("settled" as const) : ("active" as const),
        };
      }),
    }));
    const result = await persistResource(
      `/split-bills/${billId}/participants/${participantId}`,
      "PUT",
      { paid },
    );
    if (!result.ok) {
      if (previous) {
        set((state) => ({
          splitBills: state.splitBills.map((b) =>
            b.id === billId ? previous : b,
          ),
        }));
      }
      toast.error("Gagal mengubah status peserta", result.error);
    }
  },

  deleteSplitBill: async (id) => {
    const previous = get().splitBills.find((b) => b.id === id);
    set((state) => ({
      splitBills: state.splitBills.filter((b) => b.id !== id),
    }));
    const result = await persistResource(`/split-bills/${id}`, "DELETE");
    if (!result.ok) {
      if (previous) {
        set((state) => ({ splitBills: [previous, ...state.splitBills] }));
      }
      toast.error("Gagal menghapus split bill", result.error);
    } else {
      toast.success("Split bill dihapus");
    }
  },

  refreshSplitBills: async () => {
    const token = getBackendToken();
    if (!token || token === "dev-fallback-token") return;
    try {
      const bills = await api.get<SplitBill[]>("/split-bills", token);
      set({ splitBills: bills });
    } catch (error) {
      console.warn("Failed to refresh split bills", error);
    }
  },

  // ── Bill Actions ───────────────────────────────────────────────────────────

  addBill: (bill) => {
    const item = { ...bill, id: genId() };
    set((state) => ({ bills: [...state.bills, item] }));
    void withPersist<Bill>("/bills", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            bills: state.bills.map((b) => (b.id === item.id ? serverItem : b)),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          bills: state.bills.filter((b) => b.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah tagihan",
    });
  },

  updateBillStatus: (id, status) => {
    const previous = get().bills.find((b) => b.id === id);
    set((state) => ({
      bills: state.bills.map((b) => (b.id === id ? { ...b, status } : b)),
    }));
    void withPersist(
      `/bills/${id}`,
      "PUT",
      { status },
      {
        onError: () => {
          if (!previous) return;
          set((state) => ({
            bills: state.bills.map((b) => (b.id === id ? previous : b)),
          }));
        },
        errorTitle: "Gagal memperbarui status tagihan",
      },
    );
  },

  updateBill: (id, updates) => {
    const previous = get().bills.find((b) => b.id === id);
    set((state) => ({
      bills: state.bills.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
    void withPersist(`/bills/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          bills: state.bills.map((b) => (b.id === id ? previous : b)),
        }));
      },
      errorTitle: "Gagal memperbarui tagihan",
    });
  },

  deleteBill: (id) => {
    const previous = get().bills.find((b) => b.id === id);
    set((state) => ({ bills: state.bills.filter((b) => b.id !== id) }));
    void withPersist(`/bills/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ bills: [previous, ...state.bills] }));
      },
      errorTitle: "Gagal menghapus tagihan",
    });
  },

  // ── Saving Goal Actions ────────────────────────────────────────────────────

  addSavingGoal: (goal) => {
    const item = { ...goal, id: genId() };
    set((state) => ({ savingGoals: [...state.savingGoals, item] }));
    void withPersist<SavingGoal>("/savingGoals", "POST", item, {
      onSuccess: (res) => {
        if (res && typeof res === "object" && "id" in res) {
          const serverId = String((res as { id: unknown }).id);
          set((state) => ({
            savingGoals: state.savingGoals.map((g) =>
              g.id === item.id ? { ...g, id: serverId } : g,
            ),
          }));
        }
        void get().refreshSavingGoals();
      },
      onError: () => {
        set((state) => ({
          savingGoals: state.savingGoals.filter((g) => g.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah target tabungan",
    });
  },

  updateSavingGoal: (id, updates) => {
    const previous = get().savingGoals.find((g) => g.id === id);
    set((state) => ({
      savingGoals: state.savingGoals.map((g) =>
        g.id === id ? { ...g, ...updates } : g,
      ),
    }));
    void withPersist(`/savingGoals/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          savingGoals: state.savingGoals.map((g) =>
            g.id === id ? previous : g,
          ),
        }));
      },
      errorTitle: "Gagal memperbarui target tabungan",
    });
  },

  deleteSavingGoal: (id) => {
    const previous = get().savingGoals.find((g) => g.id === id);
    set((state) => ({
      savingGoals: state.savingGoals.filter((g) => g.id !== id),
    }));
    void withPersist(`/savingGoals/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ savingGoals: [previous, ...state.savingGoals] }));
      },
      errorTitle: "Gagal menghapus target tabungan",
    });
  },

  contributeToGoal: (id, amount) => {
    const previous = get().savingGoals.find((g) => g.id === id);
    set((state) => ({
      savingGoals: state.savingGoals.map((g) => {
        if (g.id !== id) return g;
        const updates = {
          currentAmount: Math.min(g.currentAmount + amount, g.targetAmount),
        };
        return { ...g, ...updates };
      }),
    }));
    const updates = {
      currentAmount: Math.min(
        (previous?.currentAmount ?? 0) + amount,
        previous?.targetAmount ?? Infinity,
      ),
    };
    void withPersist(`/savingGoals/${id}`, "PUT", updates, {
      onSuccess: () => {
        void get().refreshSavingGoals();
      },
      onError: () => {
        if (!previous) return;
        set((state) => ({
          savingGoals: state.savingGoals.map((g) =>
            g.id === id ? previous : g,
          ),
        }));
      },
      errorTitle: "Gagal menambah tabungan",
    });
  },

  /**
   * Pull the latest saving goals from the server. Called after every
   * savings write so the UI always reflects the DB's `currentAmount`.
   */
  refreshSavingGoals: async () => {
    const token = getBackendToken();
    if (!token) return;
    try {
      const savingGoals = await api.get<SavingGoal[]>("/savingGoals", token);
      set({ savingGoals });
    } catch (error) {
      console.warn("Failed to refresh saving goals", error);
    }
  },

  // ── Debt Actions ───────────────────────────────────────────────────────────

  addDebt: (debt) => {
    const item = { ...debt, id: genId() };
    void persistResource("/debts", "POST", item);
    set((state) => ({ debts: [...state.debts, item] }));
  },

  updateDebt: (id, updates) => {
    void persistResource(`/debts/${id}`, "PUT", updates);
    set((state) => ({
      debts: state.debts.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  },

  deleteDebt: (id) => {
    const previous = get().debts.find((d) => d.id === id);
    set((state) => ({
      debts: state.debts.filter((d) => d.id !== id),
    }));
    void withPersist(`/debts/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ debts: [previous, ...state.debts] }));
      },
      errorTitle: "Gagal menghapus utang",
    });
  },

  addDebtInstallment: (debtId, installment) => {
    const previous = get().debts.find((d) => d.id === debtId);
    if (!previous) return;
    const newInstallment = { ...installment, id: genId() };
    const newPaidAmount = previous.paidAmount + installment.amount;
    const isSettled = newPaidAmount >= previous.amount;
    const updates = {
      paidAmount: newPaidAmount,
      installments: [...previous.installments, newInstallment],
      isSettled,
    };
    set((state) => ({
      debts: state.debts.map((d) =>
        d.id === debtId ? { ...d, ...updates } : d,
      ),
    }));
    void withPersist(`/debts/${debtId}`, "PUT", updates, {
      onError: () => {
        set((state) => ({
          debts: state.debts.map((d) => (d.id === debtId ? previous : d)),
        }));
      },
      errorTitle: "Gagal menambah cicilan",
    });
  },

  settleDebt: (id) => {
    const previous = get().debts.find((d) => d.id === id);
    const updates = { isSettled: true, paidAmount: undefined };
    set((state) => ({
      debts: state.debts.map((d) =>
        d.id === id ? { ...d, isSettled: true, paidAmount: d.amount } : d,
      ),
    }));
    void withPersist(`/debts/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          debts: state.debts.map((d) => (d.id === id ? previous : d)),
        }));
      },
      errorTitle: "Gagal menutup utang",
    });
  },

  // ── Card Actions ───────────────────────────────────────────────────────────

  addCard: (card) => {
    const item = { ...card, id: genId() };
    set((state) => ({ cards: [...state.cards, item] }));
    void withPersist<Card>("/cards", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            cards: state.cards.map((c) => (c.id === item.id ? serverItem : c)),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah kartu",
    });
  },

  updateCard: (id, updates) => {
    const previous = get().cards.find((c) => c.id === id);
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    void withPersist(`/cards/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? previous : c)),
        }));
      },
      errorTitle: "Gagal memperbarui kartu",
    });
  },

  deleteCard: (id) => {
    const previous = get().cards.find((c) => c.id === id);
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    }));
    void withPersist(`/cards/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ cards: [previous, ...state.cards] }));
      },
      errorTitle: "Gagal menghapus kartu",
    });
  },

  // ── Wishlist Actions ───────────────────────────────────────────────────────

  addWishlistItem: (item) => {
    const newItem = {
      ...item,
      id: genId(),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ wishlist: [...state.wishlist, newItem] }));
    void withPersist<WishlistItem>("/wishlist", "POST", newItem, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            wishlist: state.wishlist.map((w) =>
              w.id === newItem.id ? serverItem : w,
            ),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          wishlist: state.wishlist.filter((w) => w.id !== newItem.id),
        }));
      },
      errorTitle: "Gagal menambah wishlist",
    });
  },

  updateWishlistItem: (id, updates) => {
    const previous = get().wishlist.find((w) => w.id === id);
    set((state) => ({
      wishlist: state.wishlist.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    }));
    void withPersist(`/wishlist/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          wishlist: state.wishlist.map((w) => (w.id === id ? previous : w)),
        }));
      },
      errorTitle: "Gagal memperbarui wishlist",
    });
  },

  toggleWishlistPurchased: (id) => {
    const previous = get().wishlist.find((w) => w.id === id);
    if (!previous) return;
    set((state) => ({
      wishlist: state.wishlist.map((w) =>
        w.id === id ? { ...w, isPurchased: !w.isPurchased } : w,
      ),
    }));
    void withPersist(
      `/wishlist/${id}`,
      "PUT",
      {
        isPurchased: !previous.isPurchased,
      },
      {
        onError: () => {
          set((state) => ({
            wishlist: state.wishlist.map((w) => (w.id === id ? previous : w)),
          }));
        },
        errorTitle: "Gagal mengubah status wishlist",
      },
    );
  },

  deleteWishlistItem: (id) => {
    const previous = get().wishlist.find((w) => w.id === id);
    set((state) => ({
      wishlist: state.wishlist.filter((w) => w.id !== id),
    }));
    void withPersist(`/wishlist/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ wishlist: [previous, ...state.wishlist] }));
      },
      errorTitle: "Gagal menghapus wishlist",
    });
  },

  // ── Reimbursement Actions ──────────────────────────────────────────────────

  addReimbursement: (r) => {
    const item = { ...r, id: genId() };
    void persistResource("/reimbursements", "POST", item);
    set((state) => ({ reimbursements: [...state.reimbursements, item] }));
  },

  updateReimbursement: (id, updates) => {
    void persistResource(`/reimbursements/${id}`, "PUT", updates);
    set((state) => ({
      reimbursements: state.reimbursements.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
  },

  settleReimbursement: (id) => {
    const updates = {
      status: "settled" as const,
      settledDate: new Date().toISOString(),
    };
    void persistResource(`/reimbursements/${id}`, "PUT", updates);
    set((state) => ({
      reimbursements: state.reimbursements.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
  },

  deleteReimbursement: (id) => {
    const previous = get().reimbursements.find((r) => r.id === id);
    set((state) => ({
      reimbursements: state.reimbursements.filter((r) => r.id !== id),
    }));
    void withPersist(`/reimbursements/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          reimbursements: [previous, ...state.reimbursements],
        }));
      },
      errorTitle: "Gagal menghapus reimburse",
    });
  },

  // ── Note Actions ───────────────────────────────────────────────────────────

  addNote: (note) => {
    const now = new Date().toISOString();
    const item = { ...note, id: genId(), createdAt: now, updatedAt: now };
    set((state) => ({ notes: [...state.notes, item] }));
    void withPersist<Note>("/notes", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            notes: state.notes.map((n) => (n.id === item.id ? serverItem : n)),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah catatan",
    });
  },

  updateNote: (id, updates) => {
    const previous = get().notes.find((n) => n.id === id);
    const nextUpdates = { ...updates, updatedAt: new Date().toISOString() };
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...nextUpdates } : n,
      ),
    }));
    void withPersist(`/notes/${id}`, "PUT", nextUpdates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? previous : n)),
        }));
      },
      errorTitle: "Gagal memperbarui catatan",
    });
  },

  deleteNote: (id) => {
    const previous = get().notes.find((n) => n.id === id);
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
    void withPersist(`/notes/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ notes: [previous, ...state.notes] }));
      },
      errorTitle: "Gagal menghapus catatan",
    });
  },

  // ── Recurring Transaction Actions ──────────────────────────────────────────

  addRecurringTransaction: (rt) => {
    const item = { ...rt, id: genId() };
    set((state) => ({
      recurringTransactions: [...state.recurringTransactions, item],
    }));
    void withPersist<RecurringTransaction>(
      "/recurringTransactions",
      "POST",
      item,
      {
        onSuccess: (serverItem) => {
          if (serverItem) {
            set((state) => ({
              recurringTransactions: state.recurringTransactions.map((rt) =>
                rt.id === item.id ? serverItem : rt,
              ),
            }));
          }
        },
        onError: () => {
          set((state) => ({
            recurringTransactions: state.recurringTransactions.filter(
              (rt) => rt.id !== item.id,
            ),
          }));
        },
        errorTitle: "Gagal menambah transaksi berulang",
      },
    );
  },

  updateRecurringTransaction: (id, updates) => {
    const previous = get().recurringTransactions.find((rt) => rt.id === id);
    set((state) => ({
      recurringTransactions: state.recurringTransactions.map((rt) =>
        rt.id === id ? { ...rt, ...updates } : rt,
      ),
    }));
    void withPersist(`/recurringTransactions/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          recurringTransactions: state.recurringTransactions.map((rt) =>
            rt.id === id ? previous : rt,
          ),
        }));
      },
      errorTitle: "Gagal memperbarui transaksi berulang",
    });
  },

  toggleRecurringTransaction: (id) => {
    const previous = get().recurringTransactions.find((rt) => rt.id === id);
    if (!previous) return;
    const updates = { isActive: !previous.isActive };
    set((state) => ({
      recurringTransactions: state.recurringTransactions.map((rt) =>
        rt.id === id ? { ...rt, ...updates } : rt,
      ),
    }));
    void withPersist(`/recurringTransactions/${id}`, "PUT", updates, {
      onError: () => {
        set((state) => ({
          recurringTransactions: state.recurringTransactions.map((rt) =>
            rt.id === id ? previous : rt,
          ),
        }));
      },
      errorTitle: "Gagal mengubah status transaksi berulang",
    });
  },

  deleteRecurringTransaction: (id) => {
    const previous = get().recurringTransactions.find((rt) => rt.id === id);
    set((state) => ({
      recurringTransactions: state.recurringTransactions.filter(
        (rt) => rt.id !== id,
      ),
    }));
    void withPersist(`/recurringTransactions/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          recurringTransactions: [previous, ...state.recurringTransactions],
        }));
      },
      errorTitle: "Gagal menghapus transaksi berulang",
    });
  },

  // ── Gamification Actions ───────────────────────────────────────────────────

  updateGamification: (updates) => {
    const previous = get().gamification;
    set((state) => ({
      gamification: { ...state.gamification, ...updates },
    }));
    void withPersist(`/user/gamification`, "PUT", updates, {
      onError: () => {
        set({ gamification: previous });
      },
      errorTitle: "Gagal memperbarui gamifikasi",
    });
  },

  unlockBadge: (badgeId) => {
    const previous = get().gamification;
    const badge = previous.badges.find((b) => b.id === badgeId);
    if (!badge) return;
    const newGamification = {
      ...previous,
      badges: previous.badges.map((b) =>
        b.id === badgeId
          ? {
              ...b,
              isUnlocked: true,
              unlockedAt: new Date().toISOString(),
              progress: 100,
            }
          : b,
      ),
      totalXP: previous.totalXP + (badge.xpReward ?? 0),
    };
    set({ gamification: newGamification });
    void withPersist(`/user/gamification`, "PUT", newGamification, {
      onError: () => {
        set({ gamification: previous });
      },
      errorTitle: "Gagal membuka lencana",
    });
  },

  // ── User Profile Actions ───────────────────────────────────────────────────

  updateUserProfile: (updates) => {
    const previous = get().userProfile;
    set((state) => ({
      userProfile: { ...state.userProfile, ...updates },
    }));
    void withPersist(`/user/profile`, "PUT", updates, {
      onError: () => {
        set({ userProfile: previous });
      },
      errorTitle: "Gagal memperbarui profil",
    });
  },

  // ── Team Member Actions ────────────────────────────────────────────────────

  addTeamMember: (member) => {
    const item = { ...member, id: genId() };
    set((state) => ({
      teamMembers: [...state.teamMembers, item],
    }));
    void withPersist<TeamMember>("/teamMembers", "POST", item, {
      onSuccess: (serverItem) => {
        if (serverItem) {
          set((state) => ({
            teamMembers: state.teamMembers.map((m) =>
              m.id === item.id ? serverItem : m,
            ),
          }));
        }
      },
      onError: () => {
        set((state) => ({
          teamMembers: state.teamMembers.filter((m) => m.id !== item.id),
        }));
      },
      errorTitle: "Gagal menambah anggota tim",
    });
  },

  updateTeamMember: (id, updates) => {
    const previous = get().teamMembers.find((m) => m.id === id);
    set((state) => ({
      teamMembers: state.teamMembers.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    }));
    void withPersist(`/teamMembers/${id}`, "PUT", updates, {
      onError: () => {
        if (!previous) return;
        set((state) => ({
          teamMembers: state.teamMembers.map((m) =>
            m.id === id ? previous : m,
          ),
        }));
      },
      errorTitle: "Gagal memperbarui anggota tim",
    });
  },

  removeTeamMember: (id) => {
    const previous = get().teamMembers.find((m) => m.id === id);
    set((state) => ({
      teamMembers: state.teamMembers.filter((m) => m.id !== id),
    }));
    void withPersist(`/teamMembers/${id}`, "DELETE", undefined, {
      onError: () => {
        if (!previous) return;
        set((state) => ({ teamMembers: [previous, ...state.teamMembers] }));
      },
      errorTitle: "Gagal menghapus anggota tim",
    });
  },

  // ── Notification Settings Actions ──────────────────────────────────────────

  updateNotificationSettings: (updates) => {
    const previous = get().notificationSettings;
    set((state) => ({
      notificationSettings: { ...state.notificationSettings, ...updates },
    }));
    void withPersist(`/user/notification-settings`, "PUT", updates, {
      onError: () => {
        set({ notificationSettings: previous });
      },
      errorTitle: "Gagal memperbarui pengaturan notifikasi",
    });
  },

  // ── Category & Sub-Category Actions ───────────────────────────────────────

  /**
   * Pull the latest master categories + sub-categories from the server.
   * Called after any write so the picker dropdowns in the budget and
   * transaction forms stay in sync.
   */
  refreshCategories: async () => {
    const token = getBackendToken();
    if (!token) return;
    try {
      const [categories, subCategories] = await Promise.all([
        api.get<Category[]>("/categories", token),
        api.get<SubCategory[]>("/subCategories", token),
      ]);
      set({ categories, subCategories });
    } catch (error) {
      console.warn("Failed to refresh categories", error);
    }
  },

  refreshAll: async () => {
    const token = getBackendToken();
    if (!token || token === "dev-fallback-token") return false;
    try {
      const data = await api.bootstrap<BootstrapData>(token);
      get().hydrateFromBackend(data);
      return true;
    } catch (error) {
      console.warn("Failed to refresh all data", error);
      toast.warning(
        "Gagal sinkron",
        error instanceof Error ? error.message : "Server tidak terjangkau",
      );
      return false;
    }
  },

  addCategory: async (category) => {
    const result = await persistResource<Category>(
      "/categories",
      "POST",
      category,
    );
    if (result.ok) {
      const created = result.data!;
      set((state) => ({ categories: [...state.categories, created] }));
      toast.success("Kategori ditambahkan");
      return created;
    }
    // Offline fallback: still insert locally so the picker works, but
    // notify the user the change is not yet on the server.
    const item: Category = {
      ...category,
      id: genId(),
      subCategories: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ categories: [...state.categories, item] }));
    toast.warning(
      "Kategori tersimpan lokal",
      result.offline
        ? "Server tidak terjangkau — akan disinkronkan saat online."
        : result.error,
    );
    return item;
  },

  updateCategory: async (id, updates) => {
    const previous = get().categories.find((c) => c.id === id);
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c,
      ),
    }));
    const result = await persistResource<Category>(
      `/categories/${id}`,
      "PUT",
      updates,
    );
    if (!result.ok) {
      if (previous) {
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? previous : c)),
        }));
      }
      toast.error("Gagal memperbarui kategori", result.error);
      return;
    }
    toast.success("Kategori diperbarui");
    await get().refreshCategories();
  },

  deleteCategory: async (id) => {
    // Snapshot both the master and its sub-categories so we can restore
    // them all on failure.
    const previousCategory = get().categories.find((c) => c.id === id);
    const previousSubs = get().subCategories.filter((s) => s.categoryId === id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      subCategories: state.subCategories.filter((s) => s.categoryId !== id),
    }));
    const result = await persistResource(`/categories/${id}`, "DELETE");
    if (!result.ok) {
      if (previousCategory) {
        set((state) => ({
          categories: [...state.categories, previousCategory],
          subCategories: [...state.subCategories, ...previousSubs],
        }));
      }
      toast.error("Gagal menghapus kategori", result.error);
      return;
    }
    toast.success("Kategori dihapus");
  },

  addSubCategory: async (sub) => {
    const result = await persistResource<SubCategory>(
      "/subCategories",
      "POST",
      sub,
    );
    if (result.ok) {
      const created = result.data!;
      set((state) => {
        // Make sure the parent Category's `subCategories` array reflects the
        // new entry (the server returns it flattened, so we attach it here).
        const categories = state.categories.map((c) =>
          c.id === sub.categoryId
            ? { ...c, subCategories: [...c.subCategories, created] }
            : c,
        );
        return { subCategories: [...state.subCategories, created], categories };
      });
      toast.success("Sub-kategori ditambahkan");
      return created;
    }
    const item: SubCategory = {
      ...sub,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const categories = state.categories.map((c) =>
        c.id === sub.categoryId
          ? { ...c, subCategories: [...c.subCategories, item] }
          : c,
      );
      return { subCategories: [...state.subCategories, item], categories };
    });
    toast.warning(
      "Sub-kategori tersimpan lokal",
      result.offline
        ? "Server tidak terjangkau — akan disinkronkan saat online."
        : result.error,
    );
    return item;
  },

  updateSubCategory: async (id, updates) => {
    const previousSub = get().subCategories.find((s) => s.id === id);
    set((state) => ({
      subCategories: state.subCategories.map((s) =>
        s.id === id
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s,
      ),
      // Mirror onto the nested array on the parent Category.
      categories: state.categories.map((c) => ({
        ...c,
        subCategories: c.subCategories.map((s) =>
          s.id === id
            ? { ...s, ...updates, updatedAt: new Date().toISOString() }
            : s,
        ),
      })),
    }));
    const result = await persistResource<SubCategory>(
      `/subCategories/${id}`,
      "PUT",
      updates,
    );
    if (!result.ok) {
      if (previousSub) {
        set((state) => ({
          subCategories: state.subCategories.map((s) =>
            s.id === id ? previousSub : s,
          ),
          categories: state.categories.map((c) => ({
            ...c,
            subCategories: c.subCategories.map((s) =>
              s.id === id ? previousSub : s,
            ),
          })),
        }));
      }
      toast.error("Gagal memperbarui sub-kategori", result.error);
      return;
    }
    toast.success("Sub-kategori diperbarui");
    await get().refreshCategories();
  },

  deleteSubCategory: async (id) => {
    const previousSub = get().subCategories.find((s) => s.id === id);
    set((state) => ({
      subCategories: state.subCategories.filter((s) => s.id !== id),
      categories: state.categories.map((c) => ({
        ...c,
        subCategories: c.subCategories.filter((s) => s.id !== id),
      })),
    }));
    const result = await persistResource(`/subCategories/${id}`, "DELETE");
    if (!result.ok) {
      if (previousSub) {
        set((state) => ({
          subCategories: [...state.subCategories, previousSub],
          categories: state.categories.map((c) =>
            c.id === previousSub.categoryId
              ? { ...c, subCategories: [...c.subCategories, previousSub] }
              : c,
          ),
        }));
      }
      toast.error("Gagal menghapus sub-kategori", result.error);
      return;
    }
    toast.success("Sub-kategori dihapus");
  },

  ensureCategory: async (name, type, icon, color) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = get().categories.find(
      (c) => c.type === type && c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    return get().addCategory({
      type,
      name: trimmed,
      icon: icon ?? "📁",
      color: color ?? "#6366f1",
      sortOrder: 0,
      isSystem: false,
    });
  },

  ensureSubCategory: async (categoryId, name, icon, color) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = get().subCategories.find(
      (s) =>
        s.categoryId === categoryId &&
        s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const parent = get().categories.find((c) => c.id === categoryId);
    return get().addSubCategory({
      categoryId,
      name: trimmed,
      icon: icon ?? parent?.icon ?? "🔖",
      color: color ?? parent?.color ?? "#6366f1",
      sortOrder: 0,
      isSystem: false,
    });
  },
}));
