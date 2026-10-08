import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import {
  randomBytes,
  randomUUID,
  createHash,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { dynamicQris } from "./qris.mjs";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error("Password minimal 12 karakter");
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password, stored) {
  if (typeof password !== "string" || password.length > 256 || !stored)
    return false;
  const [salt, digest] = stored.split(":");
  const expected = Buffer.from(digest, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class Store {
  constructor(directory) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const keyFile = join(this.directory, "encryption.key");
    if (!existsSync(keyFile))
      writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: "wx" });
    this.key = readFileSync(keyFile);
    if (this.key.length !== 32)
      throw new Error("Kunci penyimpanan sesi tidak valid");
    this.db = new DatabaseSync(join(this.directory, "gateway.sqlite"));
    chmodSync(join(this.directory, "gateway.sqlite"), 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created INTEGER NOT NULL, revoked INTEGER);
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, idempotency TEXT, reference TEXT NOT NULL,
        description TEXT NOT NULL, base_amount INTEGER NOT NULL, amount INTEGER NOT NULL UNIQUE,
        qris TEXT NOT NULL, merchant TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        created INTEGER NOT NULL, expires INTEGER NOT NULL, checked INTEGER,
        transaction_id TEXT UNIQUE, paid_at INTEGER, UNIQUE(client_id, idempotency));
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, status TEXT NOT NULL, time INTEGER NOT NULL, issuer TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, detail TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  }
  get(key) {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key);
    return row ? JSON.parse(row.value) : null;
  }
  set(key, value) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  encrypt(value) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64");
  }
  decrypt(value) {
    const raw = Buffer.from(value, "base64"),
      decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  }
  secret(key) {
    const value = this.get(key);
    return value ? this.decrypt(value) : null;
  }
  setSecret(key, value) {
    this.set(key, this.encrypt(value));
  }
  log(event, detail = "") {
    this.db
      .prepare("INSERT INTO audit(event,detail,time) VALUES (?,?,?)")
      .run(event, detail, Date.now());
  }
  limit(key, maximum, windowMs) {
    const now = Date.now(),
      row = this.db.prepare("SELECT * FROM rate_limits WHERE key=?").get(key);
    if (row && row.expires > now && row.count >= maximum) return false;
    this.db
      .prepare(
        "INSERT INTO rate_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires",
      )
      .run(
        key,
        row && row.expires > now ? row.count + 1 : 1,
        row && row.expires > now ? row.expires : now + windowMs,
      );
    return true;
  }
  apiKey(name) {
    const value = "qris_" + randomBytes(32).toString("hex"),
      id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO api_keys(id,name,hash,prefix,created) VALUES (?,?,?,?,?)",
      )
      .run(id, name, hash(value), value.slice(0, 13), Date.now());
    this.log("api_key_created", name);
    return { id, key: value };
  }
  reserve({
    clientId,
    idempotency = null,
    reference,
    description,
    amount,
    exact = false,
  }) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000)
      throw new Error("Nominal harus rupiah bulat, antara 1 dan 100.000.000");
    if (!this.get("dedicated"))
      throw new Error("Merchant khusus gateway belum dikonfirmasi");
    const merchant = this.get("merchant"),
      template = this.secret("qris");
    if (!merchant || !template)
      throw new Error("Atur merchant dan QRIS statis terlebih dahulu");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (idempotency) {
        const old = this.db
          .prepare("SELECT * FROM invoices WHERE client_id=? AND idempotency=?")
          .get(clientId, idempotency);
        if (old) {
          if (
            old.base_amount !== amount ||
            old.reference !== reference ||
            old.description !== description ||
            (exact ? old.amount !== amount : old.amount === amount)
          )
            throw new Error(
              "Idempotency key sudah dipakai untuk invoice berbeda",
            );
          this.db.exec("COMMIT");
          return old;
        }
      }
      const used = new Set(
        this.db
          .prepare("SELECT amount FROM invoices WHERE amount>? AND amount<=?")
          .all(amount, amount + 999)
          .map((r) => r.amount),
      );
      let total = exact ? amount : amount + 1;
      if (
        exact &&
        this.db.prepare("SELECT id FROM invoices WHERE amount=?").get(total)
      )
        throw new Error(
          "Nominal sudah pernah digunakan; gunakan nominal invoice baru",
        );
      if (!exact) while (used.has(total)) total++;
      if (total > amount + 999)
        throw new Error(
          "Nominal unik habis. Invoice baru ditutup untuk menghindari salah pencocokan",
        );
      const now = Date.now(),
        id = randomUUID();
      const qris = dynamicQris(template, total);
      this.db
        .prepare(
          "INSERT INTO invoices(id,client_id,idempotency,reference,description,base_amount,amount,qris,merchant,created,expires) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          clientId,
          idempotency,
          reference,
          description,
          amount,
          total,
          qris,
          merchant,
          now,
          now + 300_000,
        );
      this.log("invoice_created", id);
      this.db.exec("COMMIT");
      return this.db.prepare("SELECT * FROM invoices WHERE id=?").get(id);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  publicInvoice(row, publicUrl) {
    return {
      id: row.id,
      qris_id: row.id,
      trx_id: row.id,
      reference: row.reference,
      description: row.description,
      base_amount: row.base_amount,
      unique_amount: row.amount - row.base_amount,
      amount: row.amount,
      status:
        row.status === "pending" && row.expires < Date.now()
          ? "expired"
          : row.status,
      created_at: new Date(row.created).toISOString(),
      expires_at: new Date(row.expires).toISOString(),
      paid_at: row.paid_at ? new Date(row.paid_at).toISOString() : null,
      qris_code:
        row.status === "pending" && row.expires >= Date.now() ? row.qris : null,
      qris_url: `${publicUrl}/pay/${row.id}`,
      transaction_id: row.transaction_id,
    };
  }
  settle(id, rows) {
    const invoice = this.db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(id);
    if (!invoice) throw new Error("Invoice tidak ditemukan");
    if (invoice.status === "paid") return invoice;
    const matches = rows.filter(
      (row) =>
        row.amount === invoice.amount &&
        ["settlement", "capture"].includes(row.status.toLowerCase()) &&
        row.time >= invoice.created &&
        row.time <= invoice.expires &&
        row.time <= Date.now(),
    );
    if (matches.length > 1 || rows.length >= 100)
      throw new Error(
        "Mutasi ambigu atau terlalu banyak; perlu ditinjau manual",
      );
    const payment = matches[0];
    if (!payment) return invoice;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db
        .prepare("SELECT * FROM invoices WHERE id=?")
        .get(id);
      if (current.status === "paid") {
        this.db.exec("COMMIT");
        return current;
      }
      const claimed = this.db
        .prepare("SELECT id FROM invoices WHERE transaction_id=?")
        .get(payment.id);
      if (claimed) throw new Error("Transaksi sudah dipakai invoice lain");
      this.db
        .prepare(
          "UPDATE invoices SET status='paid',transaction_id=?,paid_at=? WHERE id=?",
        )
        .run(payment.id, payment.time, id);
      this.log("invoice_paid", id);
      this.db.exec("COMMIT");
      return this.db.prepare("SELECT * FROM invoices WHERE id=?").get(id);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
