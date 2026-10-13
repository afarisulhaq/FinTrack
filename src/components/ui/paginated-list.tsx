"use client";

import type { ReactNode } from "react";
import { Pagination } from "~/components/ui/pagination";
import { usePagination } from "~/lib/use-pagination";
import { DEFAULT_PAGE_SIZE } from "~/lib/pagination";

export function PaginatedList<T>({
  rows,
  children,
  label = "data",
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = "",
}: {
  rows: readonly T[];
  children: (items: T[]) => ReactNode;
  label?: string;
  pageSize?: number;
  resetKey?: string;
}) {
  const pager = usePagination(rows, { pageSize, resetKey });
  return (
    <>
      {children(pager.items)}
      <Pagination {...pager} label={label} />
    </>
  );
}
