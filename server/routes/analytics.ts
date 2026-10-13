import { Elysia } from "elysia";
import { requireAuth } from "../auth-middleware.js";
import { extractToken, verifyToken } from "../auth.js";
import { fail, ok } from "../utils.js";
import { AnalyticsError, getActivity, getAnalytics } from "../services/analytics.js";
import { DEFAULT_PAGE_SIZE } from "../../src/lib/pagination.js";

function scopeFor(request: Request) {
  const token = extractToken(request.headers.get("authorization") ?? undefined);
  const auth = token ? verifyToken(token) : null;
  if (!auth) throw new AnalyticsError("Unauthorized", 401);
  return { authId: auth.sub, userId: auth.role === "admin" ? null : auth.sub };
}
function summaryPage<T>(summary: T) {
  return { items: [], total: 0, totalPages: 1, page: 1, pageSize: DEFAULT_PAGE_SIZE, summary };
}
export const analyticsRoutes = new Elysia({ prefix: "/api/analytics" })
  .use(requireAuth)
  .get("/summary", async ({ request, query, set }) => {
    try { return ok(summaryPage(await getAnalytics(scopeFor(request), query.period ?? "6"))); }
    catch (error) { set.status = error instanceof AnalyticsError ? error.status : 500; return fail(error instanceof Error ? error.message : "Gagal memuat ringkasan"); }
  })
  .get("/activity", async ({ request, set }) => {
    try { return ok(summaryPage(await getActivity(scopeFor(request)))); }
    catch (error) { set.status = error instanceof AnalyticsError ? error.status : 500; return fail(error instanceof Error ? error.message : "Gagal memuat aktivitas"); }
  });
