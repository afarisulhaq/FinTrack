import { Elysia } from "elysia";
import { extractToken, verifyToken } from "./auth.js";
function authFromRequest(request) {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    return token ? verifyToken(token) : null;
}
export const requireAuth = new Elysia({ name: "require-auth" }).onBeforeHandle({ as: "scoped" }, ({ request, set }) => {
    if (!authFromRequest(request)) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
    }
});
export const requireAdmin = new Elysia({
    name: "require-admin",
}).onBeforeHandle({ as: "scoped" }, ({ request, set }) => {
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
