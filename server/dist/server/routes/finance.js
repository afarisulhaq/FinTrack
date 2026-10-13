import { toggleSplitWalletPayment } from "../services/split-wallet-payments.js";
import { reconcileWalletEffects, readWalletEffects, resourceWalletUpdate, lockFinanceRecord, } from "../services/wallet-effects.js";
import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { appConfig, db, setAppConfig, users } from "../data.js";
import { extractToken, verifyToken } from "../auth.js";
import { requireAdmin, requireAuth } from "../auth-middleware.js";
import { canUseDatabase, isDatabaseConfigured, db as prisma, } from "../prisma-client.js";
import { getYahooFinancePrice, getYahooFinanceQuote, searchYahooFinance, } from "../services/market-price.js";
import { fail, id, ok, publicUser } from "../utils.js";
import { listLedger } from "../services/list-ledger.js";
import { listAssets } from "../services/list-assets.js";
import { listPeople } from "../services/list-people.js";
import { PaginationError, readPage, pageArray, databasePage } from "../services/pagination.js";
const prismaResources = new Set([
    "wallets",
    "transactions",
    "budgets",
    "investments",
    "bills",
    "savingGoals",
    "notes",
    "recurringTransactions",
    "debts",
    "debtContacts",
    "cards",
    "wishlist",
    "reimbursements",
    "teamMembers",
    "categories",
    "subCategories",
]);
const recordIdTables = {
    wallets: "Wallet", transactions: "Transaction", budgets: "Budget",
    investments: "Investment", bills: "Bill", savingGoals: "SavingGoal",
    notes: "Note", recurringTransactions: "RecurringTransaction", debts: "Debt",
    debtContacts: "DebtContact", cards: "Card", wishlist: "WishlistItem",
    reimbursements: "Reimbursement", teamMembers: "TeamMember",
    categories: "Category", subCategories: "SubCategory", splitBills: "SplitBill",
};
const contactBody = z.object({
    id: z.string().optional(), name: z.string().trim().min(1),
    phone: z.string().nullish(), note: z.string().nullish(),
});
const memberBody = z.object({
    id: z.string().optional(), name: z.string().min(1), email: z.string().email(),
    phone: z.string().nullish(), avatar: z.string().nullish(),
    role: z.enum(["owner", "member", "viewer"]),
    status: z.enum(["active", "invited", "inactive"]),
    invitedAt: z.string().optional(),
    permissions: z.object({
        canViewAllWallets: z.boolean(), canAddTransactions: z.boolean(),
        canManageBudgets: z.boolean(), walletIds: z.array(z.string()),
    }),
});
function scopedWhere(userId, id) {
    // Non-admin: restrict to their own rows.
    // Admin (userId is null): match by id only so they can manage
    // anything. Used by every update/delete/list path that needs to
    // enforce row-level ownership.
    return userId ? { id, userId } : { id };
}
function currentUserIdFromRequest(request) {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    const auth = token ? verifyToken(token) : null;
    return auth?.role === "admin" ? null : (auth?.sub ?? null);
}
function toNumber(value) {
    if (value === null || value === undefined)
        return 0;
    return Number(value.toString());
}
function toIso(value) {
    if (!value)
        return new Date().toISOString();
    return value instanceof Date ? value.toISOString() : value;
}
function publicDbUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
    };
}
function serializeAppSetting(setting) {
    return {
        appName: setting.appName,
        tagline: setting.tagline,
        logoType: setting.logoType,
        logoIcon: setting.logoIcon,
        logoImageUrl: setting.logoImageUrl,
        primaryColor: setting.primaryColor,
        accentColor: setting.accentColor,
        currency: setting.currency,
        dateFormat: setting.dateFormat,
        faviconUrl: setting.faviconUrl,
        footerText: setting.footerText,
        qrisStatic: setting.qrisStatic ?? undefined,
    };
}
function serializeWallet(w) {
    return {
        id: w.id,
        name: w.name,
        type: w.type,
        balance: toNumber(w.balance),
        currency: w.currency,
        color: w.color,
        icon: w.icon,
        parentId: w.parentId ?? undefined,
    };
}
function nestWallets(flat) {
    const records = new Map(flat.map((wallet) => [wallet.id, { ...wallet, children: [] }]));
    const roots = [];
    for (const wallet of records.values()) {
        const seen = new Set([wallet.id]);
        let ancestor = wallet.parentId;
        let cyclic = false;
        while (ancestor && records.has(ancestor)) {
            if (seen.has(ancestor)) {
                cyclic = true;
                break;
            }
            seen.add(ancestor);
            ancestor = records.get(ancestor)?.parentId;
        }
        const parent = wallet.parentId && !cyclic ? records.get(wallet.parentId) : undefined;
        if (parent)
            parent.children.push(wallet);
        else {
            wallet.parentId = undefined;
            roots.push(wallet);
        }
    }
    return roots;
}
function flattenWallets(input) {
    const children = [];
    const parent = input[0];
    if (!parent)
        return [];
    if (parent.children?.length) {
        for (const child of parent.children) {
            children.push({ ...child, parentId: parent.id });
        }
    }
    const { children: _children, ...parentWithoutChildren } = parent;
    return [parentWithoutChildren, ...children];
}
function serializeTransaction(t) {
    return {
        id: t.id,
        type: t.type,
        amount: toNumber(t.amount),
        category: t.category,
        categoryIcon: t.categoryIcon,
        walletId: t.walletId,
        walletName: t.walletName,
        destinationWalletId: t.destinationWalletId ?? null,
        destinationWalletName: t.destinationWalletName ?? null,
        description: t.description,
        date: toIso(t.date),
        tags: Array.isArray(t.tags) ? t.tags : [],
        receiptUrl: t.receiptUrl ?? undefined,
        isRecurring: t.isRecurring ?? false,
        recurringId: t.recurringId ?? undefined,
        categoryId: t.categoryId ?? undefined,
        subCategoryId: t.subCategoryId ?? undefined,
    };
}
function serializeBudget(b) {
    return {
        id: b.id,
        category: b.category,
        categoryIcon: b.categoryIcon,
        limit: toNumber(b.limit),
        spent: toNumber(b.spent),
        period: b.period,
        color: b.color,
        walletId: b.walletId ?? undefined,
        categoryId: b.categoryId ?? undefined,
        subCategoryId: b.subCategoryId ?? undefined,
    };
}
/**
 * Serialize a master Category together with its sub-categories.
 * Input row follows the Prisma `Category` shape (with an optional
 * `subCategories` include).
 */
function serializeCategory(c) {
    return {
        id: c.id,
        type: c.type,
        name: c.name,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder ?? 0,
        isSystem: Boolean(c.isSystem),
        subCategories: (c.subCategories ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            color: s.color,
            sortOrder: s.sortOrder ?? 0,
            isSystem: Boolean(s.isSystem),
            categoryId: s.categoryId,
            createdAt: toIso(s.createdAt),
            updatedAt: toIso(s.updatedAt),
        })),
        createdAt: toIso(c.createdAt),
        updatedAt: toIso(c.updatedAt),
    };
}
function serializeSubCategory(s) {
    return {
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color,
        sortOrder: s.sortOrder ?? 0,
        isSystem: Boolean(s.isSystem),
        categoryId: s.categoryId,
        createdAt: toIso(s.createdAt),
        updatedAt: toIso(s.updatedAt),
    };
}
/**
 * When a caller writes a Transaction/Budget/Bill with a `categoryId` (or
 * `subCategoryId`) instead of the legacy `category` string, this helper
 * resolves the names and folds them back into the body so:
 *   1. Old reports & lookups that match by string keep working.
 *   2. The icon/color stay in sync with the master pick.
 *
 * Returns a new body — never mutates the input.
 */
