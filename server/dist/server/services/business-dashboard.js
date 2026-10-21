import { Prisma } from "@prisma/client";
import { db } from "../prisma-client.js";
const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
];
function totals(row) {
    const income = Number(row?.income ?? 0);
    const difference = Number(row?.difference ?? 0);
    return {
        income,
        expense: Number(row?.expense ?? 0),
        difference,
        marginPercent: income === 0 ? null : (difference / income) * 100,
        transactionCount: row?.transactionCount ?? 0,
    };
}
export async function getBusinessDashboard(userId, selectedYear, businessId) {
    return db.$transaction(async (tx) => {
        const [user, businesses] = await Promise.all([
            tx.user.findUnique({
                where: { id: userId },
                select: { timezone: true },
            }),
            tx.business.findMany({
                where: { userId },
                select: { id: true, name: true },
                orderBy: [{ name: "asc" }, { id: "asc" }],
            }),
        ]);
        if (businessId !== undefined &&
            !businesses.some((business) => business.id === businessId))
            return null;
        const timezone = user?.timezone ?? "Asia/Jakarta";
        const currentYear = Number(new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
        }).format(new Date()));
        const year = selectedYear ?? currentYear;
        const start = `${String(year).padStart(4, "0")}-01-01`;
        const end = `${String(year + 1).padStart(4, "0")}-01-01`;
        const localDate = Prisma.sql `(entry.date AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})`;
        const range = Prisma.sql `entry.date >= (${start}::timestamp AT TIME ZONE ${timezone} AT TIME ZONE 'UTC')
      AND entry.date < (${end}::timestamp AT TIME ZONE ${timezone} AT TIME ZONE 'UTC')`;
        const selection = businessId === undefined
            ? Prisma.sql `TRUE`
            : Prisma.sql `business.id = ${businessId}`;
        const sums = Prisma.sql `
      COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = 'income'), 0) AS income,
      COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = 'expense'), 0) AS expense,
      COALESCE(SUM(CASE WHEN entry.type = 'income' THEN entry.amount WHEN entry.type = 'expense' THEN -entry.amount ELSE 0 END), 0) AS difference,
      COUNT(entry.id)::int AS "transactionCount"`;
        const [yearRows, monthRows, contributions, recent] = await Promise.all([
            tx.$queryRaw(Prisma.sql `
        SELECT DISTINCT EXTRACT(YEAR FROM ${localDate})::int AS year
        FROM "BusinessTransaction" entry JOIN "Business" business ON business.id = entry."businessId"
        WHERE business."userId" = ${userId}`),
            tx.$queryRaw(Prisma.sql `
        WITH selected AS (
          SELECT entry.id, entry.type, entry.amount, EXTRACT(MONTH FROM ${localDate})::int AS month
          FROM "BusinessTransaction" entry JOIN "Business" business ON business.id = entry."businessId"
          WHERE business."userId" = ${userId} AND ${selection} AND ${range}
        )
        SELECT entry.month, ${sums} FROM selected entry
        GROUP BY GROUPING SETS ((entry.month), ())`),
            tx.$queryRaw(Prisma.sql `
        SELECT business.id, business.name, ${sums}
        FROM "Business" business
        LEFT JOIN "BusinessTransaction" entry ON entry."businessId" = business.id AND ${range}
        WHERE business."userId" = ${userId} AND ${selection}
        GROUP BY business.id, business.name
        ORDER BY income DESC, business.name ASC, business.id ASC`),
            tx.$queryRaw(Prisma.sql `
        SELECT entry.id, entry."businessId", business.name AS "businessName", entry.type,
          entry.amount, entry.description, entry.date, wallet.name AS "walletName"
        FROM "BusinessTransaction" entry JOIN "Business" business ON business.id = entry."businessId"
        LEFT JOIN "Wallet" wallet ON wallet.id = entry."walletId"
        WHERE business."userId" = ${userId} AND ${selection} AND ${range}
        ORDER BY entry.date DESC, entry."createdAt" DESC, entry.id DESC LIMIT 6`),
        ]);
        return {
            year,
            years: [
                ...new Set([currentYear, year, ...yearRows.map((row) => row.year)]),
            ].sort((a, b) => b - a),
            timezone,
            businessId: businessId ?? null,
            businesses,
            totals: totals(monthRows.find((row) => row.month === null)),
            monthly: labels.map((label, index) => ({
                month: index + 1,
                label,
                ...totals(monthRows.find((row) => row.month === index + 1)),
            })),
            contributions: contributions.map((row) => ({
                id: row.id,
                name: row.name,
                ...totals(row),
            })),
            recent: recent.map((entry) => ({
                ...entry,
                amount: Number(entry.amount),
                date: entry.date.toISOString(),
            })),
        };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
