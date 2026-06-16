import { Elysia, t } from "elysia";
import bcrypt from "bcryptjs";
import { appConfig, db, setAppConfig, users } from "../data.js";
import { extractToken, verifyToken } from "../auth.js";
import { requireAdmin, requireAuth } from "../auth-middleware.js";
import { canUseDatabase, db as prisma } from "../prisma-client.js";
import { getYahooFinancePrice, getYahooFinanceQuote, searchYahooFinance, } from "../services/market-price.js";
import { fail, id, ok, publicUser } from "../utils.js";
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
    "cards",
    "wishlist",
    "reimbursements",
    "teamMembers",
    "categories",
    "subCategories",
]);
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
    const parents = flat.filter((w) => !w.parentId);
    const children = flat.filter((w) => w.parentId);
    return parents.map((p) => ({
        ...p,
        children: children.filter((c) => c.parentId === p.id),
    }));
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
    return [{ ...parentWithoutChildren, parentId: undefined }, ...children];
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
        avgBuyPrice: Number(body.avgBuyPrice ?? 0),
        currentPrice: Number(body.currentPrice ?? 0),
        currency: String(body.currency ?? "IDR"),
        color: String(body.color ?? "#6366f1"),
        sellPrice: body.sellPrice !== undefined && body.sellPrice !== null
            ? Number(body.sellPrice)
            : null,
        soldAt: body.soldAt !== undefined && body.soldAt !== null
            ? new Date(String(body.soldAt))
            : null,
        buyFee: body.buyFee !== undefined && body.buyFee !== null
            ? Number(body.buyFee)
            : null,
        sellFee: body.sellFee !== undefined && body.sellFee !== null
            ? Number(body.sellFee)
            : null,
    };
}
function serializeBill(b) {
    return {
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
function serializeSplitBillParticipant(p) {
    return {
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
        return -amount; // source-side; dest tracked separately
    return 0;
}
async function applyTransactionBalanceDelta(tx) {
    const delta = walletDelta(tx);
    if (delta === 0 || !tx.walletId)
        return;
    try {
        await prisma.wallet.update({
            where: { id: tx.walletId },
            data: { balance: { increment: delta } },
        });
    }
    catch (e) {
        console.warn("[tx] wallet balance update failed", tx.walletId, e);
    }
}
async function revertTransactionBalanceDelta(tx) {
    const delta = -walletDelta(tx);
    if (delta === 0 || !tx.walletId)
        return;
    try {
        await prisma.wallet.update({
            where: { id: tx.walletId },
            data: { balance: { increment: delta } },
        });
    }
    catch (e) {
        console.warn("[tx] wallet balance revert failed", tx.walletId, e);
    }
}
/**
 * The Budget model has a `spent` aggregate that is the sum of all
 * matching expense transactions. When a user creates a budget for
 * category X and then logs a transaction with category X, the budget's
 * spent should reflect that. This matches the user's mental model:
 * "I budgeted Rp X for category Y, how much have I spent so far?"
 *
 * NOTE: the period reset is not implemented here — `spent` is cumulative
 * since the budget was created. The user can manually adjust if needed.
 */
async function applyTransactionBudgetDelta(tx, sign) {
    if (tx.type !== "expense" || !tx.category)
        return;
    try {
        const budgets = await prisma.budget.findMany({
            where: { category: tx.category },
        });
        for (const b of budgets) {
            const amount = toNumber(tx.amount) * sign;
            await prisma.budget.update({
                where: { id: b.id },
                data: { spent: { increment: amount } },
            });
        }
    }
    catch (e) {
        console.warn("[tx] budget spent update failed", tx.category, e);
    }
}
function serializeSplitBill(b) {
    return {
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
        createdAt: toIso(t.createdAt),
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
async function listPrismaResource(resource, userId) {
    // Non-admin: filter by their own userId.
    // Admin (userId is null): skip the userId filter so they can see
    // everything, but still exclude rows that were never assigned to a
    // user (defense-in-depth against orphan rows leaking into a real
    // user's bootstrap if the `userId IS NULL` filter is ever bypassed
    // upstream).
    const filter = userId ? { userId } : { userId: { not: null } };
    switch (resource) {
        case "wallets": {
            const rows = await prisma.wallet.findMany({ where: filter });
            return nestWallets(rows.map(serializeWallet));
        }
        case "transactions": {
            const rows = await prisma.transaction.findMany({
                where: filter,
                orderBy: { date: "desc" },
            });
            return rows.map(serializeTransaction);
        }
        case "budgets": {
            const rows = await prisma.budget.findMany({ where: filter });
            return rows.map(serializeBudget);
        }
        case "investments": {
            const rows = await prisma.investment.findMany({
                where: filter,
                orderBy: [{ broker: "asc" }, { symbol: "asc" }],
            });
            return rows.map(serializeInvestment);
        }
        case "bills": {
            const rows = await prisma.bill.findMany({
                where: filter,
                orderBy: { dueDate: "asc" },
            });
            return rows.map(serializeBill);
        }
        case "savingGoals": {
            const rows = await prisma.savingGoal.findMany({ where: filter });
            return rows.map(serializeSavingGoal);
        }
        case "notes": {
            const rows = await prisma.note.findMany({
                where: filter,
                orderBy: { updatedAt: "desc" },
            });
            return rows.map(serializeNote);
        }
        case "recurringTransactions": {
            const rows = await prisma.recurringTransaction.findMany({
                where: filter,
            });
            return rows.map(serializeRecurring);
        }
        case "debts": {
            const rows = await prisma.debt.findMany({
                where: filter,
                orderBy: { createdAt: "desc" },
            });
            return rows.map(serializeDebt);
        }
        case "cards": {
            const rows = await prisma.card.findMany({ where: filter });
            return rows.map(serializeCard);
        }
        case "wishlist": {
            const rows = await prisma.wishlistItem.findMany({
                where: filter,
                orderBy: { createdAt: "desc" },
            });
            return rows.map(serializeWishlistItem);
        }
        case "reimbursements": {
            const rows = await prisma.reimbursement.findMany({
                where: filter,
                orderBy: { submittedDate: "desc" },
            });
            return rows.map(serializeReimbursement);
        }
        case "teamMembers": {
            const rows = await prisma.teamMember.findMany({ where: filter });
            return rows.map(serializeTeamMember);
        }
        case "categories": {
            const rows = await prisma.category.findMany({
                where: filter,
                orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
                include: {
                    subCategories: {
                        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                    },
                },
            });
            return rows.map(serializeCategory);
        }
        case "subCategories": {
            const rows = await prisma.subCategory.findMany({
                where: filter,
                orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
            });
            return rows.map(serializeSubCategory);
        }
        default:
            return [];
    }
}
async function createPrismaResource(resource, body, userId) {
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
    switch (resource) {
        case "wallets": {
            const created = await prisma.wallet.create({ data: data });
            return serializeWallet(created);
        }
        case "transactions": {
            const created = await prisma.transaction.create({
                data: { ...resolved, date: new Date(body.date) },
            });
            // Maintain wallet.balance and budget.spent aggregates so the user
            // sees the right totals without having to refresh.
            await applyTransactionBalanceDelta({
                type: String(created.type),
                amount: created.amount,
                walletId: String(created.walletId),
                category: String(created.category ?? ""),
            });
            await applyTransactionBudgetDelta({
                type: String(created.type),
                amount: created.amount,
                walletId: String(created.walletId),
                category: String(created.category ?? ""),
            }, 1);
            return serializeTransaction(created);
        }
        case "budgets": {
            const created = await prisma.budget.create({ data: resolved });
            return serializeBudget(created);
        }
        case "investments": {
            const investment = normalizeInvestmentBody(body);
            const existing = await prisma.investment.findFirst({
                where: {
                    userId,
                    broker: investment.broker,
                    symbol: investment.symbol,
                    assetClass: investment.assetClass,
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
        case "bills": {
            const created = await prisma.bill.create({
                data: {
                    ...resolved,
                    dueDate: new Date(body.dueDate),
                },
            });
            return serializeBill(created);
        }
        case "savingGoals": {
            const created = await prisma.savingGoal.create({
                data: {
                    ...data,
                    deadline: new Date(body.deadline),
                },
            });
            return serializeSavingGoal(created);
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
        case "debts": {
            const created = await prisma.debt.create({ data: data });
            return serializeDebt(created);
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
            const created = await prisma.teamMember.create({ data: data });
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
            // For updates we need to reverse the old transaction's effect on
            // wallet + budget, then apply the new effect — otherwise the
            // aggregates drift every time the user edits a transaction.
            const existing = await prisma.transaction.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.transaction.update({
                where: { id: resourceId },
                data: resolved,
            });
            await revertTransactionBalanceDelta({
                type: String(existing.type),
                amount: existing.amount,
                walletId: String(existing.walletId),
            });
            await applyTransactionBudgetDelta({
                type: String(existing.type),
                amount: existing.amount,
                walletId: String(existing.walletId),
                category: String(existing.category ?? ""),
            }, -1);
            await applyTransactionBalanceDelta({
                type: String(updated.type),
                amount: updated.amount,
                walletId: String(updated.walletId),
            });
            await applyTransactionBudgetDelta({
                type: String(updated.type),
                amount: updated.amount,
                walletId: String(updated.walletId),
                category: String(updated.category ?? ""),
            }, 1);
            return serializeTransaction(updated);
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
            const updated = await prisma.investment.update({
                where: { id: resourceId },
                data: {
                    ...normalized,
                    name: body.name === undefined ? undefined : normalized.name,
                    symbol: body.symbol === undefined ? undefined : normalized.symbol,
                    assetClass: body.assetClass === undefined ? undefined : normalized.assetClass,
                    broker: body.broker === undefined ? undefined : normalized.broker,
                    quantity: body.quantity === undefined ? undefined : normalized.quantity,
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
        case "bills": {
            const existing = await prisma.bill.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.bill.update({
                where: { id: resourceId },
                data: resolved,
            });
            return serializeBill(updated);
        }
        case "savingGoals": {
            const existing = await prisma.savingGoal.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.savingGoal.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeSavingGoal(updated);
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
        case "debts": {
            const existing = await prisma.debt.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            const updated = await prisma.debt.update({
                where: { id: resourceId },
                data: data,
            });
            return serializeDebt(updated);
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
    switch (resource) {
        case "wallets": {
            const result = await prisma.wallet.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "transactions": {
            // Reverse the transaction's effect on wallet + budget before
            // deleting, otherwise the aggregates stay "frozen" at the
            // pre-delete values.
            const existing = await prisma.transaction.findFirst({ where });
            if (!existing)
                throw new Error("Data tidak ditemukan");
            await revertTransactionBalanceDelta({
                type: String(existing.type),
                amount: existing.amount,
                walletId: String(existing.walletId),
            });
            await applyTransactionBudgetDelta({
                type: String(existing.type),
                amount: existing.amount,
                walletId: String(existing.walletId),
                category: String(existing.category ?? ""),
            }, -1);
            await prisma.transaction.delete({
                where: { id: resourceId },
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
        case "bills": {
            const result = await prisma.bill.deleteMany({ where });
            if (result.count === 0)
                throw new Error("Data tidak ditemukan");
            return;
        }
        case "savingGoals": {
            const result = await prisma.savingGoal.deleteMany({ where });
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
        case "debts": {
            const result = await prisma.debt.deleteMany({ where });
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
async function getBootstrapFromDb(userId) {
    const filter = userId ? { userId } : undefined;
    const [wallets, transactions, budgets, investments, bills, savingGoals, notes, recurring, debts, cards, wishlist, reimbursements, teamMembers, splitBills, categories, subCategories,] = await Promise.all([
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
        cards: cards.map(serializeCard),
        wishlist: wishlist.map(serializeWishlistItem),
        reimbursements: reimbursements.map(serializeReimbursement),
        teamMembers: teamMembers.map(serializeTeamMember),
        splitBills: splitBills.map(serializeSplitBill),
        categories: categories.map(serializeCategory),
        subCategories: subCategories.map(serializeSubCategory),
        appConfig: serializeAppSetting(setting),
    };
}
export const financeRoutes = new Elysia({ prefix: "/api" })
    .use(requireAuth)
    .get("/bootstrap", async ({ request }) => {
    if (await canUseDatabase()) {
        return ok(await getBootstrapFromDb(currentUserIdFromRequest(request)));
    }
    return ok({ ...db, appConfig });
})
    .get("/market-search", async ({ query, set }) => {
    try {
        const results = await searchYahooFinance(String(query.q ?? ""), String(query.assetClass ?? "stock"));
        return ok(results);
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
    .get("/split-bills", async ({ request, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database belum tersedia");
    }
    const userId = currentUserIdFromRequest(request);
    const rows = await prisma.splitBill.findMany({
        where: userId ? { userId } : {},
        include: { participants: true },
        orderBy: { date: "desc" },
    });
    await ensurePayTokens(rows);
    return ok(rows.map(serializeSplitBill));
})
    .post("/split-bills", async ({ request, body, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database belum tersedia");
    }
    const userId = currentUserIdFromRequest(request);
    const data = body;
    const participants = Array.isArray(data.participants)
        ? data.participants
        : [];
    const created = await prisma.splitBill.create({
        data: {
            title: String(data.title ?? "Split Bill"),
            description: String(data.description ?? ""),
            totalAmount: Number(data.totalAmount ?? 0),
            currency: String(data.currency ?? "IDR"),
            paidBy: String(data.paidBy ?? ""),
            date: data.date ? new Date(String(data.date)) : new Date(),
            splitMethod: String(data.splitMethod ?? "equal"),
            status: String(data.status ?? "active"),
            userId,
            participants: {
                create: participants.map((p) => ({
                    name: String(p.name ?? ""),
                    contact: p.contact ? String(p.contact) : null,
                    amount: Number(p.amount ?? 0),
                    paid: Boolean(p.paid ?? false),
                    // Mint a unique public pay-link token per participant up front
                    // so the merchant can start sharing immediately.
                    payToken: generatePayToken(),
                })),
            },
        },
        include: { participants: true },
    });
    return ok(serializeSplitBill(created));
})
    .put("/split-bills/:id", async ({ params, body, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database belum tersedia");
    }
    const data = body;
    const updated = await prisma.splitBill.update({
        where: { id: params.id },
        data: {
            title: data.title === undefined ? undefined : String(data.title),
            description: data.description === undefined ? undefined : String(data.description),
            totalAmount: data.totalAmount === undefined ? undefined : Number(data.totalAmount),
            paidBy: data.paidBy === undefined ? undefined : String(data.paidBy),
            date: data.date === undefined ? undefined : new Date(String(data.date)),
            splitMethod: data.splitMethod === undefined ? undefined : String(data.splitMethod),
            status: data.status === undefined ? undefined : String(data.status),
        },
        include: { participants: true },
    });
    return ok(serializeSplitBill(updated));
})
    .put("/split-bills/:id/participants/:participantId", async ({ params, body, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database belum tersedia");
    }
    const data = body;
    const updated = await db.splitBillParticipant.update({
        where: { id: params.participantId },
        data: {
            paid: data.paid === undefined ? undefined : Boolean(data.paid),
            paidAt: data.paid === false
                ? null
                : data.paid === true
                    ? new Date()
                    : undefined,
        },
    });
    // Auto-settle / un-settle the parent bill so the server state
    // matches what the client store does locally. Without this, the
    // summary card "Sudah Diterima" would jump to 0 the moment the
    // last participant is marked paid, then snap back on refresh
    // (because the server still has the bill as "active").
    try {
        const bill = await db.splitBill.findUnique({
            where: { id: params.id },
            include: { participants: true },
        });
        if (bill &&
            Array.isArray(bill.participants) &&
            bill.participants.length > 0) {
            const allPaid = bill.participants.every((p) => p.paid);
            const anyUnpaid = bill.participants.some((p) => !p.paid);
            let nextStatus;
            if (allPaid && bill.status !== "settled") {
                nextStatus = "settled";
            }
            else if (anyUnpaid &&
                bill.status === "settled" &&
                data.paid === false) {
                // Someone was just unmarked — re-open the bill.
                nextStatus = "active";
            }
            if (nextStatus) {
                await db.splitBill.update({
                    where: { id: bill.id },
                    data: { status: nextStatus },
                });
            }
        }
    }
    catch (e) {
        console.warn("[split-bills] auto-settle failed", e);
    }
    return ok(serializeSplitBillParticipant(updated));
})
    .delete("/split-bills/:id", async ({ params, set }) => {
    if (!(await canUseDatabase())) {
        set.status = 503;
        return fail("Database belum tersedia");
    }
    await prisma.splitBill.delete({ where: { id: params.id } });
    return ok({ id: params.id });
})
    // User list (for admin)
    .get("/users", async () => {
    if (await canUseDatabase()) {
        const rows = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
        });
        return ok(rows.map(publicDbUser));
    }
    return ok(users.map(publicUser));
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
        ...(password
            ? { password: await bcrypt.hash(password, 10) }
            : {}),
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
    return ok({});
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
    return ok(flat);
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
    .get("/admin/users", async () => {
    if (await canUseDatabase()) {
        const rows = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
        });
        return ok(rows.map(publicDbUser));
    }
    return ok(users.map(publicUser));
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
    users[idx] = { ...users[idx], status: status };
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
export const resourceRoutes = new Elysia({ prefix: "/api" })
    .use(requireAuth)
    .get("/:resource", async ({ request, params, set }) => {
    const resource = params.resource;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    if ((await canUseDatabase()) && prismaResources.has(resource)) {
        return ok(await listPrismaResource(resource, currentUserIdFromRequest(request)));
    }
    return ok(db[resource]);
})
    .post("/:resource", async ({ request, params, body, set }) => {
    const resource = params.resource;
    if (!resources.includes(resource)) {
        set.status = 404;
        return fail("Resource tidak ditemukan");
    }
    if ((await canUseDatabase()) && prismaResources.has(resource)) {
        const item = await createPrismaResource(resource, body, currentUserIdFromRequest(request));
        set.status = 201;
        return ok(item);
    }
    if (resource === "wallets") {
        for (const item of flattenWallets([body])) {
            db[resource].unshift({
                ...item,
                id: item.id ?? id(resource),
            });
        }
        set.status = 201;
        return ok(body);
    }
    const item = { id: id(resource), ...body };
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
    list[index] = { ...list[index], ...body };
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
    const [removed] = list.splice(index, 1);
    return ok(removed);
});
