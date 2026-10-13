import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../src/lib/pagination.js";
export class PaginationError extends Error {
    status = 400;
}
export function readPage(query) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
        throw new PaginationError(`Halaman harus positif dan ukuran halaman antara 1 dan ${MAX_PAGE_SIZE}`);
    return { page, pageSize };
}
export function pageMeta(total, input) {
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { total, totalPages, page: Math.min(input.page, totalPages), pageSize: input.pageSize };
}
export function pageArray(rows, input, summary) {
    const meta = pageMeta(rows.length, input);
    const start = (meta.page - 1) * meta.pageSize;
    return { ...meta, items: rows.slice(start, start + meta.pageSize), ...(summary === undefined ? {} : { summary }) };
}
export function ownership(scope) {
    return scope.userId ? { userId: scope.userId } : {};
}
export async function databasePage(input, count, read) {
    const meta = pageMeta(await count(), input);
    const items = await read((meta.page - 1) * meta.pageSize, meta.pageSize);
    return { ...meta, items };
}
export function memoryRows(rows, scope) {
    return rows.filter((row) => {
        const owner = "userId" in row ? row.userId : undefined;
        return typeof owner === "string"
            ? !scope.userId || owner === scope.userId
            : !scope.userId || scope.authId === "usr-demo-001";
    });
}
