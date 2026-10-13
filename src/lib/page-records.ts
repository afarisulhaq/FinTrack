type RecordRow = { id: string };
type Listener = (resource: string, rows: RecordRow[], token: string) => void;
const pages = new Map<string, { resource: string; token: string; rows: RecordRow[] }>();
const listeners = new Set<Listener>();
function publish(resource: string, token: string) {
  const rows = new Map<string, RecordRow>();
  for (const page of pages.values()) if (page.resource === resource && page.token === token)
    for (const row of page.rows) rows.set(row.id, row);
  for (const listener of listeners) listener(resource, [...rows.values()], token);
}
export function setPageRecords(key: string, resource: string, rows: RecordRow[], token: string) {
  pages.set(key, { resource, token, rows });
  publish(resource, token);
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
export function invalidateServerLists() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("fintrack:data-changed"));
}