async function resolveCategoryNames(body) {
    const out = { ...body };
    const subCategoryId = body.subCategoryId;
    const categoryId = body.categoryId;
    if (subCategoryId) {
        const sub = await prisma.subCategory.findUnique({
            where: { id: subCategoryId },
            include: { category: true },
        });
        if (sub) {
            // Sub-category drives the "jenis" detail; master drives the umbrella name.
            out.subCategoryId = sub.id;
            out.categoryId = sub.categoryId;
            out.category = sub.category.name;
            out.categoryIcon = sub.icon || sub.category.icon;
        }
        else if (categoryId) {
            const cat = await prisma.category.findUnique({
                where: { id: categoryId },
            });
            if (cat) {
                out.category = cat.name;
                out.categoryIcon = out.categoryIcon || cat.icon;
            }
        }
    }
    else if (categoryId) {
        const cat = await prisma.category.findUnique({
            where: { id: categoryId },
        });
        if (cat) {
            out.category = cat.name;
            if (!out.categoryIcon)
                out.categoryIcon = cat.icon;
        }
    }
    return out;
}
function serializeInvestment(i) {
    return {
        id: i.id,
        name: i.name,
        symbol: i.symbol,
        assetClass: i.assetClass,
        broker: i.broker,
        quantity: toNumber(i.quantity),
        soldQuantity: toNumber(i.soldQuantity ?? 0),
        avgBuyPrice: toNumber(i.avgBuyPrice),
        currentPrice: toNumber(i.currentPrice),
        currency: i.currency,
        color: i.color,
        sellPrice: i.sellPrice != null ? toNumber(i.sellPrice) : null,
        soldAt: i.soldAt ? new Date(i.soldAt).toISOString() : null,
        buyFee: i.buyFee != null ? toNumber(i.buyFee) : null,
        sellFee: i.sellFee != null ? toNumber(i.sellFee) : null,
    };
}
function normalizeInvestmentBody(body) {
    const assetClass = String(body.assetClass ?? "stock");
    // Store symbol WITHOUT .JK suffix. The price fetcher adds it back when needed.
    const symbol = String(body.symbol ?? "")
        .trim()
        .toUpperCase()
        .replace(/\.JK$/, "");
    return {
        name: String(body.name ?? symbol),
        symbol,
        assetClass,
        broker: String(body.broker ?? "Lainnya"),
        quantity: Number(body.quantity ?? 0),
        // soldQuantity is server-managed (derived from sell events on
        // the existing row); the body is ignored on create/update. The
        // field still shows up here so the Prisma `data` spread works
        // and so a defensive caller can override it.
        soldQuantity: Number(body.soldQuantity ?? 0),
        avgBuyPrice: Number(body.avgBuyPrice ?? 0),
        currentPrice: Number(body.currentPrice ?? 0),
        currency: String(body.currency ?? "IDR"),
        color: String(body.color ?? "#FFD147"),
        sellPrice: body.sellPrice !== undefined && body.sellPrice !== null
            ? Number(body.sellPrice)
            : null,
        soldAt: body.soldAt !== undefined && body.soldAt !== null
            ? new Date(String(body.soldAt))
            : null,
        buyFee: body.buyFee !== undefined && body.buyFee !== null
            ? Number(body.buyFee)
            : 0,
        sellFee: body.sellFee !== undefined && body.sellFee !== null
            ? Number(body.sellFee)
            : null,
    };
}
function serializeBill(b) {
    return {
        walletId: b.walletId ?? undefined,
        id: b.id,
        name: b.name,
        amount: toNumber(b.amount),
        dueDate: toIso(b.dueDate),
        status: b.status,
        category: b.category,
        icon: b.icon,
        isRecurring: b.isRecurring,
        recurringPeriod: b.recurringPeriod ?? undefined,
    };
}
function serializeSavingGoal(g) {
    return {
        walletId: g.walletId ?? undefined,
        autoSave: g.autoSave ?? false,
        autoSaveAmount: g.autoSaveAmount == null ? undefined : toNumber(g.autoSaveAmount),
        id: g.id,
        name: g.name,
        icon: g.icon,
        targetAmount: toNumber(g.targetAmount),
        currentAmount: toNumber(g.currentAmount),
        deadline: toIso(g.deadline),
        color: g.color,
    };
}
function serializeNote(n) {
    return {
        id: n.id,
        title: n.title,
        content: n.content,
        tags: Array.isArray(n.tags) ? n.tags : [],
        color: n.color,
        createdAt: toIso(n.createdAt),
        updatedAt: toIso(n.updatedAt),
    };
}
function serializeRecurring(r) {
    return {
        id: r.id,
        name: r.name,
        amount: toNumber(r.amount),
        type: r.type,
        category: r.category,
        categoryIcon: r.categoryIcon,
        walletId: r.walletId,
        period: r.period,
        nextDate: toIso(r.nextDate),
        isActive: r.isActive,
    };
}
function serializeDebt(d) {
    return {
        walletId: d.walletId ?? undefined,
        id: d.id,
        direction: d.direction,
        personName: d.personName,
        personContact: d.personContact ?? undefined,
        amount: toNumber(d.amount),
        paidAmount: toNumber(d.paidAmount),
        dueDate: d.dueDate ? toIso(d.dueDate) : undefined,
        description: d.description,
        installments: Array.isArray(d.installments) ? d.installments : [],
        isSettled: d.isSettled,
        createdAt: toIso(d.createdAt),
    };
}
function serializeDebtContact(c) {
    return {
        id: c.id,
        name: c.name,
        phone: c.phone ?? undefined,
        note: c.note ?? undefined,
        createdAt: toIso(c.createdAt),
    };
}
function serializeSplitBillParticipant(p) {
    return {
        walletId: p.walletId ?? undefined,
        id: p.id,
        name: p.name,
        contact: p.contact ?? undefined,
        amount: toNumber(p.amount),
        paid: p.paid,
        paidAt: p.paidAt ? toIso(p.paidAt) : undefined,
        payToken: p.payToken ?? undefined,
    };
}
/**
 * Generate a short, URL-safe random token for public pay links.
 * ~22 chars from 64-symbol alphabet — 132 bits of entropy, plenty for
 * unguessability. Prefixed so it's easy to spot in logs.
 */
function generatePayToken() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const bytes = new Uint8Array(16);
    // Web Crypto is available in Node 19+; fall back to Math.random for
    // very old runtimes (still 64^16 ≈ 10^28 combinations, fine for a
    // self-hosted app).
    const cryptoObj = globalThis.crypto ??
        require("crypto").webcrypto;
    if (cryptoObj?.getRandomValues) {
        cryptoObj.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < bytes.length; i++)
            bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = "";
    for (let i = 0; i < bytes.length; i++)
        out += alphabet[bytes[i] & 63];
    return `pay_${out}`;
}
/**
 * Lazily backfill payToken for any participants that don't have one.
 * Safe to call on every read — only writes when a token is missing.
 * Used to migrate bills that were created before payToken existed.
 */
