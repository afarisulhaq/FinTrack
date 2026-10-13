import { Prisma } from "@prisma/client";
import { db as prisma, canUseDatabase, isDatabaseConfigured } from "../prisma-client.js";
import { db as memory } from "../data.js";
import { flattenWalletTree, normalizeWalletTree, walletGroupBalance } from "../../src/lib/wallets.js";
import { databasePage, pageArray, pageMeta, ownership, memoryRows, PaginationError } from "./pagination.js";
const supported = { wallets: true, investments: true, savingGoals: true, cards: true, wishlist: true, categories: true, subCategories: true };
const assetLabels = { stock: "Saham", crypto: "Crypto", gold: "Emas", "mutual-fund": "Reksa Dana", bond: "Obligasi" };
const assetColors = { stock: "#FFD147", crypto: "#f59e0b", gold: "#d97706", "mutual-fund": "#22c55e", bond: "#38bdf8" };
function booleanFilter(value, label) {
    if (value === undefined)
        return undefined;
    if (value !== "true" && value !== "false")
        throw new PaginationError(`${label} tidak valid`);
    return value === "true";
}
function withoutNested(value, key) {
    if (typeof value !== "object" || value === null)
        return {};
    const record = { ...value };
    delete record[key];
    return record;
}
export async function listAssets(resource, scope, query, input, serialize) {
    if (supported[resource] !== true)
        return null;
    const connected = await canUseDatabase();
    if (!connected && isDatabaseConfigured())
        throw new Error("Database sementara tidak tersedia");
    const own = ownership(scope);
    const tenant = scope.userId ? Prisma.sql `"userId" = ${scope.userId}` : Prisma.sql `TRUE`;
    const search = (query.search ?? "").trim();
    const matches = (text) => !search || text.toLowerCase().includes(search.toLowerCase());
    if (resource === "wallets") {
        if (connected) {
            const root = Prisma.sql `("parentId" IS NULL OR NOT EXISTS (SELECT 1 FROM scoped parent WHERE parent."id" = scoped."parentId"))`;
            const filter = Prisma.sql `${query.parentId ? Prisma.sql `"parentId" = ${query.parentId}` : query.view === "parents" ? root : Prisma.sql `TRUE`}${search ? Prisma.sql ` AND strpos(lower("name"), lower(${search})) > 0` : Prisma.empty}`;
            const totals = await prisma.$queryRaw(Prisma.sql `
        WITH scoped AS (SELECT * FROM "Wallet" WHERE ${tenant})
        SELECT COALESCE(SUM("balance"), 0) AS "totalBalance", COUNT(*) FILTER (WHERE ${root}) AS "parentCount",
          COUNT(*) FILTER (WHERE NOT ${root}) AS "childCount", COUNT(*) FILTER (WHERE ${filter}) AS total FROM scoped`);
            const total = totals[0];
            const meta = pageMeta(Number(total?.total ?? 0), input);
            const rows = await prisma.$queryRaw(Prisma.sql `
        WITH RECURSIVE scoped AS (SELECT * FROM "Wallet" WHERE ${tenant}),
        page AS (SELECT * FROM scoped WHERE ${filter} ORDER BY "createdAt", "id" LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}),
        descendants AS (
          SELECT "id" AS root, "id", "balance" FROM page
          UNION
          SELECT d.root, w."id", w."balance" FROM scoped w JOIN descendants d ON w."parentId" = d."id"
        )
        SELECT p.*, (SELECT COALESCE(SUM(d."balance"),0) FROM descendants d WHERE d.root = p."id") AS "groupBalance",
          (SELECT COUNT(*) FROM scoped child WHERE child."parentId" = p."id") AS "childCount"
        FROM page p ORDER BY p."createdAt", p."id"`);
            return { ...meta, items: rows.map((row) => ({ ...withoutNested(serialize(resource, row), "children"), groupBalance: Number(row.groupBalance), childCount: Number(row.childCount) })), summary: { totalBalance: Number(total?.totalBalance ?? 0), parentCount: Number(total?.parentCount ?? 0), childCount: Number(total?.childCount ?? 0) } };
        }
        const flat = memoryRows(flattenWalletTree(memory.wallets), scope);
        const roots = normalizeWalletTree(flat);
        const all = flattenWalletTree(roots);
        const trees = new Map();
        const visit = (wallet) => { trees.set(wallet.id, wallet); for (const child of wallet.children ?? [])
            visit(child); };
        for (const root of roots)
            visit(root);
        const selected = (query.parentId ? all.filter((row) => row.parentId === query.parentId) : query.view === "parents" ? roots : all).filter((row) => matches(row.name)).sort((a, b) => a.id.localeCompare(b.id));
        return pageArray(selected.map((row) => ({ ...withoutNested(row, "children"), childCount: trees.get(row.id)?.children?.length ?? 0, groupBalance: walletGroupBalance(trees.get(row.id) ?? row) })), input, { totalBalance: all.reduce((sum, row) => sum + row.balance, 0), parentCount: roots.length, childCount: all.length - roots.length });
    }
    if (resource === "savingGoals") {
        const where = { ...own, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        if (connected) {
            const [page, totals] = await Promise.all([
                databasePage(input, () => prisma.savingGoal.count({ where }), (skip, take) => prisma.savingGoal.findMany({ where, skip, take, orderBy: [{ deadline: "asc" }, { id: "asc" }] })),
                prisma.$queryRaw(Prisma.sql `
          SELECT COALESCE(SUM("targetAmount"),0) AS "totalTarget", COALESCE(SUM("currentAmount"),0) AS "totalCollected",
            COALESCE(AVG(CASE WHEN "targetAmount" = 0 THEN 0 ELSE FLOOR("currentAmount" / "targetAmount" * 1000 + 0.5) / 10 END),0) AS "avgProgress"
          FROM "SavingGoal" WHERE ${tenant}`),
            ]);
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { totalTarget: Number(totals[0]?.totalTarget ?? 0), totalCollected: Number(totals[0]?.totalCollected ?? 0), avgProgress: Number(totals[0]?.avgProgress ?? 0) } };
        }
        const all = memoryRows(memory.savingGoals, scope);
        return pageArray(all.filter((row) => matches(row.name)).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id)), input, { totalTarget: all.reduce((sum, row) => sum + row.targetAmount, 0), totalCollected: all.reduce((sum, row) => sum + row.currentAmount, 0), avgProgress: all.length ? all.reduce((sum, row) => sum + (row.targetAmount === 0 ? 0 : Math.round(row.currentAmount / row.targetAmount * 1000) / 10), 0) / all.length : 0 });
    }
    if (resource === "cards") {
        const day = new Date().getDate();
        const where = { ...own, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        if (connected) {
            const groups = await prisma.card.groupBy({ by: ["type"], where: own, _sum: { limit: true, used: true }, _count: true });
            const credit = groups.find((row) => row.type === "credit");
            const summary = { totalLimit: Number(credit?._sum.limit ?? 0), totalUsed: Number(credit?._sum.used ?? 0), creditCount: credit?._count ?? 0, debitCount: groups.find((row) => row.type === "debit")?._count ?? 0 };
            if (query.view === "billing") {
                const creditCount = search ? await prisma.card.count({ where: { ...where, type: "credit" } }) : summary.creditCount;
                const meta = pageMeta(creditCount * 2, input);
                const rows = await prisma.$queryRaw(Prisma.sql `
          SELECT c."id" || ':' || event.type AS id, c."name", event.date, event.label, event.type
          FROM "Card" c CROSS JOIN LATERAL (VALUES
            (c."statementDate", 'Tanggal Cetak Struk', 'statement', 0),
            (c."dueDate", 'Jatuh Tempo', 'due', 1)
          ) AS event(date, label, type, position)
          WHERE ${tenant} AND c."type" = 'credit'${search ? Prisma.sql ` AND strpos(lower(c."name"), lower(${search})) > 0` : Prisma.empty}
          ORDER BY CASE WHEN event.date >= ${day} THEN event.date ELSE event.date + 31 END, c."createdAt", c."id", event.position
          LIMIT ${meta.pageSize} OFFSET ${(meta.page - 1) * meta.pageSize}`);
                return { ...meta, items: rows, summary };
            }
            const page = await databasePage(input, () => prisma.card.count({ where }), (skip, take) => prisma.card.findMany({ where, skip, take, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary };
        }
        const all = memoryRows(memory.cards, scope);
        const credit = all.filter((row) => row.type === "credit");
        const summary = { totalLimit: credit.reduce((sum, row) => sum + (row.limit ?? 0), 0), totalUsed: credit.reduce((sum, row) => sum + (row.used ?? 0), 0), creditCount: credit.length, debitCount: all.filter((row) => row.type === "debit").length };
        if (query.view === "billing") {
            const events = credit.filter((row) => matches(row.name)).flatMap((row) => [{ id: `${row.id}:statement`, name: row.name, date: row.statementDate, label: "Tanggal Cetak Struk", type: "statement" }, { id: `${row.id}:due`, name: row.name, date: row.dueDate, label: "Jatuh Tempo", type: "due" }]);
            return pageArray(events.sort((a, b) => (a.date >= day ? a.date : a.date + 31) - (b.date >= day ? b.date : b.date + 31) || a.id.localeCompare(b.id)), input, summary);
        }
        return pageArray(all.filter((row) => matches(row.name)).sort((a, b) => a.id.localeCompare(b.id)), input, summary);
    }
    if (resource === "wishlist") {
        const purchased = booleanFilter(query.purchased, "Status wishlist");
        const priority = query.priority === "Semua" ? undefined : query.priority;
        if (priority && !["high", "medium", "low"].includes(priority))
            throw new PaginationError("Prioritas wishlist tidak valid");
        const where = { ...own, ...(purchased === undefined ? {} : { isPurchased: purchased }), ...(priority ? { priority } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        if (connected) {
            const [page, groups] = await Promise.all([
                databasePage(input, () => prisma.wishlistItem.count({ where }), (skip, take) => prisma.wishlistItem.findMany({ where, skip, take, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })),
                prisma.wishlistItem.groupBy({ by: ["isPurchased", "priority"], where: own, _sum: { price: true }, _count: true }),
            ]);
            const active = groups.filter((row) => !row.isPurchased);
            const bought = groups.filter((row) => row.isPurchased);
            const totalItems = active.reduce((sum, row) => sum + row._count, 0);
            return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: { totalItems, totalValue: active.reduce((sum, row) => sum + Number(row._sum.price ?? 0), 0), purchasedCount: bought.reduce((sum, row) => sum + row._count, 0), purchasedValue: bought.reduce((sum, row) => sum + Number(row._sum.price ?? 0), 0), counts: { Semua: totalItems, ...Object.fromEntries(["high", "medium", "low"].map((key) => [key, active.filter((row) => row.priority === key).reduce((sum, row) => sum + row._count, 0)])) } } };
        }
        const all = memoryRows(memory.wishlist, scope);
        const active = all.filter((row) => !row.isPurchased);
        const bought = all.filter((row) => row.isPurchased);
        return pageArray(all.filter((row) => (purchased === undefined || row.isPurchased === purchased) && (!priority || row.priority === priority) && matches(row.name)).sort((a, b) => a.id.localeCompare(b.id)), input, { totalItems: active.length, totalValue: active.reduce((sum, row) => sum + row.price, 0), purchasedCount: bought.length, purchasedValue: bought.reduce((sum, row) => sum + row.price, 0), counts: { Semua: active.length, ...Object.fromEntries(["high", "medium", "low"].map((key) => [key, active.filter((row) => row.priority === key).length])) } });
    }
    if (resource === "categories" || resource === "subCategories") {
        if (query.type && !["expense", "income", "transfer"].includes(query.type))
            throw new PaginationError("Tipe kategori tidak valid");
        const categoryWhere = { ...own, ...(query.type ? { type: query.type } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        const subWhere = { ...own, category: { ...own, ...(query.type ? { type: query.type } : {}) }, ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) };
        if (connected) {
            if (resource === "subCategories") {
                const page = await databasePage(input, () => prisma.subCategory.count({ where: subWhere }), (skip, take) => prisma.subCategory.findMany({ where: subWhere, skip, take, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }] }));
                return { ...page, items: page.items.map((row) => serialize(resource, row)) };
            }
            const [page, counts, subs] = await Promise.all([
                databasePage(input, () => prisma.category.count({ where: categoryWhere }), (skip, take) => prisma.category.findMany({ where: categoryWhere, skip, take, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }] })),
                prisma.category.groupBy({ by: ["type"], where: own, _count: true }),
                prisma.$queryRaw(Prisma.sql `
          WITH categories AS (SELECT "id", "type" FROM "Category" WHERE ${tenant}), subs AS (SELECT "categoryId" FROM "SubCategory" WHERE ${tenant})
          SELECT c."type", COUNT(*) AS count FROM categories c JOIN subs s ON s."categoryId" = c."id" GROUP BY c."type"`),
            ]);
            const childCounts = page.items.length ? await prisma.subCategory.groupBy({ by: ["categoryId"], where: { ...own, categoryId: { in: page.items.map((row) => row.id) } }, _count: true }) : [];
            const countById = new Map(childCounts.map((row) => [row.categoryId, row._count]));
            return { ...page, items: page.items.map((row) => ({ ...withoutNested(serialize(resource, row), "subCategories"), subCategoryCount: countById.get(row.id) ?? 0 })), summary: { expense: counts.find((row) => row.type === "expense")?._count ?? 0, income: counts.find((row) => row.type === "income")?._count ?? 0, transfer: counts.find((row) => row.type === "transfer")?._count ?? 0, expenseSubs: Number(subs.find((row) => row.type === "expense")?.count ?? 0), incomeSubs: Number(subs.find((row) => row.type === "income")?.count ?? 0) } };
        }
        const categories = memoryRows(memory.categories, scope);
        const byId = new Map(categories.map((row) => [row.id, row]));
        const subs = memoryRows([...new Map([...categories.flatMap((row) => row.subCategories ?? []), ...memory.subCategories].map((row) => [row.id, row])).values()], scope).filter((row) => byId.has(row.categoryId));
        const order = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
        if (resource === "subCategories")
            return pageArray(subs.filter((row) => (!query.categoryId || row.categoryId === query.categoryId) && (!query.type || byId.get(row.categoryId)?.type === query.type) && matches(row.name)).sort(order), input);
        return pageArray(categories.filter((row) => (!query.type || row.type === query.type) && matches(row.name)).sort(order).map((row) => ({ ...withoutNested(row, "subCategories"), subCategoryCount: subs.filter((sub) => sub.categoryId === row.id).length })), input, { expense: categories.filter((row) => row.type === "expense").length, income: categories.filter((row) => row.type === "income").length, transfer: categories.filter((row) => row.type === "transfer").length, expenseSubs: subs.filter((row) => byId.get(row.categoryId)?.type === "expense").length, incomeSubs: subs.filter((row) => byId.get(row.categoryId)?.type === "income").length });
    }
    const sold = booleanFilter(query.sold, "Status investasi");
    const where = { ...own, ...(query.broker ? { broker: query.broker } : {}), ...(sold === undefined ? {} : { quantity: sold ? { equals: 0 } : { gt: 0 } }), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { symbol: { contains: search, mode: "insensitive" } }] } : {}) };
    if (query.view === "performance") {
        const performanceWhere = { ...own, sellPrice: null };
        if (connected) {
            const rows = await prisma.investment.findMany({
                where: performanceWhere,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true, symbol: true, quantity: true, currentPrice: true, avgBuyPrice: true, buyFee: true },
            });
            const series = rows.map((row) => {
                const value = Number(row.quantity) * Number(row.currentPrice);
                const cost = Number(row.quantity) * Number(row.avgBuyPrice) + Number(row.buyFee ?? 0);
                return { id: row.id, name: row.symbol.replace(/\.JK$/, ""), value: cost > 0 ? (value - cost) / cost * 100 : 0, pl: value - cost };
            });
            return { items: [], total: 0, totalPages: 1, page: 1, pageSize: input.pageSize, summary: { series } };
        }
        const rows = memoryRows(memory.investments, scope).filter((row) => row.sellPrice == null).sort((a, b) => a.id.localeCompare(b.id));
        const series = rows.map((row) => {
            const value = row.quantity * row.currentPrice;
            const cost = row.quantity * row.avgBuyPrice + (row.buyFee ?? 0);
            return { id: row.id, name: row.symbol.replace(/\.JK$/, ""), value: cost > 0 ? (value - cost) / cost * 100 : 0, pl: value - cost };
        });
        return { items: [], total: 0, totalPages: 1, page: 1, pageSize: input.pageSize, summary: { series } };
    }
    if (connected) {
        const [page, aggregates] = await Promise.all([
            databasePage(input, () => prisma.investment.count({ where }), (skip, take) => prisma.investment.findMany({ where, skip, take, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })),
            prisma.$queryRaw(Prisma.sql `
        WITH scoped AS (
          SELECT *, "quantity" * "currentPrice" AS value, "quantity" * "avgBuyPrice" + COALESCE("buyFee",0) AS cost,
            CASE WHEN "soldQuantity" > 0 THEN "soldQuantity" ELSE "quantity" END AS sold_qty
          FROM "Investment" WHERE ${tenant}
        ), pie AS (
          SELECT "assetClass", SUM(value) AS value FROM scoped WHERE "sellPrice" IS NULL GROUP BY "assetClass"
        )
        SELECT COALESCE(SUM(value) FILTER (WHERE "quantity" > 0),0)::double precision AS "totalValue",
          COALESCE(SUM(value - cost) FILTER (WHERE "quantity" > 0),0)::double precision AS "totalPL",
          COALESCE(SUM(cost) FILTER (WHERE "quantity" > 0),0)::double precision AS "totalCost",
          COALESCE(SUM(sold_qty * ("sellPrice" - "avgBuyPrice") - COALESCE("sellFee",0)) FILTER (WHERE "sellPrice" IS NOT NULL AND ("soldQuantity" > 0 OR "quantity" > 0)),0)::double precision AS "totalRealizedPL",
          (COUNT(*) FILTER (WHERE "quantity" > 0))::int AS "activeCount", (COUNT(*) FILTER (WHERE "quantity" = 0))::int AS "soldCount",
          COALESCE((SELECT jsonb_agg(b."broker" ORDER BY b."broker") FROM (SELECT DISTINCT "broker" FROM scoped WHERE "broker" <> '') b),'[]'::jsonb) AS brokers,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('name', CASE "assetClass" WHEN 'stock' THEN 'Saham' WHEN 'crypto' THEN 'Crypto' WHEN 'gold' THEN 'Emas' WHEN 'mutual-fund' THEN 'Reksa Dana' WHEN 'bond' THEN 'Obligasi' ELSE "assetClass" END,
            'value', value, 'color', CASE "assetClass" WHEN 'crypto' THEN '#f59e0b' WHEN 'gold' THEN '#d97706' WHEN 'mutual-fund' THEN '#22c55e' WHEN 'bond' THEN '#38bdf8' ELSE '#FFD147' END) ORDER BY "assetClass") FROM pie),'[]'::jsonb) AS "pieData"
        FROM scoped`),
        ]);
        return { ...page, items: page.items.map((row) => serialize(resource, row)), summary: aggregates[0] };
    }
    const all = memoryRows(memory.investments, scope);
    const summary = { totalValue: 0, totalPL: 0, totalCost: 0, totalRealizedPL: 0, activeCount: 0, soldCount: 0, brokers: [...new Set(all.map((row) => row.broker).filter(Boolean))].sort(), pieData: [] };
    const pie = new Map();
    for (const row of all) {
        const value = row.quantity * row.currentPrice;
        const cost = row.quantity * row.avgBuyPrice + (row.buyFee ?? 0);
        if (row.quantity > 0) {
            summary.totalValue += value;
            summary.totalPL += value - cost;
            summary.totalCost += cost;
            summary.activeCount++;
        }
        if (row.quantity === 0)
            summary.soldCount++;
        if (row.sellPrice != null && (row.soldQuantity > 0 || row.quantity > 0))
            summary.totalRealizedPL += (row.soldQuantity > 0 ? row.soldQuantity : row.quantity) * (row.sellPrice - row.avgBuyPrice) - (row.sellFee ?? 0);
        if (row.sellPrice == null)
            pie.set(row.assetClass, (pie.get(row.assetClass) ?? 0) + value);
    }
    summary.pieData = [...pie.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ name: assetLabels[key] ?? key, value, color: assetColors[key] ?? "#FFD147" }));
    return pageArray(all.filter((row) => (!query.broker || row.broker === query.broker) && (sold === undefined || (sold ? row.quantity === 0 : row.quantity > 0)) && matches(`${row.name} ${row.symbol}`)).sort((a, b) => a.id.localeCompare(b.id)), input, summary);
}
