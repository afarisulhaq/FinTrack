"use client";

import { useState } from "react";
import { DEFAULT_PAGE_SIZE } from "~/lib/pagination";

export function usePagination<T>(
  rows: readonly T[],
  {
    pageSize: initialSize = DEFAULT_PAGE_SIZE,
    resetKey = "",
  }: { pageSize?: number; resetKey?: string } = {},
) {
  const [state, setState] = useState({
    page: 1,
    pageSize: initialSize,
    resetKey,
  });
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const page =
    state.resetKey !== resetKey ? 1 : Math.min(state.page, totalPages);
  if (state.resetKey !== resetKey || state.page !== page) {
    setState({ ...state, resetKey, page });
  }
  const start = (page - 1) * state.pageSize;
  return {
    items: rows.slice(start, start + state.pageSize),
    page,
    pageSize: state.pageSize,
    total,
    totalPages,
    onPageChange: (next: number) =>
      setState((current) => ({
        ...current,
        page: Math.max(1, Math.min(next, totalPages)),
      })),
    onPageSizeChange: (pageSize: number) =>
      setState((current) => ({
        ...current,
        page: 1,
        pageSize,
      })),
  };
}
