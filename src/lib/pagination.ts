export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 200;
export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

export interface PageResult<T, S = Record<string, unknown>> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: S;
}

export type PageQuery = Record<string, string | number | boolean | null | undefined>;
