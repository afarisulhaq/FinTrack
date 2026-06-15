import { Elysia } from "elysia";
import { extractToken, verifyToken } from "./auth";

function authFromRequest(request: Request) {
  const token = extractToken(request.headers.get("authorization") ?? undefined);
  return token ? verifyToken(token) : null;
}

export const requireAuth = new Elysia({ name: "require-auth" }).onBeforeHandle(
  ({ request, set }) => {
    if (!authFromRequest(request)) {
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }
  },
);

export const requireAdmin = new Elysia({
  name: "require-admin",
}).onBeforeHandle(({ request, set }) => {
  const auth = authFromRequest(request);
  if (!auth) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }
  if (auth.role !== "admin") {
    set.status = 403;
    return { success: false, error: "Admin only" };
  }
});