async function ensurePayTokens(bills) {
    for (const bill of bills) {
        if (!bill.participants)
            continue;
        for (const p of bill.participants) {
            if (!p.payToken) {
                try {
                    await prisma.splitBillParticipant.update({
                        where: { id: p.id },
                        data: { payToken: generatePayToken() },
                    });
                    p.payToken = "<backfilled>"; // marker so caller can re-fetch
                }
                catch (e) {
                    // Unique-constraint race: another concurrent request just
                    // minted a token. Re-read it. Fall back to leaving it null.
                    console.warn("[split-bills] backfill failed for", p.id, e);
                }
            }
        }
    }
}
/** Compute the signed delta this transaction applies to its wallet. */
function walletDelta(tx) {
    const amount = toNumber(tx.amount);
    if (tx.type === "income")
        return amount;
    if (tx.type === "expense")
        return -amount;
    if (tx.type === "transfer")
        return -amount;
    return 0;
}
async function validateTransactionWallets(client, data, userId) {
    if (!Number.isFinite(toNumber(data.amount)) || toNumber(data.amount) <= 0)
        throw new Error("Nominal transaksi harus lebih dari nol");
    const source = await client.wallet.findFirst({
        where: scopedWhere(userId, data.walletId),
    });
    if (!source)
        throw new Error("Dompet asal tidak tersedia");
    data.walletName = source.name;
    if (data.type !== "transfer") {
        data.destinationWalletId = null;
        data.destinationWalletName = null;
        return;
    }
    if (!data.destinationWalletId || data.destinationWalletId === data.walletId)
        throw new Error("Pilih dompet tujuan yang berbeda dari dompet asal");
    const destination = await client.wallet.findFirst({
        where: scopedWhere(userId, data.destinationWalletId),
    });
    if (!destination)
        throw new Error("Dompet tujuan tidak tersedia");
    if (source.currency !== destination.currency)
        throw new Error("Transfer memerlukan dompet dengan mata uang yang sama");
    data.destinationWalletName = destination.name;
}
async function changeTransactionBalances(client, transaction, sign) {
    await client.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: walletDelta(transaction) * sign } },
    });
    if (transaction.type === "transfer" && transaction.destinationWalletId) {
        await client.wallet.update({
            where: { id: transaction.destinationWalletId },
            data: { balance: { increment: toNumber(transaction.amount) * sign } },
        });
    }
    if (transaction.type === "expense" && transaction.category) {
        await client.budget.updateMany({
            where: { category: transaction.category, userId: transaction.userId },
            data: { spent: { increment: toNumber(transaction.amount) * sign } },
        });
    }
}
function serializeSplitBill(b) {
    return {
        walletId: b.walletId ?? undefined,
        id: b.id,
        title: b.title,
        description: b.description,
        totalAmount: toNumber(b.totalAmount),
        currency: b.currency,
        paidBy: b.paidBy,
        date: toIso(b.date),
        splitMethod: b.splitMethod,
        status: b.status,
        createdAt: toIso(b.createdAt),
        updatedAt: toIso(b.updatedAt),
        participants: (b.participants ?? []).map(serializeSplitBillParticipant),
    };
}
function serializeCard(c) {
    return {
        id: c.id,
        name: c.name,
        bank: c.bank,
        type: c.type,
        last4Digits: c.last4Digits,
        limit: toNumber(c.limit) || undefined,
        used: toNumber(c.used) || undefined,
        billingCycleStart: c.billingCycleStart,
        statementDate: c.statementDate,
        dueDate: c.dueDate,
        color: c.color,
        interestRate: toNumber(c.interestRate) || undefined,
    };
}
function serializeWishlistItem(w) {
    return {
        id: w.id,
        name: w.name,
        price: toNumber(w.price),
        icon: w.icon,
        priority: w.priority,
        category: w.category,
        url: w.url ?? undefined,
        notes: w.notes ?? undefined,
        isPurchased: w.isPurchased,
        createdAt: toIso(w.createdAt),
    };
}
function serializeReimbursement(r) {
    return {
        id: r.id,
        title: r.title,
        amount: toNumber(r.amount),
        paidFrom: r.paidFrom,
        walletName: r.walletName,
        project: r.project ?? undefined,
        company: r.company ?? undefined,
        status: r.status,
        submittedDate: toIso(r.submittedDate),
        settledDate: r.settledDate ? toIso(r.settledDate) : undefined,
        notes: r.notes ?? undefined,
        receiptUrl: r.receiptUrl ?? undefined,
    };
}
function serializeTeamMember(t) {
    return {
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone ?? undefined,
        avatar: t.avatar ?? undefined,
        role: t.role,
        permissions: typeof t.permissions === "object" && t.permissions ? t.permissions : {},
        status: t.status,
        invitedAt: t.invitedAt ? toIso(t.invitedAt) : undefined,
        joinedAt: toIso(t.createdAt),
    };
}
function serializeUserProfile(u) {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? undefined,
        avatar: u.avatar ?? undefined,
        currency: u.currency,
        language: u.language,
        timezone: u.timezone,
        monthlyIncome: toNumber(u.monthlyIncome) || undefined,
        disposableIncome: toNumber(u.disposableIncome) || undefined,
        joinedAt: toIso(u.createdAt),
    };
}
function serializeNotificationSetting(n) {
    return {
        channels: {
            whatsapp: {
                enabled: n.channelWA,
                phone: n.channelPhone,
            },
            telegram: {
                enabled: n.channelTG,
                chatId: n.channelTGChatId,
                botToken: n.channelTGBot,
            },
            email: {
                enabled: n.channelEmail,
                address: n.channelEmailAddr,
            },
            push: {
                enabled: n.channelPush,
            },
        },
        preferences: {
            dailyReminder: n.prefDailyReminder,
            dailyReminderTime: n.prefDailyReminderTime,
            weeklyReport: n.prefWeeklyReport,
            weeklyReportDay: n.prefWeeklyReportDay,
            monthlyReport: n.prefMonthlyReport,
            budgetAlert: n.prefBudgetAlert,
            budgetAlertThreshold: n.prefBudgetAlertThreshold,
            billReminder: n.prefBillReminder,
            billReminderDays: n.prefBillReminderDays,
            savingGoalUpdate: n.prefSavingGoalUpdate,
            debtReminder: n.prefDebtReminder,
            largeTransactionAlert: n.prefLargeTxAlert,
            largeTransactionThreshold: toNumber(n.prefLargeTxThreshold),
        },
    };
}
function denormalizeNotificationSettings(body) {
    const channels = body.channels ?? {};
    const prefs = body.preferences ?? {};
    const wa = channels.whatsapp ?? {};
    const tg = channels.telegram ?? {};
    const email = channels.email ?? {};
    const push = channels.push ?? {};
    return {
        channelWA: Boolean(wa.enabled),
        channelPhone: String(wa.phone ?? ""),
        channelTG: Boolean(tg.enabled),
        channelTGChatId: String(tg.chatId ?? ""),
        channelTGBot: String(tg.botToken ?? ""),
        channelEmail: Boolean(email.enabled),
        channelEmailAddr: String(email.address ?? ""),
        channelPush: Boolean(push.enabled),
        prefDailyReminder: Boolean(prefs.dailyReminder),
        prefDailyReminderTime: String(prefs.dailyReminderTime ?? "08:00"),
        prefWeeklyReport: Boolean(prefs.weeklyReport),
        prefWeeklyReportDay: Number(prefs.weeklyReportDay ?? 1),
        prefMonthlyReport: Boolean(prefs.monthlyReport),
        prefBudgetAlert: Boolean(prefs.budgetAlert),
        prefBudgetAlertThreshold: Number(prefs.budgetAlertThreshold ?? 80),
        prefBillReminder: Boolean(prefs.billReminder),
        prefBillReminderDays: Number(prefs.billReminderDays ?? 3),
        prefSavingGoalUpdate: Boolean(prefs.savingGoalUpdate),
        prefDebtReminder: Boolean(prefs.debtReminder),
        prefLargeTxAlert: Boolean(prefs.largeTransactionAlert),
        prefLargeTxThreshold: Number(prefs.largeTransactionThreshold ?? 1000000),
    };
}
function serializeGamificationState(g) {
    return {
        totalXP: g.totalXP,
        level: g.level,
        levelName: g.levelName,
        healthScore: g.healthScore,
        breakdown: {
            savings: g.savingsScore,
            budget: g.budgetScore,
            debt: g.debtScore,
            investment: g.investmentScore,
        },
        currentStreak: g.currentStreak,
        longestStreak: g.longestStreak,
        zeroSpendStreak: g.zeroSpendStreak,
        totalZeroSpendDays: g.totalZeroSpendDays,
        badges: Array.isArray(g.badges) ? g.badges : [],
        lastUpdated: toIso(g.lastUpdated),
    };
}
function denormalizeGamificationState(body) {
    const breakdown = body.breakdown ?? {};
    return {
        totalXP: Number(body.totalXP ?? 0),
        level: Number(body.level ?? 1),
        levelName: String(body.levelName ?? "Pemula Finansial"),
        healthScore: Number(body.healthScore ?? 0),
        savingsScore: Number(breakdown.savings ?? 0),
        budgetScore: Number(breakdown.budget ?? 0),
        debtScore: Number(breakdown.debt ?? 0),
        investmentScore: Number(breakdown.investment ?? 0),
        currentStreak: Number(body.currentStreak ?? 0),
        longestStreak: Number(body.longestStreak ?? 0),
        zeroSpendStreak: Number(body.zeroSpendStreak ?? 0),
        totalZeroSpendDays: Number(body.totalZeroSpendDays ?? 0),
        badges: body.badges ?? [],
        lastUpdated: new Date(),
    };
}
function strictUserIdFromRequest(request) {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    const auth = token ? verifyToken(token) : null;
    return auth?.sub ?? null;
}
function databaseSerializer(serialize) {
    return (value) => {
        // The dispatcher pairs these values with rows from the corresponding Prisma model.
        const row = value;
        return serialize(row);
    };
}
const recordSerializers = {
    wallets: databaseSerializer(serializeWallet),
    transactions: databaseSerializer(serializeTransaction),
    budgets: databaseSerializer(serializeBudget),
    investments: databaseSerializer(serializeInvestment),
    bills: databaseSerializer(serializeBill),
    savingGoals: databaseSerializer(serializeSavingGoal),
    notes: databaseSerializer(serializeNote),
    recurringTransactions: databaseSerializer(serializeRecurring),
    debts: databaseSerializer(serializeDebt),
    debtContacts: databaseSerializer(serializeDebtContact),
    splitBills: databaseSerializer(serializeSplitBill),
    cards: databaseSerializer(serializeCard),
    wishlist: databaseSerializer(serializeWishlistItem),
    reimbursements: databaseSerializer(serializeReimbursement),
    teamMembers: databaseSerializer(serializeTeamMember),
    categories: databaseSerializer(serializeCategory),
    subCategories: databaseSerializer(serializeSubCategory),
};
function serializeFinanceRecord(resource, row) {
    const serialize = recordSerializers[resource];
    if (!serialize)
        throw new PaginationError("Resource tidak mendukung pagination");
    return serialize(row);
}
async function listPagedResource(resource, request, query) {
    const input = readPage(query);
    const scope = {
        userId: currentUserIdFromRequest(request),
        authId: strictUserIdFromRequest(request),
    };
    const ledger = await listLedger(resource, scope, query, input, serializeFinanceRecord);
    if (ledger !== null)
        return ledger;
    const assets = await listAssets(resource, scope, query, input, serializeFinanceRecord);
    if (assets !== null)
        return assets;
    const people = await listPeople(resource, scope, query, input, serializeFinanceRecord);
    if (people !== null)
        return people;
    throw new PaginationError("Daftar tidak didukung");
}
async function createPrismaResource(resource, body, userId, restore = false) {
    const data = {
        ...body,
        userId: userId ?? undefined,
    };
    // Resolve master category names for resources that store `category` as a
    // string. Resources without category FKs (wallets, investments, …) skip
    // the round-trip entirely.
    const categoryAware = [
        "transactions",
        "budgets",
        "bills",
        "recurringTransactions",
    ];
    const resolved = categoryAware.includes(resource)
        ? await resolveCategoryNames(data)
        : data;
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        const model = { bills: "bill", savingGoals: "savingGoal", debts: "debt" }[resource];
        return prisma.$transaction(async (client) => {
            const prepared = resourceWalletUpdate(resource, null, resolved);
            if (resource === "bills")
                prepared.dueDate = new Date(String(prepared.dueDate));
            if (resource === "savingGoals")
                prepared.deadline = new Date(String(prepared.deadline));
            if (resource === "debts" && prepared.dueDate)
                prepared.dueDate = new Date(String(prepared.dueDate));
            if (restore)
                prepared.walletEffects = [];
            await reconcileWalletEffects(client, [], prepared.walletEffects, userId);
            const created = await client[model].create({ data: prepared });
            return resource === "bills"
                ? serializeBill(created)
                : resource === "savingGoals"
                    ? serializeSavingGoal(created)
                    : serializeDebt(created);
        });
    }
    switch (resource) {
        case "wallets": {
            const created = await prisma.wallet.create({ data: data });
            return serializeWallet(created);
        }
        case "transactions": {
            return prisma.$transaction(async (client) => {
                const data = { ...resolved, date: new Date(body.date) };
                await validateTransactionWallets(client, data, userId);
                const created = await client.transaction.create({
                    data: data,
                });
                if (!restore)
                    await changeTransactionBalances(client, created, 1);
                return serializeTransaction(created);
            });
        }
        case "budgets": {
            const created = await prisma.budget.create({ data: resolved });
            return serializeBudget(created);
        }
        case "investments": {
            const investment = normalizeInvestmentBody(body);
            if (restore && body.id) {
                const created = await prisma.investment.create({
                    data: {
                        ...investment,
                        id: String(body.id),
                        userId: userId ?? undefined,
                    },
                });
                return serializeInvestment(created);
            }
            // Only merge with positions that are still open. A fully
            // sold position (quantity = 0) or a partially sold position
            // (quantity > 0 with some soldQuantity) is still "open" in
            // the sense that the user can re-buy. A position with
            // quantity = 0 is closed — buying again on the same
            // (broker, symbol, assetClass) is a fresh position, not an
            // update to the historical one. Filtering on quantity > 0
            // gives us both behaviors.
            const existing = await prisma.investment.findFirst({
                where: {
                    userId,
                    broker: investment.broker,
                    symbol: investment.symbol,
                    assetClass: investment.assetClass,
                    quantity: { gt: 0 },
                },
            });
            if (existing) {
                const oldQty = toNumber(existing.quantity);
                const addQty = investment.quantity;
                const nextQty = oldQty + addQty;
                const nextAvg = nextQty > 0
                    ? (oldQty * toNumber(existing.avgBuyPrice) +
                        addQty * investment.avgBuyPrice) /
                        nextQty
                    : investment.avgBuyPrice;
                const updated = await prisma.investment.update({
                    where: { id: existing.id },
                    data: {
                        name: investment.name || existing.name,
                        quantity: nextQty,
                        avgBuyPrice: nextAvg,
                        currentPrice: investment.currentPrice || existing.currentPrice,
                        currency: investment.currency,
                        color: investment.color,
                        buyFee: (toNumber(existing.buyFee) ?? 0) + (investment.buyFee ?? 0),
                    },
                });
                return serializeInvestment(updated);
            }
            const created = await prisma.investment.create({
                data: { ...investment, userId: userId ?? undefined },
            });
            return serializeInvestment(created);
        }
        case "notes": {
            const created = await prisma.note.create({ data: data });
            return serializeNote(created);
        }
        case "recurringTransactions": {
            const created = await prisma.recurringTransaction.create({
                data: {
                    ...resolved,
                    nextDate: new Date(body.nextDate),
                },
            });
            return serializeRecurring(created);
        }
        case "debtContacts": {
            const contact = contactBody.parse(body);
            const name = contact.name.replace(/\s+/g, " ");
            const existingIds = await prisma.$queryRaw(Prisma.sql `SELECT "id" FROM "DebtContact" WHERE "userId" = ${userId} AND lower(regexp_replace(trim("name"), '\\s+', ' ', 'g')) = ${name.toLowerCase()} ORDER BY "id" LIMIT 1`);
            const fields = { name, phone: contact.phone?.trim(), note: contact.note?.trim() };
            const created = existingIds.length
                ? await prisma.debtContact.update({ where: { id: existingIds[0].id }, data: fields })
                : await prisma.debtContact.create({ data: { ...fields, id: contact.id, userId } });
            return serializeDebtContact(created);
        }
        case "cards": {
            const created = await prisma.card.create({ data: data });
            return serializeCard(created);
        }
        case "wishlist": {
            const created = await prisma.wishlistItem.create({ data: data });
            return serializeWishlistItem(created);
        }
        case "reimbursements": {
            const created = await prisma.reimbursement.create({
                data: {
                    ...data,
                    submittedDate: new Date(body.submittedDate),
                    settledDate: body.settledDate
                        ? new Date(body.settledDate)
                        : undefined,
                },
            });
            return serializeReimbursement(created);
        }
        case "teamMembers": {
            const member = memberBody.parse(body);
            const created = await prisma.teamMember.create({
                data: { ...member, userId, invitedAt: member.invitedAt ? new Date(member.invitedAt) : undefined },
            });
            return serializeTeamMember(created);
        }
        case "categories": {
            const created = await prisma.category.create({
                data: data,
                include: { subCategories: true },
            });
            return serializeCategory(created);
        }
        case "subCategories": {
            const created = await prisma.subCategory.create({
                data: data,
            });
            return serializeSubCategory(created);
        }
        default:
            throw new Error("Resource tidak didukung");
    }
}
async function updatePrismaResource(resource, resourceId, body, userId) {
    // Strip protected fields. The client must not be able to change
    // ownership (`userId`), claim a different `id`, or rewrite server-
    // managed timestamps via the body — these are all server-controlled.
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...safeBody } = body;
    const data = { ...safeBody };
    if (resource === "transactions" && safeBody.date)
        data.date = new Date(safeBody.date);
    if (resource === "bills" && safeBody.dueDate)
        data.dueDate = new Date(safeBody.dueDate);
    if (resource === "savingGoals" && safeBody.deadline)
        data.deadline = new Date(safeBody.deadline);
    if (resource === "recurringTransactions" && safeBody.nextDate)
        data.nextDate = new Date(safeBody.nextDate);
    // Resolve master category names for resources that store `category` as a
    // string. Resources without category FKs (wallets, investments, …) skip
    // the round-trip entirely.
    const categoryAware = [
        "transactions",
        "budgets",
        "bills",
        "recurringTransactions",
    ];
    const resolved = categoryAware.includes(resource)
        ? await resolveCategoryNames(data)
        : data;
    // Every case below first verifies the row exists AND is owned by
    // the caller (or caller is admin). Throwing "Data tidak ditemukan"
    // here is caught by the route handler and surfaced as 404 — we
    // deliberately don't differentiate "not found" from "not yours" to
    // avoid leaking ownership info.
    const where = scopedWhere(userId, resourceId);
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        const model = { bills: "bill", savingGoals: "savingGoal", debts: "debt" }[resource];
        return prisma.$transaction(async (client) => {
            await lockFinanceRecord(client, resource, resourceId);
            const existing = await client[model].findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const prepared = resourceWalletUpdate(resource, existing, resolved);
            await reconcileWalletEffects(client, existing.walletEffects, prepared.walletEffects, userId);
            const updated = await client[model].update({
                where: { id: resourceId },
                data: prepared,
            });
            return resource === "bills"
                ? serializeBill(updated)
                : resource === "savingGoals"
                    ? serializeSavingGoal(updated)
                    : serializeDebt(updated);
        });
    }
    switch (resource) {
        case "wallets": {
            const existing = await prisma.wallet.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.wallet.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeWallet(updated);
        }
        case "transactions": {
            return prisma.$transaction(async (client) => {
                const existing = await client.transaction.findFirst({ where });
                if (!existing)
                    throw new Error("Data tidak ditemukan");
                const merged = { ...existing, ...resolved };
                await validateTransactionWallets(client, merged, userId);
                const updated = await client.transaction.update({
                    where: { id: resourceId },
                    data: {
                        ...resolved,
                        walletName: merged.walletName,
                        destinationWalletId: merged.destinationWalletId,
                        destinationWalletName: merged.destinationWalletName,
                    },
                });
                await changeTransactionBalances(client, existing, -1);
                await changeTransactionBalances(client, updated, 1);
                return serializeTransaction(updated);
            });
        }
        case "budgets": {
            const existing = await prisma.budget.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.budget.update({
                where: { id: resourceId },
                data: resolved,
            });
            return serializeBudget(updated);
        }
        case "investments": {
            const existing = await prisma.investment.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const normalized = normalizeInvestmentBody({ ...body });
            const existingQty = toNumber(existing.quantity);
            const existingSoldQty = toNumber(existing.soldQuantity ?? 0);
            // Sell event handling. Three cases:
            //   1. Body sets sellPrice + sellQuantity → reduce quantity by
            //      sellQuantity (floor 0), bump soldQuantity. Partial
            //      sells leave the position open with a non-zero quantity.
            //   2. Body sets sellPrice without sellQuantity → backwards-
            //      compat full sell. quantity drops to 0, soldQuantity
            //      increases by what was still held.
            //   3. Body sets sellPrice to null → undo a sell. The user
            //      is un-selling the last event: we restore the quantity
            //      and zero out soldQuantity. We don't try to be clever
            //      about partial undo (no history table for that yet).
            let sellDerived = {};
            if (body.sellPrice !== undefined && body.sellPrice !== null) {
                const explicitSellQty = body.sellQuantity !== undefined ? Number(body.sellQuantity) : null;
                if (explicitSellQty !== null) {
                    if (explicitSellQty <= 0) {
                        throw new Error("Jumlah jual harus lebih dari 0");
                    }
                    if (explicitSellQty > existingQty) {
                        throw new Error(`Tidak bisa jual ${explicitSellQty} lot, hanya punya ${existingQty}`);
                    }
                    sellDerived = {
                        quantity: existingQty - explicitSellQty,
                        soldQuantity: existingSoldQty + explicitSellQty,
                    };
                }
                else {
                    // Backwards-compat: setting sellPrice alone means full sell.
                    sellDerived = {
                        quantity: 0,
                        soldQuantity: existingSoldQty + existingQty,
                    };
                }
            }
            else if (body.sellPrice === null) {
                // Undo the last sell. Restore the held amount and zero
                // out the cumulative sold counter.
                sellDerived = {
                    quantity: existingQty + existingSoldQty,
                    soldQuantity: 0,
                };
            }
            const updated = await prisma.investment.update({
                where: { id: resourceId },
                data: {
                    ...normalized,
                    name: body.name === undefined ? undefined : normalized.name,
                    symbol: body.symbol === undefined ? undefined : normalized.symbol,
                    assetClass: body.assetClass === undefined ? undefined : normalized.assetClass,
                    broker: body.broker === undefined ? undefined : normalized.broker,
                    // quantity is server-managed on sell/undo; only let the
                    // client override it when the body explicitly sends one
                    // *and* there's no sell event in the same request.
                    quantity: body.quantity === undefined && Object.keys(sellDerived).length === 0
                        ? undefined
                        : body.quantity !== undefined
                            ? normalized.quantity
                            : sellDerived.quantity,
                    soldQuantity: body.soldQuantity === undefined
                        ? sellDerived.soldQuantity
                        : normalized.soldQuantity,
                    avgBuyPrice: body.avgBuyPrice === undefined ? undefined : normalized.avgBuyPrice,
                    currentPrice: body.currentPrice === undefined
                        ? undefined
                        : normalized.currentPrice,
                    currency: body.currency === undefined ? undefined : normalized.currency,
                    color: body.color === undefined ? undefined : normalized.color,
                    sellPrice: body.sellPrice === undefined ? undefined : normalized.sellPrice,
                    soldAt: body.soldAt === undefined ? undefined : normalized.soldAt,
                    buyFee: body.buyFee === undefined ? undefined : normalized.buyFee,
                    sellFee: body.sellFee === undefined ? undefined : normalized.sellFee,
                },
            });
            return serializeInvestment(updated);
        }
        case "notes": {
            const existing = await prisma.note.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.note.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeNote(updated);
        }
        case "recurringTransactions": {
            const existing = await prisma.recurringTransaction.findFirst({
                where,
            });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.recurringTransaction.update({
                where: { id: resourceId },
                data: resolved,
            });
            return serializeRecurring(updated);
        }
        case "debtContacts": {
            const existing = await prisma.debtContact.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.debtContact.update({
                where: { id: resourceId },
                data: {
                    ...data,
                    ...(body.name !== undefined
                        ? { name: String(body.name).trim() }
                        : {}),
                    ...(body.phone !== undefined
                        ? { phone: body.phone ? String(body.phone).trim() : null }
                        : {}),
                    ...(body.note !== undefined
                        ? { note: body.note ? String(body.note).trim() : null }
                        : {}),
                },
            });
            return serializeDebtContact(updated);
        }
        case "cards": {
            const existing = await prisma.card.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.card.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeCard(updated);
        }
        case "wishlist": {
            const existing = await prisma.wishlistItem.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.wishlistItem.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeWishlistItem(updated);
        }
        case "reimbursements": {
            const existing = await prisma.reimbursement.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.reimbursement.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeReimbursement(updated);
        }
        case "teamMembers": {
            const existing = await prisma.teamMember.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.teamMember.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeTeamMember(updated);
        }
        case "categories": {
            const existing = await prisma.category.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.category.update({
                where: { id: resourceId },
                data: data,
                include: { subCategories: true },
            });
            return serializeCategory(updated);
        }
        case "subCategories": {
            const existing = await prisma.subCategory.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.subCategory.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeSubCategory(updated);
        }
        default:
            throw new Error("Resource tidak didukung");
    }
}
async function deletePrismaResource(resource, resourceId, userId) {
    // Same ownership rule as update: non-admin can only delete their own
    // rows. `deleteMany` with count check is one query; for transactions
    // we still need findFirst first so we can reverse the balance/budget
    // delta before the row disappears.
    const where = scopedWhere(userId, resourceId);
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        const model = { bills: "bill", savingGoals: "savingGoal", debts: "debt" }[resource];
        await prisma.$transaction(async (client) => {
            await lockFinanceRecord(client, resource, resourceId);
            const existing = await client[model].findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            await reconcileWalletEffects(client, existing.walletEffects, [], userId);
            await client[model].delete({ where: { id: resourceId } });
        });
        return;
    }
    switch (resource) {
        case "wallets": {
            const result = await prisma.wallet.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "transactions": {
            await prisma.$transaction(async (client) => {
                const existing = await client.transaction.findFirst({ where });
                if (!existing)
                    throw new Error("Data tidak ditemukan");
                await changeTransactionBalances(client, existing, -1);
                await client.transaction.delete({ where: { id: resourceId } });
            });
            return;
        }
        case "budgets": {
            const result = await prisma.budget.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "investments": {
            const result = await prisma.investment.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "notes": {
            const result = await prisma.note.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "recurringTransactions": {
            const result = await prisma.recurringTransaction.deleteMany({
                where,
            });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "debtContacts": {
            const result = await prisma.debtContact.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "cards": {
            const result = await prisma.card.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "wishlist": {
            const result = await prisma.wishlistItem.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "reimbursements": {
            const result = await prisma.reimbursement.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "teamMembers": {
            const result = await prisma.teamMember.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "categories": {
            // Cascade deletes the sub-categories via Prisma schema. The
            // `SetNull` on Transaction/Budget FKs keeps history rows intact.
            const result = await prisma.category.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "subCategories": {
            const result = await prisma.subCategory.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        default:
            throw new Error("Resource tidak didukung");
    }
}
async function getExportFromDb(userId, notificationUserId) {
    const filter = userId ? { userId } : {};
    const [wallets, transactions, budgets, investments, bills, savingGoals, notes, recurring, debts, debtContacts, cards, wishlist, reimbursements, teamMembers, splitBills, categories, subCategories,] = await Promise.all([
        prisma.wallet.findMany({ where: filter }),
        prisma.transaction.findMany({
            where: filter,
            orderBy: { date: "desc" },
        }),
        prisma.budget.findMany({ where: filter }),
        prisma.investment.findMany({
            where: filter,
            orderBy: [{ broker: "asc" }, { symbol: "asc" }],
        }),
        prisma.bill.findMany({ where: filter, orderBy: { dueDate: "asc" } }),
        prisma.savingGoal.findMany({ where: filter }),
        prisma.note.findMany({ where: filter, orderBy: { updatedAt: "desc" } }),
        prisma.recurringTransaction.findMany({ where: filter }),
        prisma.debt.findMany({ where: filter, orderBy: { createdAt: "desc" } }),
        prisma.debtContact.findMany({
            where: filter,
            orderBy: { name: "asc" },
        }),
        prisma.card.findMany({ where: filter }),
        prisma.wishlistItem.findMany({
            where: filter,
            orderBy: { createdAt: "desc" },
        }),
        prisma.reimbursement.findMany({
            where: filter,
            orderBy: { submittedDate: "desc" },
        }),
        prisma.teamMember.findMany({ where: filter }),
        prisma.splitBill.findMany({
            where: filter,
            include: { participants: true },
            orderBy: { date: "desc" },
        }),
        prisma.category.findMany({
            where: filter,
            orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
            include: {
                subCategories: {
                    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                },
            },
        }),
        prisma.subCategory.findMany({
            where: filter,
            orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        }),
    ]);
    await ensurePayTokens(splitBills);
    const setting = (await prisma.appSetting.findFirst()) ??
        (await prisma.appSetting.create({ data: {} }));
    // Admin sees all finance records, but notification settings belong to the logged-in account.
    const notifSetting = notificationUserId
        ? ((await prisma.notificationSetting.findUnique({
            where: { userId: notificationUserId },
        })) ??
            (await prisma.notificationSetting.create({
                data: { userId: notificationUserId },
            })))
        : null;
    return {
        wallets: nestWallets(wallets.map(serializeWallet)),
        transactions: transactions.map(serializeTransaction),
        budgets: budgets.map(serializeBudget),
        investments: investments.map(serializeInvestment),
        bills: bills.map(serializeBill),
        savingGoals: savingGoals.map(serializeSavingGoal),
        notes: notes.map(serializeNote),
        recurringTransactions: recurring.map(serializeRecurring),
        debts: debts.map(serializeDebt),
        debtContacts: debtContacts.map(serializeDebtContact),
        cards: cards.map(serializeCard),
        wishlist: wishlist.map(serializeWishlistItem),
        reimbursements: reimbursements.map(serializeReimbursement),
        teamMembers: teamMembers.map(serializeTeamMember),
        splitBills: splitBills.map(serializeSplitBill),
        categories: categories.map(serializeCategory),
        subCategories: subCategories.map(serializeSubCategory),
        ...(notifSetting
            ? { notificationSettings: serializeNotificationSetting(notifSetting) }
            : {}),
        appConfig: serializeAppSetting(setting),
    };
}
async function getLookupFromDb(userId, accountId) {
    const where = userId ? { userId } : {};
    const [wallets, categories, subCategories, profile, setting, notifications] = await Promise.all([
        prisma.wallet.findMany({
            where,
            select: { id: true, name: true, type: true, balance: true, currency: true, color: true, icon: true, parentId: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        prisma.category.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
        prisma.subCategory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
        prisma.user.findUnique({ where: { id: accountId } }),
        prisma.appSetting.findFirst(),
        prisma.notificationSetting.findUnique({ where: { userId: accountId } }),
    ]);
    const subRows = subCategories.map(serializeSubCategory);
    return {
        wallets: nestWallets(wallets.map(serializeWallet)),
        categories: categories.map((category) => ({
            ...serializeCategory(category),
            subCategories: subRows.filter((sub) => sub.categoryId === category.id),
        })),
        subCategories: subRows,
        ...(profile ? { userProfile: serializeUserProfile(profile) } : {}),
        ...(notifications ? { notificationSettings: serializeNotificationSetting(notifications) } : {}),
        appConfig: setting ? serializeAppSetting(setting) : appConfig,
    };
}
async function listUsers(query) {
    const input = readPage(query);
    const search = (query.search ?? "").trim();
    const role = query.role;
    const status = query.status;
    if (role && !["admin", "owner", "member"].includes(role))
        throw new PaginationError("Peran tidak valid");
    if (status && !["active", "pending", "inactive"].includes(status))
        throw new PaginationError("Status tidak valid");
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const days = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index));
    if (await canUseDatabase()) {
        const signupDate = Prisma.sql `("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
        const where = {
            ...(role === "admin" || role === "owner" || role === "member" ? { role } : {}),
            ...(status === "active" || status === "pending" || status === "inactive" ? { status } : {}),
            ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
        };
        const [result, roleCounts, statusCounts, newThisMonth, daysRows] = await Promise.all([
            databasePage(input, () => prisma.user.count({ where }), (skip, take) => prisma.user.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "asc" }] })),
            prisma.user.groupBy({ by: ["role"], _count: true }),
            prisma.user.groupBy({ by: ["status"], _count: true }),
            prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
            prisma.$queryRaw(Prisma.sql `SELECT to_char(${signupDate}, 'YYYY-MM-DD') AS day, COUNT(*) AS users FROM "User" WHERE "createdAt" >= ${days[0]} GROUP BY day`),
        ]);
        return { ...result, items: result.items.map(publicDbUser), summary: {
                total: roleCounts.reduce((total, row) => total + row._count, 0),
                totalUsers: roleCounts.reduce((total, row) => total + row._count, 0),
                activeUsers: statusCounts.find((row) => row.status === "active")?._count ?? 0,
                newThisMonth,
                last7: days.map((day) => ({
                    day: day.toLocaleDateString("id-ID", { weekday: "short" }),
                    users: Number(daysRows.find((row) => row.day === `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`)?.users ?? 0),
                })),
                roles: Object.fromEntries(roleCounts.map((row) => [row.role, row._count])),
                statuses: Object.fromEntries(statusCounts.map((row) => [row.status, row._count])),
            } };
    }
    if (isDatabaseConfigured())
        throw new Error("Database tidak tersedia");
    const rows = users.filter((user) => (!role || user.role === role) && (!status || user.status === status) &&
        (!search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())));
    return pageArray(rows.map(publicUser), input, {
        total: users.length,
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.status === "active").length,
        newThisMonth: users.filter((user) => new Date(user.createdAt) >= monthStart).length,
        last7: days.map((day) => ({ day: day.toLocaleDateString("id-ID", { weekday: "short" }), users: users.filter((user) => new Date(user.createdAt).toDateString() === day.toDateString()).length })),
        roles: Object.fromEntries(["admin", "owner", "member"].map((key) => [key, users.filter((user) => user.role === key).length])),
        statuses: Object.fromEntries(["active", "pending", "inactive"].map((key) => [key, users.filter((user) => user.status === key).length])),
    });
}
export const financeRoutes = new Elysia({ prefix: "/api" })
    .use(requireAuth)
    .onError(({ error, set }) => {
    if (error instanceof PaginationError) {
        set.status = error.status;
        return fail(error.message);
    }
})
    .get("/bootstrap", async ({ request, set }) => {
    if (await canUseDatabase()) {
        return ok(await getLookupFromDb(currentUserIdFromRequest(request), strictUserIdFromRequest(request)));
    }
    if (isDatabaseConfigured()) {
        set.status = 503;
        return fail("Database sementara tidak tersedia. Coba sinkronkan kembali.");
    }
    return ok({ wallets: db.wallets, categories: db.categories, subCategories: db.subCategories, appConfig });
})
    .get("/lookups", async ({ request, set }) => {
    if (await canUseDatabase())
        return ok(await getLookupFromDb(currentUserIdFromRequest(request), strictUserIdFromRequest(request)));
    if (isDatabaseConfigured()) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    return ok({ wallets: db.wallets, categories: db.categories, subCategories: db.subCategories });
})
    .get("/export", async ({ request, set }) => {
    if (await canUseDatabase())
        return ok(await getExportFromDb(currentUserIdFromRequest(request), strictUserIdFromRequest(request)));
    if (isDatabaseConfigured()) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    return ok({ ...db, appConfig });
})
    .get("/record-ids/:resource", async ({ request, params, query, set }) => {
    const table = Object.hasOwn(recordIdTables, params.resource) ? recordIdTables[params.resource] : undefined;
    if (!table) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    const input = readPage(query);
    const userId = currentUserIdFromRequest(request);
    if (await canUseDatabase()) {
        const tenant = userId ? Prisma.sql `"userId" = ${userId}` : Prisma.sql `TRUE`;
        const identifier = Prisma.raw(`"${table}"`);
        return ok(await databasePage(input, async () => Number((await prisma.$queryRaw(Prisma.sql `SELECT COUNT(*) AS count FROM ${identifier} WHERE ${tenant}`))[0].count), (skip, take) => prisma.$queryRaw(Prisma.sql `SELECT "id" FROM ${identifier} WHERE ${tenant} ORDER BY "id" LIMIT ${take} OFFSET ${skip}`)));
    }
    if (isDatabaseConfigured()) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    const resource = params.resource;
    const records = resource === "wallets" ? flattenWallets(db.wallets) : db[resource];
    const authId = strictUserIdFromRequest(request);
    const rows = records.filter((row) => {
        const owner = "userId" in row ? row.userId : null;
        return typeof owner === "string" ? !userId || owner === userId : authId === "usr-demo-001" || !userId;
    }).map((row) => ({ id: row.id })).sort((a, b) => a.id.localeCompare(b.id));
    return ok(pageArray(rows, input));
})
    .get("/market-search", async ({ query, set }) => {
    const input = readPage(query);
    try {
        const results = await searchYahooFinance(String(query.q ?? ""), String(query.assetClass ?? "stock"));
        return ok(pageArray(results, input));
    }
    catch (error) {
        set.status = 502;
        return fail(error instanceof Error ? error.message : "Yahoo Finance search gagal");
    }
})
    .get("/market-price/:symbol", async ({ params, query, set }) => {
    try {
        const result = await getYahooFinancePrice(params.symbol, String(query.assetClass ?? "stock"));
        if (!result) {
            set.status = 404;
            return fail("Harga market tidak ditemukan");
        }
        return ok(result);
    }
    catch (error) {
        set.status = 502;
        return fail(error instanceof Error ? error.message : "Yahoo Finance request gagal");
    }
})
    .get("/market-quote/:symbol", async ({ params, query, set }) => {
    try {
        const result = await getYahooFinanceQuote(params.symbol, String(query.assetClass ?? "stock"));
        if (!result) {
            set.status = 404;
            return fail("Quote market tidak ditemukan");
        }
        return ok(result);
    }
    catch (error) {
        set.status = 502;
        return fail(error instanceof Error ? error.message : "Yahoo Finance request gagal");
    }
})
    // Split Bill CRUD
    .get("/split-bills", async ({ request, query, set }) => {
    if (isDatabaseConfigured() && !(await canUseDatabase())) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    return ok(await listPagedResource("splitBills", request, query));
})
    .post("/split-bills", async ({ request, body, set }) => {
    const data = body;
    const userId = currentUserIdFromRequest(request);
    const amount = Number(data.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        set.status = 400;
        return fail("Nominal patungan tidak valid");
    }
    const effects = data.walletId
        ? [{ key: "initial", walletId: String(data.walletId), amount: -amount }]
        : [];
    const participants = (Array.isArray(data.participants) ? data.participants : []).map((participant) => ({
        id: participant.id || id("participant"),
        name: String(participant.name ?? ""),
        contact: participant.contact || null,
        amount: Number(participant.amount),
        paid: false,
        paidAt: null,
        payToken: generatePayToken(),
    }));
    const prepared = {
        id: data.id || id("splitBill"),
        title: String(data.title ?? "Patungan"),
        description: String(data.description ?? ""),
        totalAmount: amount,
        currency: "IDR",
        paidBy: String(data.paidBy ?? ""),
        date: new Date(data.date ?? Date.now()),
        splitMethod: data.splitMethod ?? "equal",
        status: "active",
        userId,
        walletId: data.walletId || null,
        walletEffects: effects,
    };
    try {
        if (!(await canUseDatabase())) {
            if (isDatabaseConfigured()) {
                set.status = 503;
                return fail("Database tidak tersedia");
            }
            updateMemoryWalletEffects([], effects);
            const created = {
                ...prepared,
                date: prepared.date.toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                participants,
            };
            db.splitBills.unshift(created);
            return ok(created);
        }
        const created = await prisma.$transaction(async (client) => {
            await reconcileWalletEffects(client, [], effects, userId);
            return client.splitBill.create({
                data: { ...prepared, participants: { create: participants } },
                include: { participants: true },
            });
        });
        return ok(serializeSplitBill(created));
    }
    catch (error) {
        set.status = 400;
        return fail(error instanceof Error ? error.message : "Gagal membuat patungan");
    }
})
    .put("/split-bills/:id", async ({ request, params, body, set }) => {
    const data = body;
    try {
        if (!(await canUseDatabase())) {
            if (isDatabaseConfigured()) {
                set.status = 503;
                return fail("Database tidak tersedia");
            }
            const existing = db.splitBills.find((bill) => bill.id === params.id);
            if (!existing)
                throw new Error("Patungan tidak ditemukan");
            const merged = { ...existing, ...data };
            const effects = merged.walletId
                ? [
                    {
                        key: "initial",
                        walletId: merged.walletId,
                        amount: -Number(merged.totalAmount),
                    },
                ]
                : [];
            updateMemoryWalletEffects(existing.walletEffects, effects);
            Object.assign(existing, {
                title: merged.title,
                description: merged.description,
                totalAmount: merged.totalAmount,
                paidBy: merged.paidBy,
                status: merged.status,
                walletId: merged.walletId,
                walletEffects: effects,
            });
            return ok(existing);
        }
        const updated = await prisma.$transaction(async (client) => {
            await lockFinanceRecord(client, "splitBills", params.id);
            const existing = await client.splitBill.findFirst({
                where: scopedWhere(currentUserIdFromRequest(request), params.id),
            });
            if (!existing)
                throw new Error("Patungan tidak ditemukan");
            const merged = { ...existing, ...data };
            const effects = merged.walletId
                ? [
                    {
                        key: "initial",
                        walletId: merged.walletId,
                        amount: -Number(merged.totalAmount),
                    },
                ]
                : [];
            await reconcileWalletEffects(client, existing.walletEffects, effects, existing.userId);
            return client.splitBill.update({
                where: { id: params.id },
                data: {
                    title: data.title,
                    description: data.description,
                    totalAmount: data.totalAmount,
                    paidBy: data.paidBy,
                    date: data.date ? new Date(data.date) : undefined,
                    splitMethod: data.splitMethod,
                    status: data.status,
                    walletId: merged.walletId,
                    walletEffects: effects,
                },
                include: { participants: true },
            });
        });
        return ok(serializeSplitBill(updated));
    }
    catch (error) {
        set.status = 400;
        return fail(error instanceof Error ? error.message : "Gagal mengubah patungan");
    }
})
    .put("/split-bills/:id/participants/:participantId", async ({ request, params, body, set }) => {
    if (!(await canUseDatabase())) {
        if (isDatabaseConfigured()) {
            set.status = 503;
            return fail("Database tidak tersedia");
        }
        try {
            const data = body;
            const bill = db.splitBills.find((item) => item.id === params.id);
            const participant = bill?.participants.find((item) => item.id === params.participantId);
            if (!participant)
                throw new Error("Peserta tidak ditemukan");
            if (data.paid && !data.walletId)
                throw new Error("Pilih dompet penerima pembayaran");
            const effects = data.paid
                ? [
                    {
                        key: "receipt",
                        walletId: String(data.walletId),
                        amount: Number(participant.amount),
                    },
                ]
                : [];
            updateMemoryWalletEffects(participant.walletEffects, effects);
            Object.assign(participant, {
                paid: Boolean(data.paid),
                paidAt: data.paid ? new Date().toISOString() : undefined,
                walletId: data.paid ? data.walletId : undefined,
                walletEffects: effects,
            });
            bill.status = bill.participants.every((item) => item.paid)
                ? "settled"
                : "active";
            return ok(participant);
        }
        catch (error) {
            set.status = 400;
            return fail(error instanceof Error
                ? error.message
                : "Gagal mencatat pembayaran");
        }
    }
    try {
        const data = body;
        const updated = await prisma.$transaction((client) => toggleSplitWalletPayment(client, params.id, params.participantId, Boolean(data.paid), data.walletId, currentUserIdFromRequest(request)));
        return ok(serializeSplitBillParticipant(updated));
    }
    catch (error) {
        set.status = 400;
        return fail(error instanceof Error ? error.message : "Gagal mencatat pembayaran");
    }
})
    .delete("/split-bills/:id", async ({ request, params, set }) => {
    if (!(await canUseDatabase())) {
        if (isDatabaseConfigured()) {
            set.status = 503;
            return fail("Database tidak tersedia");
        }
        const bills = db.splitBills;
        const index = bills.findIndex((bill) => bill.id === params.id);
        if (index < 0) {
            set.status = 404;
            return fail("Patungan tidak ditemukan");
        }
        const bill = bills[index];
        updateMemoryWalletEffects([
            ...readWalletEffects(bill.walletEffects),
            ...bill.participants.flatMap((participant) => readWalletEffects(participant.walletEffects)),
        ], []);
        bills.splice(index, 1);
        return ok({ id: params.id });
    }
    await prisma.$transaction(async (client) => {
        await lockFinanceRecord(client, "splitBills", params.id);
        const bill = await client.splitBill.findFirst({
            where: scopedWhere(currentUserIdFromRequest(request), params.id),
            include: { participants: true },
        });
        if (!bill)
            throw new Error("Patungan tidak ditemukan");
        await reconcileWalletEffects(client, [
            ...readWalletEffects(bill.walletEffects),
            ...bill.participants.flatMap((participant) => readWalletEffects(participant.walletEffects)),
        ], [], bill.userId);
        await client.splitBill.delete({ where: { id: params.id } });
    });
    return ok({ id: params.id });
})
    // User list (for admin)
    .get("/users", async ({ request, query, set }) => {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    if (verifyToken(token ?? "")?.role !== "admin") {
        set.status = 403;
        return fail("Admin required");
    }
    if (isDatabaseConfigured() && !(await canUseDatabase())) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    return ok(await listUsers(query));
})
    // Admin CRUD for users. The GET endpoint is the legacy list
    // route above; the POST/PUT/DELETE here are what the /admin/users
    // page needs to actually persist add/edit/remove. Without these,
    // the page falls back to a local-only state and refresh wipes
    // every change — that's the bug the previous code was papering
    // over with a yellow warning banner.
    .post("/users", async ({ request, body, set }) => {
    // Only admins can create users from the dashboard. (Public
    // registration still goes through /auth/register.)
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    const auth = token ? verifyToken(token) : null;
    if (!auth || auth.role !== "admin") {
        set.status = 401;
        return fail("Unauthorized");
    }
    const { name, email, password, role, status } = body;
    if (!name?.trim() || !email?.trim() || !password) {
        set.status = 400;
        return fail("Nama, email, dan password wajib diisi");
    }
    if (password.length < 6) {
        set.status = 400;
        return fail("Password minimal 6 karakter");
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (await canUseDatabase()) {
        const existing = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existing) {
            set.status = 409;
            return fail("Email sudah terdaftar");
        }
        const hashed = await bcrypt.hash(password, 10);
        const created = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashed,
                role: role ?? "owner",
                status: status ?? "active",
            },
        });
        return ok(publicDbUser(created));
    }
    if (users.some((u) => u.email === normalizedEmail)) {
        set.status = 409;
        return fail("Email sudah terdaftar");
    }
    const created = {
        id: id("usr"),
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        role: (role ?? "owner"),
        status: (status ?? "active"),
        createdAt: new Date().toISOString(),
    };
    users.push(created);
    return ok(publicUser(created));
}, {
    body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String(),
        password: t.String({ minLength: 6 }),
        role: t.Optional(t.Union([
            t.Literal("admin"),
            t.Literal("owner"),
            t.Literal("member"),
        ])),
        status: t.Optional(t.Union([
            t.Literal("active"),
            t.Literal("inactive"),
            t.Literal("pending"),
        ])),
    }),
})
    .put("/users/:id", async ({ request, params, body, set }) => {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    const auth = token ? verifyToken(token) : null;
    if (!auth || auth.role !== "admin") {
        set.status = 401;
        return fail("Unauthorized");
    }
    const { name, email, role, status, password } = body;
    if (await canUseDatabase()) {
        const existing = await prisma.user.findUnique({
            where: { id: params.id },
        });
        if (!existing) {
            set.status = 404;
            return fail("Pengguna tidak ditemukan");
        }
        // Don't let admins demote themselves via this endpoint —
        // it would let an admin lock the others out of the panel.
        if (existing.role === "admin" && role && role !== "admin") {
            set.status = 403;
            return fail("Tidak bisa menurunkan role admin lain");
        }
        if (existing.role === "admin" && status === "inactive") {
            set.status = 403;
            return fail("Tidak bisa menonaktifkan admin lain");
        }
        const data = {};
        if (name !== undefined)
            data.name = name.trim();
        if (email !== undefined)
            data.email = email.toLowerCase().trim();
        if (role !== undefined)
            data.role = role;
        if (status !== undefined)
            data.status = status;
        if (password) {
            if (password.length < 6) {
                set.status = 400;
                return fail("Password minimal 6 karakter");
            }
            data.password = await bcrypt.hash(password, 10);
        }
        const updated = await prisma.user.update({
            where: { id: params.id },
            data,
        });
        return ok(publicDbUser(updated));
    }
    const idx = users.findIndex((u) => u.id === params.id);
    if (idx < 0) {
        set.status = 404;
        return fail("Pengguna tidak ditemukan");
    }
    if (users[idx].role === "admin" && role && role !== "admin") {
        set.status = 403;
        return fail("Tidak bisa menurunkan role admin lain");
    }
    if (users[idx].role === "admin" && status === "inactive") {
        set.status = 403;
        return fail("Tidak bisa menonaktifkan admin lain");
    }
    const updated = {
        ...users[idx],
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    };
    users[idx] = updated;
    return ok(publicUser(updated));
}, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
        name: t.Optional(t.String({ minLength: 2 })),
        email: t.Optional(t.String()),
        role: t.Optional(t.Union([
            t.Literal("admin"),
            t.Literal("owner"),
            t.Literal("member"),
        ])),
        status: t.Optional(t.Union([
            t.Literal("active"),
            t.Literal("inactive"),
            t.Literal("pending"),
        ])),
        password: t.Optional(t.String({ minLength: 6 })),
    }),
})
    .delete("/users/:id", async ({ request, params, set }) => {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    const auth = token ? verifyToken(token) : null;
    if (!auth || auth.role !== "admin") {
        set.status = 401;
        return fail("Unauthorized");
    }
    if (await canUseDatabase()) {
        const existing = await prisma.user.findUnique({
            where: { id: params.id },
        });
        if (!existing) {
            set.status = 404;
            return fail("Pengguna tidak ditemukan");
        }
        if (existing.role === "admin") {
            set.status = 403;
            return fail("Tidak bisa menghapus admin lain");
        }
        // Schema's onDelete: Cascade on the userId FK in every
        // user-data table sweeps their wallets, transactions, etc.
        await prisma.user.delete({ where: { id: params.id } });
        return ok({ id: params.id });
    }
    const idx = users.findIndex((u) => u.id === params.id);
    if (idx < 0) {
        set.status = 404;
        return fail("Pengguna tidak ditemukan");
    }
    if (users[idx].role === "admin") {
        set.status = 403;
        return fail("Tidak bisa menghapus admin lain");
    }
    users.splice(idx, 1);
    return ok({ id: params.id });
}, {
    params: t.Object({ id: t.String() }),
})
    // App settings
    .get("/app-config", async () => {
    if (await canUseDatabase()) {
        const setting = (await prisma.appSetting.findFirst()) ??
            (await prisma.appSetting.create({ data: {} }));
        return ok(serializeAppSetting(setting));
    }
    return ok(appConfig);
})
    // ── User Profile ─────────────────────────────────────────────
    .get("/user/profile", async ({ request, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    if (await canUseDatabase()) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            set.status = 404;
            return fail("User tidak ditemukan");
        }
        return ok(serializeUserProfile(user));
    }
    return ok(users.find((u) => u.id === userId));
})
    .put("/user/profile", async ({ request, body, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    const updates = body;
    if (await canUseDatabase()) {
        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                name: String(updates.name ?? undefined),
                phone: String(updates.phone ?? undefined) || undefined,
                avatar: String(updates.avatar ?? undefined) || undefined,
                currency: String(updates.currency ?? undefined),
                language: String(updates.language ?? undefined),
                timezone: String(updates.timezone ?? undefined),
                monthlyIncome: updates.monthlyIncome
                    ? Number(updates.monthlyIncome)
                    : undefined,
                disposableIncome: updates.disposableIncome
                    ? Number(updates.disposableIncome)
                    : undefined,
            },
        });
        return ok(serializeUserProfile(updated));
    }
    return ok(updates);
})
    // ── Notification Settings ────────────────────────────────────
    .get("/user/notification-settings", async ({ request, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    if (await canUseDatabase()) {
        let setting = await prisma.notificationSetting.findUnique({
            where: { userId },
        });
        if (!setting) {
            setting = await prisma.notificationSetting.create({
                data: { userId },
            });
        }
        return ok(serializeNotificationSetting(setting));
    }
    set.status = 503;
    return fail("Database tidak tersedia; pengaturan notifikasi belum tersimpan");
})
    .put("/user/notification-settings", async ({ request, body, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    const flat = denormalizeNotificationSettings(body);
    if (await canUseDatabase()) {
        const existing = await prisma.notificationSetting.findUnique({
            where: { userId },
        });
        if (existing) {
            const updated = await prisma.notificationSetting.update({
                where: { userId },
                data: flat,
            });
            return ok(serializeNotificationSetting(updated));
        }
        const created = await prisma.notificationSetting.create({
            data: { ...flat, userId },
        });
        return ok(serializeNotificationSetting(created));
    }
    set.status = 503;
    return fail("Database tidak tersedia; pengaturan notifikasi belum tersimpan");
})
    // ── Gamification ─────────────────────────────────────────────
    .get("/user/gamification", async ({ request, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    if (await canUseDatabase()) {
        let state = await prisma.gamificationState.findUnique({
            where: { userId },
        });
        if (!state) {
            state = await prisma.gamificationState.create({
                data: { userId },
            });
        }
        return ok(serializeGamificationState(state));
    }
    return ok({});
})
    .put("/user/gamification", async ({ request, body, set }) => {
    const userId = strictUserIdFromRequest(request);
    if (!userId) {
        set.status = 401;
        return fail("Unauthorized");
    }
    const flat = denormalizeGamificationState(body);
    if (await canUseDatabase()) {
        const existing = await prisma.gamificationState.findUnique({
            where: { userId },
        });
        if (existing) {
            const updated = await prisma.gamificationState.update({
                where: { userId },
                data: flat,
            });
            return ok(serializeGamificationState(updated));
        }
        const created = await prisma.gamificationState.create({
            data: { ...flat, userId },
        });
        return ok(serializeGamificationState(created));
    }
    return ok(flat);
})
    .use(requireAdmin)
    .get("/admin/users", async ({ query, set }) => {
    if (isDatabaseConfigured() && !(await canUseDatabase())) {
        set.status = 503;
        return fail("Database sementara tidak tersedia");
    }
    return ok(await listUsers(query));
})
    // Approve / reject / suspend a user. Used by /admin/users to flip
    // a freshly-registered `pending` account to `active` (or back to
    // `inactive` to revoke access). Admins themselves cannot be
    // demoted/inactivated via this endpoint — that would let one
    // admin lock the others out.
    .patch("/admin/users/:id/status", async ({ params, body, set }) => {
    const { id } = params;
    const { status } = body;
    if (status !== "active" &&
        status !== "inactive" &&
        status !== "pending") {
        set.status = 400;
        return fail("Status tidak valid");
    }
    if (await canUseDatabase()) {
        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            set.status = 404;
            return fail("Pengguna tidak ditemukan");
        }
        if (existing.role === "admin" && status !== "active") {
            set.status = 403;
            return fail("Tidak bisa mengubah status admin lain");
        }
        const updated = await prisma.user.update({
            where: { id },
            data: { status },
        });
        return ok(publicDbUser(updated));
    }
    const idx = users.findIndex((u) => u.id === id);
    if (idx < 0) {
        set.status = 404;
        return fail("Pengguna tidak ditemukan");
    }
    if (users[idx].role === "admin" && status !== "active") {
        set.status = 403;
        return fail("Tidak bisa mengubah status admin lain");
    }
    users[idx] = {
        ...users[idx],
        status: status,
    };
    return ok(publicUser(users[idx]));
}, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ status: t.String() }),
})
    .get("/admin/app-settings", async () => {
    if (await canUseDatabase()) {
        const setting = (await prisma.appSetting.findFirst()) ??
            (await prisma.appSetting.create({ data: {} }));
        return ok(serializeAppSetting(setting));
    }
    return ok(appConfig);
})
    .put("/app-config", async ({ body }) => {
    const updates = body;
    if (await canUseDatabase()) {
        const setting = (await prisma.appSetting.findFirst()) ??
            (await prisma.appSetting.create({ data: {} }));
        const updated = await prisma.appSetting.update({
            where: { id: setting.id },
            data: updates,
        });
        return ok(serializeAppSetting(updated));
    }
    return ok(setAppConfig(updates));
})
    .put("/admin/app-settings", async ({ body }) => {
    const updates = body;
    if (await canUseDatabase()) {
        const setting = (await prisma.appSetting.findFirst()) ??
            (await prisma.appSetting.create({ data: {} }));
        const updated = await prisma.appSetting.update({
            where: { id: setting.id },
            data: updates,
        });
        return ok(serializeAppSetting(updated));
    }
    return ok(setAppConfig(updates));
});
// Resource CRUD (GET/POST/PUT/DELETE) for all resources
const resources = Object.keys(db);
function updateMemoryWalletEffects(previous, next) {
    const findWallet = (id, wallets = db.wallets) => {
        for (const wallet of wallets) {
            if (wallet.id === id)
                return wallet;
            const child = findWallet(id, wallet.children ?? []);
            if (child)
                return child;
        }
    };
    const deltas = new Map();
    for (const effect of readWalletEffects(previous))
        deltas.set(effect.walletId, (deltas.get(effect.walletId) ?? 0) - effect.amount);
    for (const effect of next) {
        if (!effect.walletId || !Number.isFinite(effect.amount))
            throw new Error("Dompet dan nominal pembayaran tidak valid");
        deltas.set(effect.walletId, (deltas.get(effect.walletId) ?? 0) + effect.amount);
    }
    for (const [walletId, delta] of deltas) {
        if (delta === 0)
            continue;
        const wallet = findWallet(walletId);
        if (!wallet || wallet.currency !== "IDR")
            throw new Error("Dompet Rupiah pembayaran tidak tersedia");
    }
    for (const [walletId, delta] of deltas)
        if (delta !== 0)
            findWallet(walletId).balance += delta;
}
export const resourceRoutes = new Elysia({ prefix: "/api" })
    .use(requireAuth)
    .onError(({ error, set }) => {
    if (error instanceof PaginationError) {
        set.status = error.status;
        return fail(error.message);
    }
})
    .onBeforeHandle(async ({ params, set }) => {
    const resource = params.resource;
    if (prismaResources.has(resource) &&
        isDatabaseConfigured() &&
        !(await canUseDatabase())) {
        set.status = 503;
        return fail("Database sementara tidak tersedia. Coba sinkronkan kembali.");
    }
})
    .get("/:resource", async ({ request, params, query, set }) => {
    const resource = params.resource;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    return ok(await listPagedResource(resource, request, query));
})
    .post("/:resource", async ({ request, params, body, set }) => {
    const resource = params.resource;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    if ((await canUseDatabase()) && prismaResources.has(resource)) {
        try {
            const item = await createPrismaResource(resource, body, strictUserIdFromRequest(request), new URL(request.url).searchParams.get("restore") === "1");
            set.status = 201;
            return ok(item);
        }
        catch (error) {
            set.status = 400;
            return fail(error instanceof Error ? error.message : "Gagal menyimpan data");
        }
    }
    if (resource === "wallets") {
        for (const item of flattenWallets([body])) {
            db[resource].unshift({
                ...item,
                id: item.id ?? id(resource),
                userId: strictUserIdFromRequest(request),
            });
        }
        set.status = 201;
        return ok(body);
    }
    if (resource === "transactions" && body.type === "transfer") {
        set.status = 503;
        return fail("Database belum tersedia untuk transfer antar dompet");
    }
    let item = { id: id(resource), ...body, userId: strictUserIdFromRequest(request) };
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        try {
            item = resourceWalletUpdate(resource, null, item);
            if (new URL(request.url).searchParams.get("restore") === "1")
                item.walletEffects = [];
            updateMemoryWalletEffects([], readWalletEffects(item.walletEffects));
        }
        catch (error) {
            set.status = 400;
            return fail(error instanceof Error ? error.message : "Gagal memperbarui dompet");
        }
    }
    db[resource].unshift(item);
    set.status = 201;
    return ok(item);
})
    .put("/:resource/:id", async ({ request, params, body, set }) => {
    const resource = params.resource;
    const resourceId = params.id;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    if ((await canUseDatabase()) && prismaResources.has(resource)) {
        try {
            return ok(await updatePrismaResource(resource, resourceId, body, currentUserIdFromRequest(request)));
        }
        catch (error) {
            set.status = 404;
            return fail(error instanceof Error ? error.message : "Data tidak ditemukan");
        }
    }
    const list = db[resource];
    const index = list.findIndex((item) => item.id === resourceId);
    if (index === -1) {
        set.status = 404;
        return fail("Data tidak ditemukan");
    }
    if (resource === "transactions" &&
        (body.type === "transfer" || list[index]?.type === "transfer")) {
        set.status = 503;
        return fail("Database belum tersedia untuk transfer antar dompet");
    }
    let updates = body;
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        try {
            updates = resourceWalletUpdate(resource, list[index], updates);
            updateMemoryWalletEffects(list[index]?.walletEffects, updates.walletEffects);
        }
        catch (error) {
            set.status = 400;
            return fail(error instanceof Error ? error.message : "Gagal memperbarui dompet");
        }
    }
    list[index] = { ...list[index], ...updates };
    return ok(list[index]);
})
    .delete("/:resource/:id", async ({ request, params, set }) => {
    const resource = params.resource;
    const resourceId = params.id;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    if ((await canUseDatabase()) && prismaResources.has(resource)) {
        try {
            await deletePrismaResource(resource, resourceId, currentUserIdFromRequest(request));
            return ok({ id: resourceId });
        }
        catch (error) {
            set.status = 404;
            return fail(error instanceof Error ? error.message : "Data tidak ditemukan");
        }
    }
    const list = db[resource];
    const index = list.findIndex((item) => item.id === resourceId);
    if (index === -1) {
        set.status = 404;
        return fail("Data tidak ditemukan");
    }
    if (resource === "bills" ||
        resource === "savingGoals" ||
        resource === "debts") {
        try {
            updateMemoryWalletEffects(list[index]?.walletEffects, []);
        }
        catch (error) {
            set.status = 400;
            return fail(error instanceof Error ? error.message : "Gagal memperbarui dompet");
        }
    }
    const [removed] = list.splice(index, 1);
    return ok(removed);
});
