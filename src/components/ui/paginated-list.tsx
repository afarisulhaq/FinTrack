"use client";

import type { ReactNode } from "react";
import { Pagination } from "~/components/ui/pagination";
import { usePagination } from "~/lib/use-pagination";

export function PaginatedList<T>({
  rows,
  children,
  label = "data",
  pageSize = 12,
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
