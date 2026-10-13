"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getApiBaseUrl } from "~/lib/api";
import { useAuthStore } from "~/store/useAuthStore";
import { DEFAULT_PAGE_SIZE, type PageQuery, type PageResult } from "~/lib/pagination";
import { removePageRecords, setPageRecords } from "~/lib/page-records";
import { z } from "zod";
import { parsePage } from "~/lib/page-schema";

function hasRecordIds<T>(rows: T[]): rows is (T & { id: string })[] {
  return rows.every((row) => row !== null && typeof row === "object" && "id" in row && typeof row.id === "string");
}

const empty: never[] = [];
export function useServerPagination<T, S = Record<string, unknown>>(
  path: string | null,
  query: PageQuery = {},
  { pageSize: initialSize = DEFAULT_PAGE_SIZE, resource, enabled = true }: { pageSize?: number; resource?: string; enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.token);
  const id = useId();
  const params = new URLSearchParams();
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const scope = `${token ?? ""}|${path ?? ""}|${params}`;
  const [state, setState] = useState({ scope, page: 1, pageSize: initialSize });
  const page = scope === state.scope ? state.page : 1;
  if (state.scope !== scope) setState({ ...state, scope, page: 1 });
  const [revision, setRevision] = useState(0);
  params.set("page", String(page));
  params.set("pageSize", String(state.pageSize));
  const url = path ? `${path}${path.includes("?") ? "&" : "?"}${params}` : "";
  const key = `${token}|${url}|${revision}`;
  const [result, setResult] = useState<{ key: string; address: string; scope: string; data: PageResult<T, S> } | null>(null);
  const current = useRef(result);
  const [status, setStatus] = useState({ key: "", loading: false, error: "" });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    window.addEventListener("fintrack:data-changed", reload);
    return () => window.removeEventListener("fintrack:data-changed", reload);
  }, [reload]);
  useEffect(() => {
    if (!token || !path || !enabled || current.current?.key === key) return;
    const controller = new AbortController();
    setStatus({ key, loading: true, error: "" });
    void fetch(`${getApiBaseUrl()}${url}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).then(async (response) => {
      const json = z.object({ success: z.boolean(), data: z.unknown().optional(), error: z.string().optional() }).parse(await response.json());
      if (!response.ok || !json.success) throw new Error(json.error ?? "Daftar gagal dimuat");
      if (controller.signal.aborted) return;
      const data = parsePage<T, S>(json.data, url);
      const target = new URL(url, window.location.origin);
      target.searchParams.set("page", String(data.page));
      const canonicalUrl = `${target.pathname}${target.search}`;
      const address = `${token}|${canonicalUrl}`;
      const next = { key: `${address}|${revision}`, address, scope, data };
      current.current = next;
      setResult(next);
      setState((previous) => ({ ...previous, page: data.page }));
      setStatus({ key: next.key, loading: false, error: "" });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setStatus({ key, loading: false, error: cause instanceof Error ? cause.message : "Daftar gagal dimuat" });
    });
    return () => controller.abort();
  }, [token, path, url, key, revision, enabled, scope]);
  const data = result?.address === `${token}|${url}` ? result.data : null;
  const context = result?.scope === scope ? result.data : null;
  const items = data?.items ?? empty;
  useEffect(() => {
    if (!resource || !token || !enabled) return;
    if (hasRecordIds(items)) setPageRecords(id, resource, items, token);
    return () => removePageRecords(id);
  }, [id, resource, items, token, enabled]);
  return {
    items,
    summary: context?.summary,
    total: context?.total ?? 0,
    totalPages: context ? Math.max(1, Math.ceil(context.total / state.pageSize)) : 1,
    page: data?.page ?? page,
    pageSize: state.pageSize,
    loading: enabled && !!path && !!token && (status.key !== key || status.loading),
    error: status.key === key ? status.error : "",
    initialized: data !== null,
    reload,
    onPageChange: (next: number) => setState((previous) => ({ ...previous, page: Math.max(1, next) })),
    onPageSizeChange: (pageSize: number) => setState((previous) => ({ ...previous, page: 1, pageSize })),
  };
}
