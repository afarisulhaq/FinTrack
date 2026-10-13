type RecordRow = { id: string };
type Listener = (resource: string, rows: RecordRow[], token: string) => void;
const pages = new Map<string, { resource: string; token: string; rows: RecordRow[] }>();
const listeners = new Set<Listener>();
export type ServerListInvalidation = readonly string[] | "all";

declare global {
  interface WindowEventMap {
    "fintrack:data-changed": CustomEvent<ServerListInvalidation>;
  }
}


function publish(resource: string, token: string) {
  const rows = new Map<string, RecordRow>();
  for (const page of pages.values()) if (page.resource === resource && page.token === token)
    for (const row of page.rows) rows.set(row.id, row);
  for (const listener of listeners) listener(resource, [...rows.values()], token);
}
export function setPageRecords(key: string, resource: string, rows: RecordRow[], token: string) {
  const previous = pages.get(key);
  pages.set(key, { resource, token, rows });
  publish(resource, token);
  if (previous && (previous.resource !== resource || previous.token !== token))
    publish(previous.resource, previous.token);
}
export function removePageRecords(key: string) {
  const previous = pages.get(key);
  if (!previous) return;
  pages.delete(key);
  publish(previous.resource, previous.token);
}
export function subscribePageRecords(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function invalidateServerLists(resources: ServerListInvalidation) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<ServerListInvalidation>("fintrack:data-changed", { detail: resources }));
}

export function subscribeServerListInvalidation(path: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const listener = (event: CustomEvent<ServerListInvalidation>) => {
    if (event.detail === "all" || event.detail.some((resource) => {
      const prefix = resource.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
      return pathname === prefix || pathname.startsWith(prefix === "/" ? "/" : `${prefix}/`);
    })) callback();
  };
  window.addEventListener("fintrack:data-changed", listener);
  return () => window.removeEventListener("fintrack:data-changed", listener);
}
