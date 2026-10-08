import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { Store, hash, passwordMatches } from "./store.mjs";
import { Provider } from "./provider.mjs";
import { parseQris } from "./qris.mjs";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/checkout.js", ["checkout.js", "text/javascript; charset=utf-8"]],
]);

export function createGateway({
  directory = process.env.DATA_DIR ?? "./data",
  publicUrl = process.env.PUBLIC_URL ?? "http://127.0.0.1:3010",
  secure = process.env.SECURE_COOKIES === "true",
  providerFactory = (store) => new Provider(store),
} = {}) {
  const base = new URL(publicUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw new Error("PUBLIC_URL harus origin HTTP(S) tanpa path");
  if (base.protocol === "https:" && !secure)
    throw new Error("PUBLIC_URL HTTPS membutuhkan SECURE_COOKIES=true");
  if (
    base.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  )
    throw new Error("Dashboard publik harus HTTPS");
  const origin = base.origin,
    store = new Store(directory),
    provider = providerFactory(store);
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    );
    res.setHeader("Cache-Control", "no-store");
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    };
    const ok = (data) => send(200, { success: true, data });
    try {
      const path = new URL(req.url, origin).pathname,
        method = req.method;
      if (
        method === "GET" &&
        (staticFiles.has(path) || /^\/pay\/[0-9a-f-]{36}$/.test(path))
      ) {
        const [file, type] = staticFiles.get(path) ?? [
          "checkout.html",
          "text/html; charset=utf-8",
        ];
        res.writeHead(200, { "Content-Type": type });
        res.end(readFileSync(new URL("../public/" + file, import.meta.url)));
        return;
      }
      if (method === "GET" && path === "/health") {
        ok({ status: "ok", service: "qris-gateway" });
        return;
      }
      if (method === "GET" && /^\/qris\/[0-9a-f-]{36}\.svg$/.test(path)) {
        const invoice = store.db
          .prepare("SELECT * FROM invoices WHERE id=?")
          .get(path.split("/")[2].slice(0, -4));
        if (
          !invoice ||
          invoice.expires < Date.now() ||
          invoice.status !== "pending"
        )
          throw new HttpError(
            410,
            "QRIS tidak tersedia atau sudah kedaluwarsa",
          );
        const svg = await QRCode.toString(invoice.qris, {
          type: "svg",
          margin: 4,
          errorCorrectionLevel: "M",
        });
        res.writeHead(200, { "Content-Type": "image/svg+xml" });
        res.end(svg);
        return;
      }
      const csrfRequired = path.startsWith("/dashboard/") && method !== "GET";
      if (csrfRequired && req.headers.origin !== origin)
        throw new HttpError(403, "Origin tidak diizinkan");
      async function body() {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new HttpError(415, "Gunakan JSON");
        let buffer = "";
        for await (const chunk of req) {
          buffer += chunk;
          if (Buffer.byteLength(buffer) > 8192)
            throw new HttpError(413, "Permintaan terlalu besar");
        }
        try {
          const value = JSON.parse(buffer);
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
          return value;
        } catch {
          throw new HttpError(400, "JSON tidak valid");
        }
      }
      const token = req.headers.cookie
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("qris_session="))
        ?.slice(13);
      const session = token
        ? store.db
            .prepare("SELECT * FROM sessions WHERE hash=? AND expires>?")
            .get(hash(token), Date.now())
        : null;
      if (path === "/dashboard/login" && method === "POST") {
        if (!store.get("admin_password"))
          throw new HttpError(
            503,
            "Jalankan npm run setup di server terlebih dahulu",
          );
        if (!store.limit("login:" + req.socket.remoteAddress, 10, 900_000))
          throw new HttpError(
            429,
            "Terlalu banyak percobaan login. Tunggu 15 menit",
          );
        const input = await body();
        if (
          input.username !== store.get("admin_username") ||
          !passwordMatches(input.password, store.get("admin_password"))
        )
          throw new HttpError(401, "Nama login atau password salah");
        const secret = randomBytes(32).toString("hex"),
          csrf = randomBytes(24).toString("hex");
        store.db
          .prepare("DELETE FROM sessions WHERE expires<?")
          .run(Date.now());
        if (session)
          store.db
            .prepare("DELETE FROM sessions WHERE hash=?")
            .run(session.hash);
        store.db
          .prepare("INSERT INTO sessions VALUES (?,?,?)")
          .run(hash(secret), csrf, Date.now() + 28_800_000);
        res.setHeader(
          "Set-Cookie",
          `qris_session=${secret}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? "; Secure" : ""}`,
        );
        store.log("dashboard_login");
        ok({ csrf });
        return;
      }
      const dashboard = path.startsWith("/dashboard/");
      let clientId = "dashboard";
      if (dashboard) {
        if (!session)
          throw new HttpError(401, "Masuk ke dashboard terlebih dahulu");
        if (csrfRequired && req.headers["x-csrf-token"] !== session.csrf)
          throw new HttpError(
            403,
            "Sesi formulir tidak valid. Muat ulang dashboard",
          );
      } else if (!path.startsWith("/public/")) {
        const key = req.headers["x-api-key"];
        const client =
          typeof key === "string"
            ? store.db
                .prepare(
                  "SELECT * FROM api_keys WHERE hash=? AND revoked IS NULL",
                )
                .get(hash(key))
            : null;
        if (!client) throw new HttpError(401, "API key tidak valid");
        clientId = client.id;
        const merchantHeader = req.headers["x-gopay-merchant-id"];
        if (merchantHeader && merchantHeader !== store.get("merchant"))
          throw new HttpError(403, "Merchant berbeda dari gateway");
      }
      const serialize = (row) => store.publicInvoice(row, origin);
      const ownedInvoice = (id) => {
        const row = store.db
          .prepare("SELECT * FROM invoices WHERE id=?")
          .get(id);
        if (
          !row ||
          (!dashboard &&
            !path.startsWith("/public/") &&
            row.client_id !== clientId)
        )
          throw new HttpError(404, "Invoice tidak ditemukan");
        return row;
      };
      if (dashboard && path === "/dashboard/session" && method === "GET") {
        ok({ csrf: session.csrf, username: store.get("admin_username") });
        return;
      }
      if (path === "/dashboard/logout" && method === "POST") {
        store.db.prepare("DELETE FROM sessions WHERE hash=?").run(session.hash);
        res.setHeader(
          "Set-Cookie",
          `qris_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`,
        );
        ok({});
        return;
      }
      if (path === "/dashboard/overview" && method === "GET") {
        const stats = store.db
          .prepare(
            "SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) as received, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid, SUM(CASE WHEN status='pending' AND expires>? THEN 1 ELSE 0 END) as pending FROM invoices",
          )
          .get(Date.now());
        ok({
          stats,
          merchant: provider.status(),
          invoices: store.db
            .prepare("SELECT * FROM invoices ORDER BY created DESC LIMIT 100")
            .all()
            .map(serialize),
          transactions: store.db
            .prepare("SELECT * FROM transactions ORDER BY time DESC LIMIT 100")
            .all(),
          logs: store.db
            .prepare(
              "SELECT event,detail,time FROM audit ORDER BY id DESC LIMIT 20",
            )
            .all(),
        });
        return;
      }
      if (path === "/dashboard/settings" && method === "POST") {
        const input = await body();
        if (
          typeof input.merchant !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(input.merchant)
        )
          throw new HttpError(400, "Merchant ID tidak valid");
        if (input.dedicated !== true)
          throw new HttpError(
            400,
            "Konfirmasi merchant khusus gateway diperlukan",
          );
        const current = store.get("merchant");
        if (
          current &&
          current !== input.merchant &&
          store.db.prepare("SELECT id FROM invoices LIMIT 1").get()
        )
          throw new HttpError(
            409,
            "Merchant tidak dapat diganti setelah ada invoice. Gunakan instance gateway baru",
          );
        let qr = null;
        if (input.qris) {
          qr = String(input.qris).trim();
          parseQris(qr);
        }
        if (!qr && !store.secret("qris"))
          throw new HttpError(400, "Masukkan QRIS statis merchant");
        if (qr) store.setSecret("qris", qr);
        store.set("merchant", input.merchant);
        store.set("dedicated", true);
        store.log("merchant_settings_updated");
        ok(provider.status());
        return;
      }
      if (path === "/dashboard/otp/request" && method === "POST") {
        if (!store.limit("otp_request", 1, 60_000))
          throw new HttpError(
            429,
            "Tunggu satu menit sebelum meminta OTP lagi",
          );
        const input = await body();
        if (typeof input.phone !== "string")
          throw new HttpError(400, "Nomor HP wajib diisi");
        ok(await provider.requestOtp(input.phone));
        return;
      }
      if (path === "/dashboard/otp/verify" && method === "POST") {
        if (!store.limit("otp_verify", 5, 720_000))
          throw new HttpError(
            429,
            "Terlalu banyak percobaan OTP. Tunggu sebelum mencoba lagi",
          );
        const input = await body();
        if (typeof input.code !== "string")
          throw new HttpError(400, "OTP wajib diisi");
        ok(await provider.verifyOtp(input.code));
        return;
      }
      if (path === "/dashboard/merchant/disconnect" && method === "POST") {
        store.set("merchant_session", null);
        store.set("otp", null);
        store.log("merchant_disconnected");
        ok(provider.status());
        return;
      }
      if (path === "/dashboard/keys" && method === "GET") {
        ok(
          store.db
            .prepare(
              "SELECT id,name,prefix,created,revoked FROM api_keys ORDER BY created DESC",
            )
            .all(),
        );
        return;
      }
      if (path === "/dashboard/keys" && method === "POST") {
        const input = await body();
        if (
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 80
        )
          throw new HttpError(
            400,
            "Nama API key wajib diisi, maksimal 80 karakter",
          );
        ok(store.apiKey(input.name.trim()));
        return;
      }
      if (
        /^\/dashboard\/keys\/[0-9a-f-]{36}\/revoke$/.test(path) &&
        method === "POST"
      ) {
        store.db
          .prepare("UPDATE api_keys SET revoked=? WHERE id=?")
          .run(Date.now(), path.split("/")[3]);
        store.log("api_key_revoked", path.split("/")[3]);
        ok({});
        return;
      }
      if (
        (path === "/dashboard/invoices" ||
          path === "/v1/invoices" ||
          path === "/create-qris") &&
        method === "POST"
      ) {
        if (!provider.status().connected)
          throw new HttpError(
            409,
            "Hubungkan akun merchant sebelum membuat invoice",
          );
        if (!store.limit("create:" + clientId, 60, 3_600_000))
          throw new HttpError(
            429,
            "Batas pembuatan invoice tercapai. Coba lagi nanti",
          );
        const input = await body();
        const reference =
          typeof input.reference === "string" ? input.reference.trim() : "";
        const description =
          typeof input.description === "string" ? input.description.trim() : "";
        if (reference.length > 120 || description.length > 300)
          throw new HttpError(400, "Referensi atau deskripsi terlalu panjang");
        const idempotency = req.headers["idempotency-key"];
        if (idempotency && !/^[\x21-\x7e]{1,120}$/.test(idempotency))
          throw new HttpError(400, "Idempotency key tidak valid");
        const invoice = store.reserve({
          clientId,
          idempotency: idempotency ?? null,
          reference,
          description,
          amount: input.amount,
          exact: path === "/create-qris",
        });
        ok(serialize(invoice));
        return;
      }
      if (path === "/v1/invoices" && method === "GET") {
        ok(
          store.db
            .prepare(
              "SELECT * FROM invoices WHERE client_id=? ORDER BY created DESC LIMIT 100",
            )
            .all(clientId)
            .map(serialize),
        );
        return;
      }
      if (
        /^\/(v1|public)\/invoices\/[0-9a-f-]{36}$/.test(path) &&
        method === "GET"
      ) {
        ok(serialize(ownedInvoice(path.split("/")[3])));
        return;
      }
      if (
        /^\/(dashboard|v1|public)\/invoices\/[0-9a-f-]{36}\/check$/.test(
          path,
        ) &&
        method === "POST"
      ) {
        const invoice = ownedInvoice(path.split("/")[3]);
        if (
          invoice.status !== "paid" &&
          !store.limit("merchant_check", 10, 60_000)
        )
          throw new HttpError(
            429,
            "Batas pemeriksaan merchant tercapai. Tunggu satu menit",
          );
        ok(serialize(await provider.check(invoice)));
        return;
      }
      if (
        (path === "/dashboard/transactions/sync" && method === "POST") ||
        (path === "/transactions" && method === "GET")
      ) {
        if (!store.limit("merchant_check", 10, 60_000))
          throw new HttpError(
            429,
            "Batas pemeriksaan merchant tercapai. Tunggu satu menit",
          );
        const query = new URL(req.url, origin).searchParams;
        const start = query.has("startTime")
          ? Number(query.get("startTime")) * 1000
          : Date.now() - 86_400_000;
        const end = query.has("endTime")
          ? Number(query.get("endTime")) * 1000
          : Date.now();
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start > end ||
          end - start > 7 * 86_400_000 ||
          start < 0
        )
          throw new HttpError(400, "Rentang mutasi maksimal tujuh hari");
        const rows = await provider.transactions(start, end);
        ok({
          transactions: rows.map((row) => ({
            transaction_id: row.id,
            amount: row.amount,
            status: row.status,
            time: new Date(row.time).toISOString(),
            issuer: row.issuer,
          })),
        });
        return;
      }
      throw new HttpError(404, "Endpoint tidak ditemukan");
    } catch (error) {
      const internal =
        /SQLITE|UNIQUE constraint|no such table|database|constraint failed|cipher|authenticate data/i.test(
          error.message,
        );
      send(internal ? 503 : (error.status ?? 400), {
        success: false,
        error: internal
          ? "Penyimpanan gateway belum tersedia. Periksa layanan server"
          : error.message,
      });
    }
  });
  return { server, store, provider };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const gateway = createGateway();
  gateway.server.listen(
    Number(process.env.PORT ?? 3010),
    process.env.HOST ?? "127.0.0.1",
    () =>
      console.log(
        "QRIS Gateway: " + (process.env.PUBLIC_URL ?? "http://127.0.0.1:3010"),
      ),
  );
  const stop = () =>
    gateway.server.close(() => {
      gateway.store.close();
      process.exit(0);
    });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
