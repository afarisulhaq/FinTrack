import { Prisma } from "@prisma/client";
import { db as prisma, canUseDatabase, isDatabaseConfigured } from "../prisma-client.js";
import { db as memory, users } from "../data.js";
import { ownership, type ListScope } from "./pagination.js";
import { calculateActivity, calculateActivityAggregate } from "../../src/lib/gamification.js";
import type { AnalyticsSummary, ActivitySummary } from "../../src/lib/analytics.js";

export class AnalyticsError extends Error { constructor(message: string, public status = 503) { super(message); } }
const colors = ["#FFD147", "#22c55e", "#f59e0b", "#ef4444", "#38bdf8", "#ec4899", "#FFB347", "#94a3b8"];
const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function localDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
async function context(scope: ListScope) {
  const available = await canUseDatabase();
  if (!available && isDatabaseConfigured()) throw new AnalyticsError("Database tidak tersedia");
  const user = available ? await prisma.user.findUnique({ where: { id: scope.authId }, select: { timezone: true } }) : users.find((row) => row.id === scope.authId);
  const timezone = user && "timezone" in user && typeof user.timezone === "string" ? user.timezone : "Asia/Jakarta";
  try { localDate(new Date(), timezone); } catch { throw new AnalyticsError("Zona waktu tidak valid", 400); }
  return { available, timezone, today: localDate(new Date(), timezone) };
}
function memoryOwned<T>(rows: T[], scope: ListScope) {
  return rows.filter((row) => {
    const userId = typeof row === "object" && row !== null && "userId" in row ? row.userId : undefined;
    return scope.userId === null || userId === scope.userId || (userId === undefined && scope.authId === "usr-demo-001");
  });
}
function sqlOwner(scope: ListScope) { return scope.userId ? Prisma.sql`"userId" = ${scope.userId}` : Prisma.sql`TRUE`; }
function rangeStart(today: string, period: string) {
  const [year, month] = today.split("-").map(Number);
  const length = period === "year" ? month : period === "3" ? 3 : period === "6" ? 6 : 1;
  const start = new Date(Date.UTC(year, month - length, 1)).toISOString().slice(0, 10);
  return { start, length };
}
type SeriesRow = { key: string; income: number; expense: number; count: number };
type CategoryRow = { name: string; value: number; icon: string };
interface MemoryWallet { id: string; name: string; balance: number; parentId?: string; children?: MemoryWallet[]; }
function memoryWalletTotals(scope: ListScope) {
  const records = new Map<string, MemoryWallet>();
  function visit(row: MemoryWallet, parentId?: string) {
    records.set(row.id, { ...row, parentId: row.parentId ?? parentId });
    for (const child of row.children ?? []) visit(child, row.id);
  }
  for (const row of memoryOwned(memory.wallets, scope)) visit(row);
  let walletBalance = 0, rootWalletCount = 0;
  for (const row of records.values()) {
    walletBalance += row.balance;
    if (!row.parentId) rootWalletCount++;
  }
  return { walletBalance, rootWalletCount, wallets: records };
}

