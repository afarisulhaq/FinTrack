import type { PageResult } from "../../src/lib/pagination.js";

export class PaginationError extends Error {
  readonly status = 400;
}
export interface PageInput { page: number; pageSize: number; }
export type ListQuery = Record<string, string | undefined>;
export interface ListScope { userId: string | null; authId: string; }
export type SerializeRecord = (resource: string, row: unknown) => Record<string, unknown>;

export function readPage(query: ListQuery): PageInput {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 12 : Number(query.pageSize);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 48)
    throw new PaginationError("Halaman harus positif dan ukuran halaman antara 1 dan 48");
  return { page, pageSize };
}
export function pageMeta(total: number, input: PageInput) {
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  return { total, totalPages, page: Math.min(input.page, totalPages), pageSize: input.pageSize };
}
export function pageArray<T, S = Record<string, unknown>>(rows: readonly T[], input: PageInput, summary?: S): PageResult<T, S> {
  const meta = pageMeta(rows.length, input);
  const start = (meta.page - 1) * meta.pageSize;
  return { ...meta, items: rows.slice(start, start + meta.pageSize), ...(summary === undefined ? {} : { summary }) };
}
export function ownership(scope: ListScope) {
  return scope.userId ? { userId: scope.userId } : {};
}
export async function databasePage<T>(input: PageInput, count: () => Promise<number>, read: (skip: number, take: number) => Promise<T[]>) {
  const meta = pageMeta(await count(), input);
  const items = await read((meta.page - 1) * meta.pageSize, meta.pageSize);
  return { ...meta, items };
}
export function memoryRows<T extends object>(rows: readonly T[], scope: ListScope): T[] {
  return rows.filter((row) => {
    const owner = "userId" in row ? row.userId : undefined;
    return typeof owner === "string"
      ? !scope.userId || owner === scope.userId
      : !scope.userId || scope.authId === "usr-demo-001";
  });
}
