import { Prisma } from "@prisma/client";
import { db as prisma, canUseDatabase, isDatabaseConfigured } from "../prisma-client.js";
import { db as memory } from "../data.js";
import { databasePage, ownership, pageArray, PaginationError } from "./pagination.js";
const normalizedName = Prisma.sql `lower(regexp_replace(trim("personName"), '\\s+', ' ', 'g'))`;
const normalizedContact = Prisma.sql `lower(regexp_replace(trim("name"), '\\s+', ' ', 'g'))`;
const normalize = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
const numeric = (value) => Number(value ?? 0);
const date = (value) => value == null ? undefined : value instanceof Date ? value.toISOString() : value;
function ownerSql(scope) { return scope.userId ? Prisma.sql `"userId" = ${scope.userId}` : Prisma.sql `TRUE`; }
function hiddenNames(query) {
    if (!query.excludeNames)
        return [];
    let names;
    try {
        names = JSON.parse(query.excludeNames);
    }
    catch {
        throw new PaginationError("Daftar kontak tersembunyi tidak valid");
    }
    if (!Array.isArray(names) || names.some((name) => typeof name !== "string"))
        throw new PaginationError("Daftar kontak tersembunyi tidak valid");
    return names.map((name) => normalize(name));
}
function debtSummary(rows) {
    const totalOwe = rows.filter((row) => row.direction === "owe" && !row.isSettled).reduce((sum, row) => sum + row.amount - row.paidAmount, 0);
    const totalLent = rows.filter((row) => row.direction === "lent" && !row.isSettled).reduce((sum, row) => sum + row.amount - row.paidAmount, 0);
    return { totalOwe, totalLent, nett: totalLent - totalOwe };
}
function splitMetadata(bill) {
    const collected = bill.participants.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
    const outstanding = bill.participants.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0);
    const { participants, walletEffects: _walletEffects, ...row } = bill;
    return { ...row, participantCount: participants.length, paidCount: participants.filter((p) => p.paid).length, collected, outstanding };
}
function memoryList(resource, scope, query, input) {
    const scoped = (rows) => rows.filter((row) => {
        const userId = row.userId;
        return !scope.userId || userId === scope.userId || (!userId && scope.authId === "usr-demo-001");
    });
    const search = query.search?.trim().toLowerCase() ?? "";
    const debts = scoped(memory.debts);
    if (resource === "debts") {
        const summary = debtSummary(debts);
        if (query.view === "installments") {
            const debt = debts.find((row) => row.id === query.debtId);
            if (!debt)
                throw new PaginationError("Utang tidak ditemukan");
            return pageArray([...debt.installments].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), input);
        }
        const filtered = debts.filter((row) => (!query.direction || row.direction === query.direction) && (!query.group || `${row.direction}:${normalize(row.personName)}` === query.group) && (!search || (query.view === "groups" ? normalize(row.personName).includes(normalize(search)) : `${row.personName} ${row.description}`.toLowerCase().includes(search))));
        if (query.view === "groups") {
            const groups = new Map();
            for (const debt of filtered) {
                const key = `${debt.direction}:${normalize(debt.personName)}`;
                const group = groups.get(key) ?? { key, personName: debt.personName, personContact: debt.personContact, amount: 0, paidAmount: 0, remaining: 0, debtCount: 0, activeCount: 0 };
                group.amount += debt.amount;
                group.paidAmount += debt.paidAmount;
                group.debtCount++;
                if (!debt.isSettled) {
                    group.remaining += debt.amount - debt.paidAmount;
                    group.activeCount++;
                }
                if (!group.personContact)
                    group.personContact = debt.personContact;
                groups.set(key, group);
            }
            return pageArray([...groups.values()].sort((a, b) => b.remaining - a.remaining || a.key.localeCompare(b.key)), input, summary);
        }
        return pageArray(filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).map((debt) => {
            const { installments, walletEffects: _walletEffects, ...row } = debt;
            return { ...row, installmentCount: installments.length };
        }), input, summary);
    }
    if (resource === "debtContacts") {
        if (query.view === "saved")
            return pageArray(scoped(memory.debtContacts).filter((row) => !search || `${row.name} ${row.phone ?? ""} ${row.note ?? ""}`.toLowerCase().includes(search)).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), input);
        const contacts = new Map();
        for (const contact of scoped(memory.debtContacts))
            contacts.set(normalize(contact.name), contact);
        for (const debt of debts)
            if (!contacts.has(normalize(debt.personName)))
                contacts.set(normalize(debt.personName), { id: `debt-contact-${normalize(debt.personName)}`, name: debt.personName, phone: debt.personContact, createdAt: debt.createdAt });
        const excluded = new Set(hiddenNames(query));
        const totals = new Map();
        for (const debt of debts) {
            if (debt.isSettled)
                continue;
            const name = normalize(debt.personName);
            const total = totals.get(name) ?? { oweTotal: 0, lentTotal: 0 };
            if (debt.direction === "owe")
                total.oweTotal += debt.amount - debt.paidAmount;
            else
                total.lentTotal += debt.amount - debt.paidAmount;
            totals.set(name, total);
        }
        return pageArray([...contacts.entries()]
            .filter(([name, contact]) => !excluded.has(name) && (!search || `${contact.name} ${contact.phone ?? ""} ${contact.note ?? ""}`.toLowerCase().includes(search)))
            .map(([name, contact]) => ({ ...contact, ...(totals.get(name) ?? { oweTotal: 0, lentTotal: 0 }) }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), input);
    }
    if (resource === "splitBills") {
        const bills = scoped(memory.splitBills);
        const summary = { activeCount: bills.filter((bill) => bill.status === "active").length, totalCollected: bills.reduce((sum, bill) => sum + splitMetadata(bill).collected, 0), totalOutstanding: bills.filter((bill) => bill.status === "active").reduce((sum, bill) => sum + splitMetadata(bill).outstanding, 0) };
        if (query.view === "participants") {
            const bill = bills.find((row) => row.id === query.billId);
            if (!bill)
                throw new PaginationError("Patungan tidak ditemukan");
            return pageArray(bill.participants.filter((p) => (query.reminders !== "true" || !p.paid) && (!search || p.name.toLowerCase().includes(search))).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), input, splitMetadata(bill));
        }
        return pageArray(bills.filter((bill) => (!query.status || bill.status === query.status) && (!query.id || bill.id === query.id) && (!search || bill.title.toLowerCase().includes(search))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).map(splitMetadata), input, summary);
    }
    return pageArray(scoped(memory.teamMembers).filter((row) => (!query.status || row.status === query.status) && (!search || `${row.name} ${row.email} ${row.phone ?? ""}`.toLowerCase().includes(search))).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), input);
}
export async function listPeople(resource, scope, query, input, serialize) {
    if (!["debts", "debtContacts", "splitBills", "teamMembers"].includes(resource))
        return null;
    if (!(await canUseDatabase())) {
        if (isDatabaseConfigured())
            throw Object.assign(new Error("Database belum tersedia"), { status: 503 });
        return memoryList(resource, scope, query, input);
    }
    const owner = ownerSql(scope);
    const search = query.search?.trim() ?? "";
    if (resource === "debts") {
        const sums = await prisma.$queryRaw(Prisma.sql `SELECT COALESCE(sum("amount"-"paidAmount") FILTER (WHERE "direction"='owe' AND NOT "isSettled"),0) AS "totalOwe", COALESCE(sum("amount"-"paidAmount") FILTER (WHERE "direction"='lent' AND NOT "isSettled"),0) AS "totalLent" FROM "Debt" WHERE ${owner}`);
        const totalOwe = numeric(sums[0]?.totalOwe), totalLent = numeric(sums[0]?.totalLent);
        const summary = { totalOwe, totalLent, nett: totalLent - totalOwe };
        if (query.view === "installments") {
            if (!query.debtId)
                throw new PaginationError("ID utang wajib diisi");
            const exists = await prisma.debt.count({ where: { ...ownership(scope), id: query.debtId } });
            if (!exists)
                throw new PaginationError("Utang tidak ditemukan");
            const from = Prisma.sql `FROM "Debt" d CROSS JOIN LATERAL jsonb_array_elements(d."installments") WITH ORDINALITY AS installment(value, position) WHERE ${owner} AND d."id"=${query.debtId}`;
            return databasePage(input, async () => numeric((await prisma.$queryRaw(Prisma.sql `SELECT count(*) ${from}`))[0]?.count), async (skip, take) => (await prisma.$queryRaw(Prisma.sql `SELECT installment.value ${from} ORDER BY installment.value->>'date' DESC, installment.value->>'id', installment.position LIMIT ${take} OFFSET ${skip}`)).map((row) => row.value));
        }
        const searchFilter = !search ? Prisma.empty : query.view === "groups"
            ? Prisma.sql `AND ${normalizedName} ILIKE ${`%${normalize(search)}%`}`
            : Prisma.sql `AND ("personName" ILIKE ${`%${search}%`} OR "description" ILIKE ${`%${search}%`})`;
        const filter = Prisma.sql `${owner} ${query.direction ? Prisma.sql `AND "direction"=${query.direction}` : Prisma.empty} ${query.group ? Prisma.sql `AND "direction" || ':' || ${normalizedName}=${query.group}` : Prisma.empty} ${searchFilter}`;
        if (query.view === "groups") {
            const groups = Prisma.sql `SELECT "direction" || ':' || ${normalizedName} AS "key", min("personName") AS "personName", max(NULLIF("personContact",'')) AS "personContact", sum("amount")::float8 AS "amount", sum("paidAmount")::float8 AS "paidAmount", COALESCE(sum("amount"-"paidAmount") FILTER (WHERE NOT "isSettled"),0)::float8 AS "remaining", count(*)::int AS "debtCount", count(*) FILTER (WHERE NOT "isSettled")::int AS "activeCount" FROM "Debt" WHERE ${filter} GROUP BY "direction", ${normalizedName}`;
            const result = await databasePage(input, async () => numeric((await prisma.$queryRaw(Prisma.sql `SELECT count(*) FROM (${groups}) groups`))[0]?.count), (skip, take) => prisma.$queryRaw(Prisma.sql `${groups} ORDER BY "remaining" DESC, "key" LIMIT ${take} OFFSET ${skip}`));
            return { ...result, summary };
        }
        const result = await databasePage(input, async () => numeric((await prisma.$queryRaw(Prisma.sql `SELECT count(*) FROM "Debt" WHERE ${filter}`))[0]?.count), (skip, take) => prisma.$queryRaw(Prisma.sql `SELECT "id","walletId","direction","personName","personContact","amount"::float8,"paidAmount"::float8,"dueDate","description","isSettled","createdAt",jsonb_array_length("installments") AS "installmentCount" FROM "Debt" WHERE ${filter} ORDER BY "createdAt" DESC,"id" LIMIT ${take} OFFSET ${skip}`));
        return { ...result, items: result.items.map((row) => ({ ...row, dueDate: date(row.dueDate), createdAt: date(row.createdAt) })), summary };
    }
    if (resource === "debtContacts") {
        if (query.view === "saved") {
            const where = {
                ...ownership(scope),
                ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }, { note: { contains: search, mode: "insensitive" } }] } : {}),
            };
            const result = await databasePage(input, () => prisma.debtContact.count({ where }), (skip, take) => prisma.debtContact.findMany({ where, skip, take, orderBy: [{ name: "asc" }, { id: "asc" }] }));
            return { ...result, items: result.items.map((row) => serialize(resource, row)) };
        }
        const excluded = hiddenNames(query);
        const cte = Prisma.sql `WITH debt_totals AS (SELECT ${normalizedName} AS norm, min("personName") AS name, max("personContact") AS phone, min("createdAt") AS created, COALESCE(sum("amount"-"paidAmount") FILTER (WHERE "direction"='owe' AND NOT "isSettled"),0)::float8 AS owe, COALESCE(sum("amount"-"paidAmount") FILTER (WHERE "direction"='lent' AND NOT "isSettled"),0)::float8 AS lent FROM "Debt" WHERE ${owner} GROUP BY ${normalizedName}), saved AS (SELECT DISTINCT ON (${normalizedContact}) "id","name","phone","note","createdAt",${normalizedContact} AS norm FROM "DebtContact" WHERE ${owner} ORDER BY ${normalizedContact},"createdAt","id"), contacts AS (SELECT s."id",s."name",s."phone",s."note",s."createdAt",s.norm,COALESCE(d.owe,0) AS "oweTotal",COALESCE(d.lent,0) AS "lentTotal" FROM saved s LEFT JOIN debt_totals d ON d.norm=s.norm UNION ALL SELECT 'debt-contact-' || d.norm,d.name,d.phone,NULL,d.created,d.norm,d.owe,d.lent FROM debt_totals d WHERE NOT EXISTS (SELECT 1 FROM saved s WHERE s.norm=d.norm)), filtered AS (SELECT * FROM contacts WHERE norm<>'' ${excluded.length ? Prisma.sql `AND norm NOT IN (${Prisma.join(excluded)})` : Prisma.empty} ${search ? Prisma.sql `AND ("name" ILIKE ${`%${search}%`} OR "phone" ILIKE ${`%${search}%`} OR "note" ILIKE ${`%${search}%`})` : Prisma.empty})`;
        const result = await databasePage(input, async () => numeric((await prisma.$queryRaw(Prisma.sql `${cte} SELECT count(*) FROM filtered`))[0]?.count), (skip, take) => prisma.$queryRaw(Prisma.sql `${cte} SELECT "id","name","phone","note","createdAt","oweTotal","lentTotal" FROM filtered ORDER BY "name","id" LIMIT ${take} OFFSET ${skip}`));
        return { ...result, items: result.items.map((row) => ({ ...row, createdAt: date(row.createdAt) })) };
    }
    if (resource === "teamMembers") {
        const where = { ...ownership(scope), ...(query.status ? { status: query.status } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }] } : {}) };
        const result = await databasePage(input, () => prisma.teamMember.count({ where }), (skip, take) => prisma.teamMember.findMany({ where, skip, take, orderBy: [{ name: "asc" }, { id: "asc" }] }));
        return { ...result, items: result.items.map((row) => serialize(resource, row)) };
    }
    const allWhere = ownership(scope);
    if (query.view === "participants") {
        if (!query.billId)
            throw new PaginationError("ID patungan wajib diisi");
        const bill = await prisma.splitBill.findFirst({ where: { ...allWhere, id: query.billId } });
        if (!bill)
            throw new PaginationError("Patungan tidak ditemukan");
        const where = { splitBillId: bill.id, splitBill: allWhere, ...(query.reminders === "true" ? { paid: false } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        const result = await databasePage(input, () => prisma.splitBillParticipant.count({ where }), async (skip, take) => {
            const rows = await prisma.splitBillParticipant.findMany({ where, skip, take, orderBy: [{ name: "asc" }, { id: "asc" }] });
            for (const row of rows)
                if (!row.payToken) {
                    const token = crypto.randomUUID().replace(/-/g, "");
                    await prisma.splitBillParticipant.updateMany({ where: { id: row.id, payToken: null, splitBill: allWhere }, data: { payToken: token } });
                    row.payToken = (await prisma.splitBillParticipant.findFirst({ where: { id: row.id, splitBillId: bill.id, splitBill: allWhere }, select: { payToken: true } }))?.payToken ?? token;
                }
            return rows.map((row) => ({ id: row.id, name: row.name, contact: row.contact ?? undefined, walletId: row.walletId ?? undefined, amount: Number(row.amount), paid: row.paid, paidAt: date(row.paidAt), payToken: row.payToken ?? undefined }));
        });
        return { ...result, summary: (await splitRowsMetadata([bill], scope, serialize))[0] };
    }
    const where = { ...allWhere, ...(query.status ? { status: query.status } : {}), ...(query.id ? { id: query.id } : {}), ...(search ? { title: { contains: search, mode: "insensitive" } } : {}) };
    const result = await databasePage(input, () => prisma.splitBill.count({ where }), (skip, take) => prisma.splitBill.findMany({ where, skip, take, orderBy: [{ date: "desc" }, { id: "asc" }] }));
    const totals = await prisma.$queryRaw(Prisma.sql `SELECT (SELECT count(*) FROM "SplitBill" WHERE ${owner} AND "status"='active') AS "activeCount",COALESCE(sum(p."amount") FILTER (WHERE p."paid"),0) AS "totalCollected",COALESCE(sum(p."amount") FILTER (WHERE NOT p."paid" AND b."status"='active'),0) AS "totalOutstanding" FROM "SplitBill" b JOIN "SplitBillParticipant" p ON p."splitBillId"=b."id" WHERE ${owner}`);
    return { ...result, items: await splitRowsMetadata(result.items, scope, serialize), summary: { activeCount: numeric(totals[0]?.activeCount), totalCollected: numeric(totals[0]?.totalCollected), totalOutstanding: numeric(totals[0]?.totalOutstanding) } };
}
async function splitRowsMetadata(bills, scope, serialize) {
    if (!bills.length)
        return [];
    const groups = await prisma.splitBillParticipant.groupBy({
        by: ["splitBillId", "paid"],
        where: { splitBillId: { in: bills.map((bill) => bill.id) }, splitBill: ownership(scope) },
        _count: { _all: true }, _sum: { amount: true },
    });
    const metadata = new Map();
    for (const group of groups) {
        const totals = metadata.get(group.splitBillId) ?? { participantCount: 0, paidCount: 0, collected: 0, outstanding: 0 };
        totals.participantCount += group._count._all;
        if (group.paid) {
            totals.paidCount = group._count._all;
            totals.collected = numeric(group._sum.amount);
        }
        else
            totals.outstanding = numeric(group._sum.amount);
        metadata.set(group.splitBillId, totals);
    }
    return bills.map((bill) => {
        const { participants: _participants, ...row } = serialize("splitBills", bill);
        return { ...row, ...(metadata.get(bill.id) ?? { participantCount: 0, paidCount: 0, collected: 0, outstanding: 0 }) };
    });
}
