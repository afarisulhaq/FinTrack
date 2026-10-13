import { z } from "zod";
import type { PageResult } from "./pagination";
import { MAX_PAGE_SIZE } from "./pagination";

const id = z.string().min(1);
const number = z.number().finite();
const text = z.string();
const base = { id };
const installment = z.object({ ...base, amount: number, date: text, note: text.nullish(), walletId: text.nullish() }).passthrough();
const participant = z.object({ ...base, name: text, amount: number, paid: z.boolean(), paidAt: text.nullish(), payToken: text.nullish(), walletId: text.nullish(), contact: text.nullish() }).passthrough();
const counts = z.record(number);
const businessTotals = z.object({ income: number, expense: number, difference: number, returnPercent: number.nullable(), transactionCount: number });
const summarySchemas: Record<string, z.ZodType<unknown>> = {
  wallets: z.object({ totalBalance: number, parentCount: number, childCount: number }),
  transactions: z.object({ monthStats: z.object({ income: number, expense: number, net: number }), categories: z.array(text), budgetCategories: z.array(text), dayNet: counts }),
  budgets: z.object({ totalLimit: number, totalSpent: number, overspentCount: number, counts }),
  bills: z.object({ unpaidTotal: number, monthTotal: number, weekTotal: number, counts }),
  savingGoals: z.object({ totalTarget: number, totalCollected: number, avgProgress: number }),
  recurringTransactions: z.object({ monthlyExpense: number, monthlyIncome: number, activeCount: number, weekCounts: z.array(number).length(4) }),
  reimbursements: z.object({ totalActive: number, totalSettled: number, counts }),
  cards: z.object({ totalLimit: number, totalUsed: number, creditCount: number, debitCount: number }),
  wishlist: z.object({ totalItems: number, totalValue: number, purchasedCount: number, purchasedValue: number, counts }),
  investments: z.object({ totalValue: number, totalPL: number, totalCost: number, totalRealizedPL: number, activeCount: number, soldCount: number, brokers: z.array(text), pieData: z.array(z.object({ name: text, value: number, color: text })) }),
  categories: z.object({ expense: number, income: number, transfer: number, expenseSubs: number, incomeSubs: number }),
  debts: z.object({ totalOwe: number, totalLent: number, nett: number }),
  splitBills: z.object({ activeCount: number, totalCollected: number, totalOutstanding: number }),
  users: z.object({ total: number, totalUsers: number, activeUsers: number, newThisMonth: number, roles: counts, statuses: counts, last7: z.array(z.object({ day: text, users: number })).length(7) }),
  "market-watchlist": z.object({ symbols: z.array(text).nullable(), storage: z.enum(["database", "memory"]) }),
  "stock-screening": z.object({ scanned: number, analyzedCount: number, generatedAt: text, signalCount: number, unavailableCount: number }),
};
const analyticsSummary = z.object({
  timezone: text, walletBalance: number, rootWalletCount: number, portfolioValue: number,
  monthlyData: z.array(z.object({ month: text, income: number, expense: number })),
  totalIncome: number, totalExpense: number, transactionCount: number,
  heatmap: z.array(z.object({ date: text, amount: number })),
  categories: z.array(z.object({ name: text, value: number, icon: text, color: text })),
  bills: z.array(z.object({ ...base, name: text, amount: number, dueDate: text, status: text, icon: text })),
  goals: z.array(z.object({ ...base, name: text, icon: text, color: text, targetAmount: number, currentAmount: number })),
});
const activitySummary = z.object({
  timezone: text, totalXP: number, level: number, levelName: text,
  next: z.object({ name: text, xp: number }).optional(), progress: number,
  currentStreak: number, longestStreak: number, recordCount: number, activeDays: number,
  last7Days: z.array(z.object({ date: text, count: number })),
  badges: z.array(z.object({ ...base, name: text, description: text, icon: text, color: text, category: text, isUnlocked: z.boolean(), unlockedAt: text.optional(), progress: number.optional(), condition: text, xpReward: number })),
});
const schemas: Record<string, z.ZodType<unknown>> = {
  wallets: z.object({ ...base, name: text, balance: number, currency: text, type: text, icon: text, color: text, parentId: text.nullish(), childCount: number, groupBalance: number }).passthrough(),
  transactions: z.object({ ...base, type: z.enum(["income", "expense", "transfer"]), amount: number, category: text, categoryIcon: text, walletId: text, walletName: text, description: text, date: text }).passthrough(),
  budgets: z.object({ ...base, category: text, categoryIcon: text, limit: number, spent: number, period: text, color: text }).passthrough(),
  bills: z.object({ ...base, name: text, amount: number, dueDate: text, status: text, category: text, icon: text }).passthrough(),
  savingGoals: z.object({ ...base, name: text, targetAmount: number, currentAmount: number, deadline: text, icon: text, color: text }).passthrough(),
  notes: z.object({ ...base, title: text, content: text, tags: z.array(text).optional(), createdAt: text, updatedAt: text }).passthrough(),
  recurringTransactions: z.object({ ...base, name: text, amount: number, type: text, category: text, categoryIcon: text, walletId: text, period: text, nextDate: text, isActive: z.boolean() }).passthrough(),
  investments: z.object({ ...base, name: text, symbol: text, assetClass: text, broker: text, quantity: number, soldQuantity: number, avgBuyPrice: number, currentPrice: number, currency: text, color: text, buyFee: number.nullish(), sellFee: number.nullish(), sellPrice: number.nullish() }).passthrough(),
  debts: z.object({ ...base, personName: text, direction: text, amount: number, paidAmount: number, isSettled: z.boolean(), description: text, createdAt: text, installmentCount: number }).passthrough(),
  debtContacts: z.object({ ...base, name: text, createdAt: text }).passthrough(),
  cards: z.object({ ...base, name: text, bank: text, type: text, last4Digits: text, color: text, statementDate: number, dueDate: number, billingCycleStart: number }).passthrough(),
  wishlist: z.object({ ...base, name: text, price: number, priority: text, category: text, icon: text, isPurchased: z.boolean() }).passthrough(),
  reimbursements: z.object({ ...base, title: text, amount: number, paidFrom: text, walletName: text, status: text, submittedDate: text }).passthrough(),
  categories: z.object({ ...base, name: text, type: text, icon: text, color: text, sortOrder: number, isSystem: z.boolean(), createdAt: text, updatedAt: text, subCategoryCount: number }).passthrough(),
  subCategories: z.object({ ...base, name: text, categoryId: text, icon: text, color: text, sortOrder: number, isSystem: z.boolean(), createdAt: text, updatedAt: text }).passthrough(),
  teamMembers: z.object({ ...base, name: text, email: text, role: text, status: text, permissions: z.object({}).passthrough() }).passthrough(),
  splitBills: z.object({ ...base, title: text, totalAmount: number, currency: text, paidBy: text, date: text, splitMethod: text, status: text, participantCount: number, paidCount: number, collected: number, outstanding: number }).passthrough(),
  users: z.object({ ...base, name: text, email: text, role: text, status: text, createdAt: text }).passthrough(),
};
const invoice = z.object({ ...base, planName: text, amount: number, baseAmount: number, durationDays: number, status: text, createdAt: text, expiresAt: text }).passthrough();
const candidate = z.object({ symbol: text, name: text, price: number, asOf: text, signals: z.array(text), reasons: z.array(text), risks: z.array(text), support: number, resistance: number, invalidation: number, relativeVolume: number, cmf: number, obvChange: number, rsi: number, atrPercent: number, turnover: number, sma20: number, sma50: number, stale: z.boolean() }).passthrough();

