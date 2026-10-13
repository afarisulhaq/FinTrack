export interface PageResult<T, S = Record<string, unknown>> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: S;
}

export type PageQuery = Record<string, string | number | boolean | null | undefined>;