export async function getWalletBalanceLookup(scope: ListScope) {
  const { available } = await context(scope);
  if (!available) return [...memoryWalletTotals(scope).wallets.values()]
    .map(({ id, name, balance, parentId }) => ({ id, name, balance, parentId: parentId ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const rows = await prisma.wallet.findMany({
    where: ownership(scope),
    select: { id: true, name: true, balance: true, parentId: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({ ...row, balance: Number(row.balance) }));
}
export async function getAnalytics(scope: ListScope, period = "6"): Promise<AnalyticsSummary> {
  if (!["1", "3", "6", "year"].includes(period)) throw new AnalyticsError("Periode tidak valid", 400);
  const { available, timezone, today } = await context(scope);
  const { start, length } = rangeStart(today, period);
  let monthly: SeriesRow[], daily: { date: string; amount: number }[], categories: CategoryRow[];
  let walletBalance: number, rootWalletCount: number, portfolioValue: number;
  let bills: AnalyticsSummary["bills"], goals: AnalyticsSummary["goals"];
  if (available) {
    const owner = sqlOwner(scope), where = ownership(scope);
    const date = Prisma.sql`("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date`;
    const range = Prisma.sql`${owner} AND ${date} >= ${start}::date AND ${date} <= ${today}::date`;
    const [wallet, portfolio, monthRows, dayRows, categoryRows, billRows, goalRows] = await Promise.all([
      prisma.wallet.aggregate({ where, _sum: { balance: true } }),
      prisma.$queryRaw<{ value: number }[]>(Prisma.sql`SELECT COALESCE(SUM(quantity * "currentPrice"),0)::float8 AS value FROM "Investment" WHERE ${owner}`),
      prisma.$queryRaw<SeriesRow[]>(Prisma.sql`SELECT to_char(${date},'YYYY-MM') AS key, COALESCE(SUM(amount) FILTER (WHERE type='income'),0)::float8 AS income, COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)::float8 AS expense, COUNT(*)::int AS count FROM "Transaction" WHERE ${range} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<{ date: string; amount: number }[]>(Prisma.sql`SELECT to_char(${date},'YYYY-MM-DD') AS date, SUM(amount)::float8 AS amount FROM "Transaction" WHERE ${owner} AND type='expense' AND ${date} >= ${today.slice(0, 7) + "-01"}::date AND ${date} <= ${today}::date GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<CategoryRow[]>(Prisma.sql`SELECT category AS name, SUM(amount)::float8 AS value, MIN("categoryIcon") AS icon FROM "Transaction" WHERE ${range} AND type='expense' GROUP BY category ORDER BY value DESC, category ASC`),
      prisma.bill.findMany({ where: { ...where, status: { not: "paid" } }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 4, select: { id: true, name: true, amount: true, dueDate: true, status: true, icon: true } }),
      prisma.savingGoal.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 3, select: { id: true, name: true, icon: true, color: true, targetAmount: true, currentAmount: true } }),
    ]);
    walletBalance = Number(wallet._sum.balance ?? 0);
    rootWalletCount = await prisma.wallet.count({ where: { ...where, parentId: null } });
    portfolioValue = portfolio[0]?.value ?? 0;
    monthly = monthRows; daily = dayRows; categories = categoryRows;
    bills = billRows.map((row) => ({ ...row, amount: Number(row.amount), dueDate: row.dueDate.toISOString() }));
    goals = goalRows.map((row) => ({ ...row, targetAmount: Number(row.targetAmount), currentAmount: Number(row.currentAmount) }));
  } else {
    ({ walletBalance, rootWalletCount } = memoryWalletTotals(scope));
    const investments: { quantity: number; currentPrice: number }[] = memoryOwned(memory.investments, scope);
    portfolioValue = investments.reduce((sum, row) => sum + row.quantity * row.currentPrice, 0);
    const byMonth = new Map<string, SeriesRow>(), byDay = new Map<string, number>(), byCategory = new Map<string, CategoryRow>();
    for (const row of memoryOwned(memory.transactions, scope)) {
      const key = localDate(new Date(row.date), timezone);
      if (key < start || key > today) continue;
      const month = key.slice(0, 7), point = byMonth.get(month) ?? { key: month, income: 0, expense: 0, count: 0 };
      point.count++;
      if (row.type === "income") point.income += row.amount;
      if (row.type === "expense") {
        point.expense += row.amount;
        const category = byCategory.get(row.category) ?? { name: row.category, icon: row.categoryIcon, value: 0 };
        category.value += row.amount; byCategory.set(row.category, category);
        if (key.slice(0, 7) === today.slice(0, 7)) byDay.set(key, (byDay.get(key) ?? 0) + row.amount);
      }
      byMonth.set(month, point);
    }
    monthly = [...byMonth.values()]; daily = [...byDay].map(([date, amount]) => ({ date, amount }));
    categories = [...byCategory.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    bills = memoryOwned(memory.bills, scope).filter((row) => row.status !== "paid").sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id)).slice(0, 4);
    goals = memoryOwned(memory.savingGoals, scope).slice(0, 3);
  }
  const [year, month] = start.split("-").map(Number);
  const monthlyData = Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    const point = monthly.find((row) => row.key === date.toISOString().slice(0, 7));
    return { month: months[date.getUTCMonth()]!, income: point?.income ?? 0, expense: point?.expense ?? 0 };
  });
  const heatmap = Array.from({ length: Number(today.slice(8)) }, (_, index) => {
    const date = `${today.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`;
    return { date, amount: daily.find((row) => row.date === date)?.amount ?? 0 };
  });
  return { timezone, walletBalance, rootWalletCount, portfolioValue, monthlyData, totalIncome: monthlyData.reduce((sum, row) => sum + row.income, 0), totalExpense: monthlyData.reduce((sum, row) => sum + row.expense, 0), transactionCount: monthly.reduce((sum, row) => sum + row.count, 0), heatmap, categories: categories.map((row, index) => ({ ...row, color: colors[index % colors.length]! })), bills, goals };
}

export async function getActivity(scope: ListScope): Promise<ActivitySummary> {
  const { available, timezone, today } = await context(scope);
  if (!available) return { timezone, ...calculateActivity({ transactions: memoryOwned(memory.transactions, scope), bills: memoryOwned(memory.bills, scope), savingGoals: memoryOwned(memory.savingGoals, scope), debts: memoryOwned(memory.debts, scope) }, new Date(), timezone) };
  const owner = sqlOwner(scope), where = ownership(scope);
  const [stats, last7Days, achieved, paidBills, settledDebts] = await Promise.all([
    prisma.$queryRaw<{ recordCount: number; activeDays: number; longestStreak: number; currentStreak: number }[]>(Prisma.sql`
      WITH days AS (SELECT ("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date AS day, COUNT(*)::int AS count FROM "Transaction" WHERE ${owner} AND amount > 0 AND type IN ('income','expense','transfer') AND ("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date <= ${today}::date GROUP BY 1),
      runs AS (SELECT day, count, day - ROW_NUMBER() OVER (ORDER BY day)::int AS island FROM days),
      streaks AS (SELECT COUNT(*)::int AS length, MAX(day) AS ending FROM runs GROUP BY island)
      SELECT COALESCE((SELECT SUM(count) FROM days),0)::int AS "recordCount", (SELECT COUNT(*) FROM days)::int AS "activeDays", COALESCE((SELECT MAX(length) FROM streaks),0)::int AS "longestStreak", COALESCE((SELECT length FROM streaks WHERE ending >= ${today}::date - 1 ORDER BY ending DESC LIMIT 1),0)::int AS "currentStreak"`),
    prisma.$queryRaw<{ date: string; count: number }[]>(Prisma.sql`SELECT to_char(("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date,'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "Transaction" WHERE ${owner} AND amount > 0 AND type IN ('income','expense','transfer') AND ("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date BETWEEN ${today}::date - 6 AND ${today}::date GROUP BY 1 ORDER BY 1`),
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "SavingGoal" WHERE ${owner} AND "targetAmount" > 0 AND "currentAmount" >= "targetAmount"`),
    prisma.bill.count({ where: { ...where, status: "paid" } }),
    prisma.debt.count({ where: { ...where, isSettled: true } }),
  ]);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  return { timezone, ...calculateActivityAggregate({ ...(stats[0] ?? { recordCount: 0, activeDays: 0, longestStreak: 0, currentStreak: 0 }), achievedGoals: achieved[0]?.count ?? 0, paidBills, settledDebts, last7Days: Array.from({ length: 7 }, (_, index) => { const date = new Date(todayMs - (6 - index) * 86400000).toISOString().slice(0, 10); return { date, count: last7Days.find((row) => row.date === date)?.count ?? 0 }; }) }) };
}

export async function getWeeklyReport(userId: string) {
  const scope = { userId, authId: userId };
  const { available, timezone, today } = await context(scope);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - weekday * 86400000).toISOString().slice(0, 10);
  if (available) {
    const where = Prisma.sql`"userId" = ${userId} AND type='expense' AND ("date" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date BETWEEN ${start}::date AND ${today}::date`;
    const [totals, top] = await Promise.all([
      prisma.$queryRaw<{ total: number; count: number }[]>(Prisma.sql`SELECT COALESCE(SUM(amount),0)::float8 AS total, COUNT(*)::int AS count FROM "Transaction" WHERE ${where}`),
      prisma.$queryRaw<{ category: string; amount: number }[]>(Prisma.sql`SELECT category, SUM(amount)::float8 AS amount FROM "Transaction" WHERE ${where} GROUP BY category ORDER BY amount DESC, category ASC LIMIT 1`),
    ]);
    return { ...totals[0]!, top: top[0], start, end: today };
  }
  const rows = memoryOwned(memory.transactions, scope).filter((row) => row.type === "expense" && localDate(new Date(row.date), timezone) >= start && localDate(new Date(row.date), timezone) <= today);
  const groups = new Map<string, number>();
  for (const row of rows) groups.set(row.category, (groups.get(row.category) ?? 0) + row.amount);
  const top = [...groups].sort((a, b) => b[1] - a[1])[0];
  return { total: rows.reduce((sum, row) => sum + row.amount, 0), count: rows.length, top: top ? { category: top[0], amount: top[1] } : undefined, start, end: today };
}
