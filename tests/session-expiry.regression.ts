import assert from "node:assert/strict";

const storage = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
Object.assign(globalThis, { localStorage });
Object.defineProperty(globalThis, "window", {
  value: { localStorage, location: { origin: "http://localhost" } },
  configurable: true,
});
const { useAuthStore } = await import("../src/store/useAuthStore");
const { api } = await import("../src/lib/api");
const { useFinanceStore } = await import("../src/store/useFinanceStore");
const originalFetch = globalThis.fetch;
const login = (token = "expired-token") => useAuthStore.setState({
  token, isAuthenticated: true, hasHydrated: true,
});
try {
  login();
  globalThis.fetch = async () => Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  assert.equal(await useFinanceStore.getState().refreshAll({ silent: true }), false);
  assert.equal(useAuthStore.getState().isAuthenticated, false, "bootstrap 401 must end the stale session");
  assert.equal(useAuthStore.getState().token, null);
  assert.equal(JSON.parse(storage.get("fintrack_auth")!).state.token, null);
  assert.equal(useFinanceStore.getState().syncError, null, "expired session must not become a sync error");

  for (const status of [403, 503]) {
    login();
    globalThis.fetch = async () => Response.json({ success: false, error: "Unavailable" }, { status });
    await assert.rejects(api.bootstrap("expired-token"));
    assert.equal(useAuthStore.getState().isAuthenticated, true, `${status} must preserve the session`);
  }
  login();
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(api.bootstrap("expired-token"));
  assert.equal(useAuthStore.getState().isAuthenticated, true);

  login();
  globalThis.fetch = async () => {
    login("new-token");
    return new Response("Unauthorized", { status: 401 });
  };
  await assert.rejects(api.bootstrap("expired-token"));
  assert.equal(useAuthStore.getState().token, "new-token", "old request must not log out a new session");

  globalThis.fetch = async () => Response.json({ success: false }, { status: 401 });
  await assert.rejects(api.login("user@example.com", "wrong-password"));
  assert.equal(useAuthStore.getState().token, "new-token", "unauthenticated login failure must not clear a session");
  console.log("PASS: expired session logout, persisted cleanup, transient errors, stale responses, login failure");
} finally {
  globalThis.fetch = originalFetch;
}
