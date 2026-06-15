import fs from "fs";
import path from "path";
import { node } from "@elysia/node";
// @elysiajs/cors is a CJS package whose real export is the named
// `cors` function (no default export). Under moduleResolution:
// "Bundler" the default-import form worked because TypeScript
// aliased it. NodeNext exposes the real shape, so we import the
// named function directly and call it.
import { cors as corsFn } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth.js";
import { financeRoutes, resourceRoutes } from "./routes/finance.js";
import { botRoutes } from "./routes/bot.js";
import { publicMarketRoutes } from "./routes/public-market.js";
import { publicSplitBillRoutes } from "./routes/public-split-bills.js";
import { startWhatsAppBot } from "./services/whatsapp.js";
import { ok } from "./utils.js";
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://169.254.83.107:3000",
];
void allowedOrigins;
const app = new Elysia({ adapter: node() })
    .use(corsFn({
    origin: true,
    credentials: true,
}))
    .onRequest(({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${new URL(request.url).pathname}`);
})
    .get("/api/health", () => ok({
    status: "ok",
    service: "fintrack-backend",
    time: new Date().toISOString(),
}))
    .use(authRoutes)
    .use(financeRoutes)
    .use(resourceRoutes)
    .use(botRoutes)
    .use(publicMarketRoutes)
    .use(publicSplitBillRoutes)
    .onError(({ code, set }) => {
    if (code === "NOT_FOUND") {
        set.status = 404;
        return { success: false, error: "Route tidak ditemukan" };
    }
})
    .listen({
    port,
    hostname: "0.0.0.0",
});
console.log(`FinTrack backend (Elysia) running on http://0.0.0.0:${port}`);
// Auto-start WhatsApp bot only when a saved session exists.
// Without this guard, a fresh server boot opens a QR flow before the user
// chooses QR vs pairing code, which can create stale QR/login timeouts.
const whatsappSessionDir = process.env.WHATSAPP_SESSION_DIR ?? "./.baileys-session";
const whatsappCredsFile = path.join(whatsappSessionDir, "creds.json");
if (fs.existsSync(whatsappCredsFile)) {
    startWhatsAppBot().catch((err) => {
        console.warn("[WhatsApp] Auto-start failed (session may need re-pairing):", err instanceof Error ? err.message : err);
    });
}