export function parsePage<T, S>(value: unknown, address: string): PageResult<T, S> {
  const url = new URL(address, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[0] === "admin" && parts[1] === "users" ? "users" : parts[0];
  let itemSchema: z.ZodType<unknown> = schemas[resource] ?? z.object({ ...base }).passthrough();
  let summarySchema: z.ZodType<unknown> = summarySchemas[resource] ?? z.record(z.unknown());
  if (resource === "record-ids") itemSchema = z.object(base);
  if (resource === "debts" && url.searchParams.get("view") === "groups") itemSchema = z.object({ key: text, personName: text, amount: number, paidAmount: number, remaining: number, debtCount: number, activeCount: number }).passthrough();
  if (resource === "debts" && url.searchParams.get("view") === "installments") itemSchema = installment;
  if (resource === "splitBills" && url.searchParams.get("view") === "participants") { itemSchema = participant; summarySchema = schemas.splitBills; }
  if (resource === "cards" && url.searchParams.get("view") === "billing") itemSchema = z.object({ name: text, date: number, label: text, type: text }).passthrough();
  if (resource === "investments" && url.searchParams.get("view") === "performance") {
    itemSchema = z.never();
    summarySchema = z.object({ series: z.array(z.object({ ...base, name: text, value: number, pl: number })) });
  }
  if (resource === "businesses") {
    itemSchema = parts.includes("transactions") ? z.object({ ...base, type: text, amount: number, description: text, date: text, walletId: text.nullish(), walletName: text.nullish() }).passthrough() : z.object({ ...base, name: text, description: text, summary: businessTotals }).passthrough();
    summarySchema = businessTotals;
  }
  if (resource === "subscriptions") itemSchema = invoice;
  if (resource === "market-watchlist") itemSchema = text;
  if (resource === "market-search") itemSchema = z.object({ symbol: text, name: text, type: text, exchange: text }).passthrough();
  if (resource === "stock-screening") itemSchema = url.searchParams.get("view") === "unavailable" ? z.object({ symbol: text, reason: text }) : candidate;
  if (resource === "bot") itemSchema = parts.includes("contacts") ? z.object({ contactId: text, name: text, isAllowed: z.boolean() }).passthrough() : z.object({ ...base, contactId: text, channel: text }).passthrough();
  if (resource === "analytics") summarySchema = parts.includes("activity") ? activitySummary : analyticsSummary;
  const schema = z.object({
    items: z.array(z.custom<T>((row) => itemSchema.safeParse(row).success, "Record daftar tidak valid")),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
    summary: z.custom<S>((summary) => summarySchema.safeParse(summary).success, "Ringkasan daftar tidak valid").optional(),
  });
  return schema.parse(value);
}
