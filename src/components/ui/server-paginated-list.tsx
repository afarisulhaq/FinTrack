"use client";

import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { DEFAULT_PAGE_SIZE, type PageQuery } from "~/lib/pagination";

export function ServerListStatus({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <p role="status" className="text-text-secondary py-3 text-sm">Memuat daftar…</p>}{error && <div role="alert" className="text-danger py-3 text-sm"><p>{error}</p><Button type="button" variant="outline" className="mt-2 h-11" onClick={reload}>Coba lagi</Button></div>}</>;
}
export function ServerPaginatedList<T>({ path, query = {}, label = "data", pageSize = DEFAULT_PAGE_SIZE, resource, children }: {
  path: string; query?: PageQuery; label?: string; pageSize?: number; resource?: string;
  children: (items: T[]) => ReactNode;
}) {
  const pager = useServerPagination<T>(path, query, { pageSize, resource });
  return <><ServerListStatus {...pager} />{children(pager.items)}<Pagination {...pager} label={label} /></>;
}
