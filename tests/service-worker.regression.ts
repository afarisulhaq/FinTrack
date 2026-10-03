import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const handlers = new Map<string, (event: any) => void>();
const deleted: string[] = [];
const cachedResponse = new Response("icon");
runInNewContext(
  readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
  {
    URL,
    self: {
      location: { origin: "https://fintrack.test" },
      addEventListener: (name: string, handler: (event: any) => void) =>
        handlers.set(name, handler),
      clients: { claim: () => {} },
    },
    caches: {
      keys: async () => ["fintrack-v2", "fintrack-v3"],
      delete: async (name: string) => {
        deleted.push(name);
      },
      match: async () => cachedResponse,
    },
    fetch: () => {
      throw new Error("Unexpected network request");
    },
  },
);
let activation: Promise<unknown>;
handlers.get("activate")!({
  waitUntil: (promise: Promise<unknown>) => {
    activation = promise;
  },
});
await activation!;
assert.deepEqual(deleted, ["fintrack-v2"]);
for (const [path, headers] of [
  ["/businesses?_rsc=test", {}],
  ["/wallets", { RSC: "1" }],
  ["/dashboard", {}],
  ["/api/wallets", {}],
  ["/_next/static/chunk.js", {}],
] as const) {
  let intercepted = false;
  handlers.get("fetch")!({
    request: new Request(`https://fintrack.test${path}`, { headers }),
    respondWith: () => {
      intercepted = true;
    },
  });
  assert.equal(intercepted, false, path);
}
let response: Promise<Response>;
handlers.get("fetch")!({
  request: new Request("https://fintrack.test/favicon.ico"),
  respondWith: (promise: Promise<Response>) => {
    response = promise;
  },
});
assert.equal(await response!, cachedResponse);
console.log(
  "PASS: route/RSC requests bypass cache, stale cache removed, favicon cached",
);
