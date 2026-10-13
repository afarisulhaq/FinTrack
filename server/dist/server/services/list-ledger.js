import { Prisma } from "@prisma/client";
import { db as prisma, canUseDatabase, isDatabaseConfigured } from "../prisma-client.js";
import { db as memory } from "../data.js";
import { databasePage, pageArray, pageMeta, ownership, memoryRows, PaginationError } from "./pagination.js";
const supported = { transactions: true, bills: true, budgets: true, recurringTransactions: true, reimbursements: true, notes: true };
const factors = { daily: 30, weekly: 4.33, monthly: 1, yearly: 1 / 12 };
export async function listLedger(resource, scope, query, input, serialize) {
    if (!supported[resource])
        return null;
    const connected = await canUseDatabase();
    if (!connected && isDatabaseConfigured())
        throw new Error("Database sementara tidak tersedia");
    const own = ownership(scope);
    const tenant = scope.userId ? Prisma.sql `"userId" = ${scope.userId}` : Prisma.sql `TRUE`;
    const search = (query.search ?? "").trim();
    const lower = search.toLowerCase();
    const now = new Date();
    if (resource === "transactions") {
        let start;
        let end;
        if (query.month) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month))
                throw new PaginationError("Bulan transaksi tidak valid");
            const [year, month] = query.month.split("-").map(Number);
            start = new Date(Date.UTC(year, month - 1, 1));
            end = new Date(Date.UTC(year, month, 1));
        }
        const type = query.type;
        if (type && !["income", "expense", "transfer"].includes(type))
            throw new PaginationError("Tipe transaksi tidak valid");
        const monthWhere = { ...own, ...(start && end ? { date: { gte: start, lt: end } } : {}) };
        const where = { ...monthWhere, ...(type ? { type } : {}), ...(query.category ? { category: query.category } : {}), ...(query.walletId ? { walletId: query.walletId } : {}), ...(search ? { OR: [{ description: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }, { walletName: { contains: search, mode: "insensitive" } }] } : {}) };
        if (connected) {
            const [page, amounts, categories, budgetCategories] = await Promise.all([
                databasePage(input, () => prisma.transaction.count({ where }), (skip, take) => prisma.transaction.findMany({ where, skip, take, orderBy: [{ date: "desc" }, { id: "asc" }] })),
                prisma.transaction.groupBy({ by: ["type"], where: monthWhere, _sum: { amount: true } }),
                prisma.transaction.findMany({ where: own, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
                prisma.budget.findMany({ where: own, select: { category: true }, distinct: ["category"] }),
            ]);
            const income = Number(amounts.find((row) => row.type === "income")?._sum.amount ?? 0);
            const expense = Number(amounts.find((row) => row.type === "expense")?._sum.amount ?? 0);
            const dates = [...new Set(page.items.map((row) => row.date.toISOString().slice(0, 10)))];
            const clauses = Prisma.sql `${tenant}${start && end ? Prisma.sql ` AND "date" >= ${start} AND "date" < ${end}` : Prisma.empty}${type ? Prisma.sql ` AND "type" = ${type}` : Prisma.empty}${query.category ? Prisma.sql ` AND "category" = ${query.category}` : Prisma.empty}${query.walletId ? Prisma.sql ` AND "walletId" = ${query.walletId}` : Prisma.empty}${search ? Prisma.sql ` AND (strpos(lower("description"),lower(${search})) > 0 OR strpos(lower("category"),lower(${search})) > 0 OR strpos(lower("walletName"),lower(${search})) > 0)` : Prisma.empty}`;
            const dayRows = dates.length ? await prisma.$queryRaw(Prisma.sql `SELECT to_char("date", 'YYYY-MM-DD') AS day, COALESCE(SUM(CASE WHEN "type" = 'income' THEN "amount" WHEN "type" = 'expense' THEN -"amount" ELSE 0 END),0) AS net FROM "Transaction" WHERE ${clauses} AND to_char("date", 'YYYY-MM-DD') IN (${Prisma.join(dates)}) GROUP BY day`) : [];
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { monthStats: { income, expense, net: income - expense }, categories: categories.map((row) => row.category), budgetCategories: budgetCategories.map((row) => row.category), dayNet: Object.fromEntries(dayRows.map((row) => [row.day, Number(row.net)])) } };
        }
        const all = memoryRows(memory.transactions, scope);
        const monthRows = all.filter((row) => !start || !end || (new Date(row.date) >= start && new Date(row.date) < end));
        const rows = monthRows.filter((row) => (!type || row.type === type) && (!query.category || row.category === query.category) && (!query.walletId || row.walletId === query.walletId) && (!search || `${row.description} ${row.category} ${row.walletName}`.toLowerCase().includes(lower))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
        const income = monthRows.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
        const expense = monthRows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
        const dayNet = {};
        for (const row of rows) {
            const day = row.date.slice(0, 10);
            dayNet[day] = (dayNet[day] ?? 0) + (row.type === "income" ? row.amount : row.type === "expense" ? -row.amount : 0);
        }
        return pageArray(rows, input, { monthStats: { income, expense, net: income - expense }, categories: [...new Set(all.map((row) => row.category))].sort(), budgetCategories: [...new Set(memoryRows(memory.budgets, scope).map((row) => row.category))], dayNet });
    }
    if (resource === "bills") {
        const status = query.status;
        if (status && !["paid", "unpaid", "overdue"].includes(status))
            throw new PaginationError("Status tagihan tidak valid");
        const upcoming = query.view === "upcoming";
        const where = { ...own, ...(upcoming ? { status: { not: "paid" } } : status ? { status } : {}) };
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (connected) {
            const [page, unpaid, month, week, counts] = await Promise.all([
                databasePage(input, () => prisma.bill.count({ where }), (skip, take) => prisma.bill.findMany({ where, skip, take, orderBy: [{ dueDate: "asc" }, { id: "asc" }] })),
                prisma.bill.aggregate({ where: { ...own, status: { not: "paid" } }, _sum: { amount: true } }),
                prisma.bill.aggregate({ where: { ...own, dueDate: { gte: monthStart } }, _sum: { amount: true } }),
                prisma.bill.aggregate({ where: { ...own, status: { not: "paid" }, dueDate: { gte: now, lte: weekEnd } }, _sum: { amount: true } }),
                prisma.bill.groupBy({ by: ["status"], where: own, _count: true }),
            ]);
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { unpaidTotal: Number(unpaid._sum.amount ?? 0), monthTotal: Number(month._sum.amount ?? 0), weekTotal: Number(week._sum.amount ?? 0), counts: { ...Object.fromEntries(counts.map((row) => [row.status, row._count])), Semua: counts.reduce((sum, row) => sum + row._count, 0) } } };
        }
        const all = memoryRows(memory.bills, scope);
        const rows = all.filter((row) => upcoming ? row.status !== "paid" : !status || row.status === status).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
        return pageArray(rows, input, { unpaidTotal: all.filter((row) => row.status !== "paid").reduce((sum, row) => sum + row.amount, 0), monthTotal: all.filter((row) => new Date(row.dueDate) >= monthStart).reduce((sum, row) => sum + row.amount, 0), weekTotal: all.filter((row) => row.status !== "paid" && new Date(row.dueDate) >= now && new Date(row.dueDate) <= weekEnd).reduce((sum, row) => sum + row.amount, 0), counts: Object.fromEntries(["Semua", "paid", "unpaid", "overdue"].map((key) => [key, all.filter((row) => key === "Semua" || row.status === key).length])) });
    }
    if (resource === "budgets") {
        const period = query.period;
        if (period && !["daily", "weekly", "monthly"].includes(period))
            throw new PaginationError("Periode anggaran tidak valid");
        const where = { ...own, ...(period ? { period } : {}) };
        if (connected) {
            const [page, totals, counts] = await Promise.all([
                databasePage(input, () => prisma.budget.count({ where }), (skip, take) => prisma.budget.findMany({ where, skip, take, orderBy: query.view === "breakdown" ? [{ limit: "desc" }, { id: "asc" }] : [{ category: "asc" }, { id: "asc" }] })),
                prisma.$queryRaw(Prisma.sql `SELECT SUM("limit") AS "totalLimit", SUM("spent") AS "totalSpent", COUNT(*) FILTER (WHERE "spent" > "limit") AS "overspentCount" FROM "Budget" WHERE ${tenant}${period ? Prisma.sql ` AND "period" = ${period}` : Prisma.empty}`),
                prisma.budget.groupBy({ by: ["period"], where: own, _count: true }),
            ]);
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { totalLimit: Number(totals[0]?.totalLimit ?? 0), totalSpent: Number(totals[0]?.totalSpent ?? 0), overspentCount: Number(totals[0]?.overspentCount ?? 0), counts: Object.fromEntries(counts.map((row) => [row.period, row._count])) } };
        }
        const all = memoryRows(memory.budgets, scope);
        const rows = all.filter((row) => !period || row.period === period).sort((a, b) => query.view === "breakdown" ? b.limit - a.limit || a.id.localeCompare(b.id) : a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
        return pageArray(rows, input, { totalLimit: rows.reduce((sum, row) => sum + row.limit, 0), totalSpent: rows.reduce((sum, row) => sum + row.spent, 0), overspentCount: rows.filter((row) => row.spent > row.limit).length, counts: Object.fromEntries(["daily", "weekly", "monthly"].map((key) => [key, all.filter((row) => row.period === key).length])) });
    }
    if (resource === "recurringTransactions") {
        const filter = query.filter;
        const calendar = query.view === "calendar";
        const week = query.week ? Number(query.week) : undefined;
        if (calendar && (!week || !Number.isInteger(week) || week < 1 || week > 4))
            throw new PaginationError("Minggu kalender tidak valid");
        const where = { ...own, ...(calendar || filter === "Aktif" ? { isActive: true } : filter === "Nonaktif" ? { isActive: false } : {}), ...(filter === "Pengeluaran" ? { type: "expense" } : filter === "Pemasukan" ? { type: "income" } : {}) };
        if (connected) {
            const calendarDay = Prisma.sql `EXTRACT(DAY FROM ("nextDate" AT TIME ZONE 'UTC' AT TIME ZONE ${Intl.DateTimeFormat().resolvedOptions().timeZone}))`;
            const [groups, days] = await Promise.all([
                prisma.recurringTransaction.groupBy({ by: ["period", "type"], where: { ...own, isActive: true }, _sum: { amount: true }, _count: true }),
                prisma.$queryRaw(Prisma.sql `SELECT LEAST(CEIL(${calendarDay} / 7.0),4)::int AS week, COUNT(*) AS count FROM "RecurringTransaction" WHERE ${tenant} AND "isActive" GROUP BY week`),
            ]);
            const summary = { monthlyExpense: 0, monthlyIncome: 0, activeCount: 0, weekCounts: [0, 0, 0, 0] };
            for (const row of groups) {
                const amount = Number(row._sum.amount ?? 0) * (factors[row.period] ?? 1);
                if (row.type === "expense")
                    summary.monthlyExpense += amount;
                if (row.type === "income")
                    summary.monthlyIncome += amount;
                summary.activeCount += row._count;
            }
            for (const row of days)
                summary.weekCounts[row.week - 1] = Number(row.count);
            if (calendar) {
                const meta = pageMeta(summary.weekCounts[week - 1], input);
                const rows = await prisma.$queryRaw(Prisma.sql `SELECT * FROM "RecurringTransaction" WHERE ${tenant} AND "isActive" AND LEAST(CEIL(${calendarDay} / 7.0),4)::int = ${week} ORDER BY ${calendarDay}, "id" LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
                return { ...meta, items: rows.map((row) => ({ ...serialize(resource, row), day: row.nextDate.getDate() })), summary };
            }
            const page = await databasePage(input, () => prisma.recurringTransaction.count({ where }), (skip, take) => prisma.recurringTransaction.findMany({ where, skip, take, orderBy: [{ nextDate: "asc" }, { id: "asc" }] }));
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary };
        }
        const all = memoryRows(memory.recurringTransactions, scope);
        const active = all.filter((row) => row.isActive);
        const summary = { monthlyExpense: active.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount * (factors[row.period] ?? 1), 0), monthlyIncome: active.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount * (factors[row.period] ?? 1), 0), activeCount: active.length, weekCounts: [1, 2, 3, 4].map((value) => active.filter((row) => Math.min(Math.ceil(new Date(row.nextDate).getDate() / 7), 4) === value).length) };
        const rows = all.filter((row) => calendar ? row.isActive && Math.min(Math.ceil(new Date(row.nextDate).getDate() / 7), 4) === week : filter === "Aktif" ? row.isActive : filter === "Nonaktif" ? !row.isActive : filter === "Pengeluaran" ? row.type === "expense" : filter === "Pemasukan" ? row.type === "income" : true).sort((a, b) => new Date(a.nextDate).getDate() - new Date(b.nextDate).getDate() || a.id.localeCompare(b.id));
        return pageArray(calendar ? rows.map((row) => ({ ...row, day: new Date(row.nextDate).getDate() })) : rows, input, summary);
    }
    if (resource === "reimbursements") {
        const status = query.status;
        if (status && !["active", "settled"].includes(status))
            throw new PaginationError("Status reimbursement tidak valid");
        const where = { ...own, ...(status ? { status } : {}) };
        if (connected) {
            const [page, totals] = await Promise.all([
                databasePage(input, () => prisma.reimbursement.count({ where }), (skip, take) => prisma.reimbursement.findMany({ where, skip, take, orderBy: [{ submittedDate: "desc" }, { id: "asc" }] })),
                prisma.reimbursement.groupBy({ by: ["status"], where: own, _sum: { amount: true }, _count: true }),
            ]);
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { totalActive: Number(totals.find((row) => row.status === "active")?._sum.amount ?? 0), totalSettled: Number(totals.find((row) => row.status === "settled")?._sum.amount ?? 0), counts: { ...Object.fromEntries(totals.map((row) => [row.status, row._count])), Semua: totals.reduce((sum, row) => sum + row._count, 0) } } };
        }
        const all = memoryRows(memory.reimbursements, scope);
        return pageArray(all.filter((row) => !status || row.status === status).sort((a, b) => b.submittedDate.localeCompare(a.submittedDate) || a.id.localeCompare(b.id)), input, { totalActive: all.filter((row) => row.status === "active").reduce((sum, row) => sum + row.amount, 0), totalSettled: all.filter((row) => row.status === "settled").reduce((sum, row) => sum + row.amount, 0), counts: Object.fromEntries(["Semua", "active", "settled"].map((key) => [key, all.filter((row) => key === "Semua" || row.status === key).length])) });
    }
    if (connected) {
        const clauses = Prisma.sql `${tenant}${search ? Prisma.sql ` AND (strpos(lower("title"),lower(${search})) > 0 OR strpos(lower("content"),lower(${search})) > 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof("tags") = 'array' THEN "tags" ELSE '[]'::jsonb END) AS tag WHERE strpos(lower(tag),lower(${search})) > 0))` : Prisma.empty}`;
        const totals = await prisma.$queryRaw(Prisma.sql `SELECT COUNT(*) AS total FROM "Note" WHERE ${clauses}`);
        const meta = pageMeta(Number(totals[0]?.total ?? 0), input);
        const rows = await prisma.$queryRaw(Prisma.sql `SELECT * FROM "Note" WHERE ${clauses} ORDER BY "updatedAt" DESC, "id" LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
        return { ...meta, items: rows.map((row) => serialize(resource, row)) };
    }
    return pageArray(memoryRows(memory.notes, scope).filter((row) => !search || `${row.title} ${row.content} ${(row.tags ?? []).join(" ")}`.toLowerCase().includes(lower)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)), input);
}
