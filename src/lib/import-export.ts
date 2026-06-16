/**
 * Helpers for the Data & Ekspor tab in /settings.
 *
 * Everything runs client-side: the data is already in the
 * `useFinanceStore` (synced with the backend), so we just convert
 * it to CSV/JSON/HTML-for-PDF and trigger a browser download.
 * Imports go the other way — parse the file, validate, then write
 * back into the store (which in turn POSTs to the backend).
 *
 * No external library is used for CSV (a tiny hand-rolled parser
 * handles the quoted-comma / escaped-quote cases the format
 * actually requires); PDF is just an HTML page that calls
 * `window.print()`, which lets the browser's native "Save as PDF"
 * handle the rendering. This keeps the bundle slim and avoids
 * pulling in 100kB+ of jsPDF.
 */

import type {
  Transaction,
  Wallet,
  Category,
  SubCategory,
  Budget,
  Bill,
  SavingGoal,
  Debt,
  Investment,
  RecurringTransaction,
  Note,
  WishlistItem,
  Card,
  Reimbursement,
} from "./types";

export const EXPORT_FORMAT_VERSION = 1;

export const TRANSACTION_CSV_HEADERS = [
  "id",
  "date",
  "type",
  "amount",
  "category",
  "description",
  "wallet",
  "tags",
] as const;

export const WALLET_CSV_HEADERS = [
  "id",
  "name",
  "type",
  "balance",
  "currency",
] as const;

// ── Browser download ──────────────────────────────────────────────────────

export function downloadBlob(
  content: BlobPart,
  filename: string,
  mime: string,
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari actually fires the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestampedFilename(prefix: string, ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}` +
    `${pad(d.getMonth() + 1)}` +
    `${pad(d.getDate())}` +
    `-${pad(d.getHours())}` +
    `${pad(d.getMinutes())}`;
  return `${prefix}-${stamp}.${ext}`;
}

// ── CSV ───────────────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell. RFC 4180: wrap in double quotes if it
 * contains a comma, a quote, or a newline, and double-up any
 * embedded quotes. null/undefined become empty strings.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCSV(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  // Excel refuses to open a CSV that doesn't start with BOM when
  // the file uses non-ASCII (e.g. "Makanan"). Add the BOM.
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/**
 * Minimal RFC 4180 parser. Returns string[][] — first row is
 * expected to be headers. Handles quoted fields, escaped quotes,
 * and CRLF / LF line endings.
 */
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 2;
      else i += 1;
    } else {
      cell += ch;
      i += 1;
    }
  }

  // Flush the last cell/row (no trailing newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function indexHeaders(
  headers: readonly string[],
  row: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 1) {
    out[headers[i]] = (row[i] ?? "").trim();
  }
  return out;
}

function parseAmount(raw: string): number {
  // Indonesian users often paste "50.000" with dots as thousands
  // separators. Accept commas as decimal too.
  const cleaned = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ── Transactions → CSV ────────────────────────────────────────────────────

export function transactionsToCSV(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  options: { month?: string } = {},
): string {
  const walletById = new Map(wallets.map((w) => [w.id, w]));
  const walletNameById = new Map(wallets.map((w) => [w.id, w.name]));

  const filtered = options.month
    ? transactions.filter((t) => t.date.startsWith(options.month!))
    : transactions;

  const rows: string[][] = [
    [...TRANSACTION_CSV_HEADERS],
    ...filtered.map((t) => [
      t.id,
      t.date,
      t.type,
      String(t.amount),
      t.category,
      t.description ?? "",
      walletNameById.get(t.walletId) ?? t.walletId,
      (t.tags ?? []).join("; "),
    ]),
  ];

  return rowsToCSV(rows);
}

export function downloadTransactionsCSV(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  options: { month?: string } = {},
) {
  const csv = transactionsToCSV(transactions, wallets, options);
  const name = options.month
    ? `transaksi-${options.month}.csv`
    : timestampedFilename("transaksi", "csv");
  downloadBlob(csv, name, "text/csv;charset=utf-8");
}

// ── All data → JSON ───────────────────────────────────────────────────────

export interface BackupBundle {
  version: number;
  exportedAt: string;
  appName?: string;
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  bills: Bill[];
  savingGoals: SavingGoal[];
  debts: Debt[];
  cards: Card[];
  wishlist: WishlistItem[];
  reimbursements: Reimbursement[];
  notes: Note[];
  recurringTransactions: RecurringTransaction[];
  categories: Category[];
  subCategories: SubCategory[];
}

export interface BackupSnapshot {
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  bills: Bill[];
  savingGoals: SavingGoal[];
  debts: Debt[];
  cards: Card[];
  wishlist: WishlistItem[];
  reimbursements: Reimbursement[];
  notes: Note[];
  recurringTransactions: RecurringTransaction[];
  categories: Category[];
  subCategories: SubCategory[];
  appName?: string;
}

export function backupToJSON(snapshot: BackupSnapshot): string {
  const bundle: BackupBundle = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: snapshot.appName,
    wallets: snapshot.wallets,
    transactions: snapshot.transactions,
    budgets: snapshot.budgets,
    investments: snapshot.investments,
    bills: snapshot.bills,
    savingGoals: snapshot.savingGoals,
    debts: snapshot.debts,
    cards: snapshot.cards,
    wishlist: snapshot.wishlist,
    reimbursements: snapshot.reimbursements,
    notes: snapshot.notes,
    recurringTransactions: snapshot.recurringTransactions,
    categories: snapshot.categories,
    subCategories: snapshot.subCategories,
  };
  return JSON.stringify(bundle, null, 2);
}

export function downloadFullBackup(snapshot: BackupSnapshot) {
  const json = backupToJSON(snapshot);
  downloadBlob(json, timestampedFilename("fintrack-backup", "json"), "application/json");
}

// ── PDF (print-to-PDF) ────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildMonthlyReportHTML(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  month: string,
  appName: string,
): string {
  const filtered = transactions.filter((t) => t.date.startsWith(month));
  const walletNameById = new Map(wallets.map((w) => [w.id, w.name]));

  let income = 0;
  let expense = 0;
  for (const t of filtered) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  const net = income - expense;

  const rows = filtered
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (t) => `
        <tr>
          <td>${escapeHtml(t.date)}</td>
          <td>${escapeHtml(t.type)}</td>
          <td>${escapeHtml(t.category)}</td>
          <td>${escapeHtml(t.description ?? "")}</td>
          <td>${escapeHtml(walletNameById.get(t.walletId) ?? "-")}</td>
          <td class="num ${t.type === "income" ? "pos" : t.type === "expense" ? "neg" : ""}">
            ${t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}${formatIDR(t.amount)}
          </td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(appName)} — Laporan ${escapeHtml(month)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         color: #111; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; margin-bottom: 18px; }
  .summary { display: flex; gap: 16px; margin-bottom: 18px; }
  .summary > div { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; }
  .summary .label { font-size: 11px; color: #666; text-transform: uppercase; }
  .summary .value { font-size: 16px; font-weight: 600; margin-top: 2px; }
  .pos { color: #15803d; }
  .neg { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: #888; padding: 20px; text-align: center; }
  @media print {
    body { margin: 0; }
    .summary > div { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Laporan Bulanan — ${escapeHtml(month)}</h1>
  <div class="sub">${escapeHtml(appName)} · dibuat ${escapeHtml(new Date().toLocaleString("id-ID"))}</div>

  <div class="summary">
    <div>
      <div class="label">Pemasukan</div>
      <div class="value pos">${formatIDR(income)}</div>
    </div>
    <div>
      <div class="label">Pengeluaran</div>
      <div class="value neg">${formatIDR(expense)}</div>
    </div>
    <div>
      <div class="label">Selisih</div>
      <div class="value ${net >= 0 ? "pos" : "neg"}">${formatIDR(net)}</div>
    </div>
  </div>

  ${
    filtered.length === 0
      ? `<div class="empty">Tidak ada transaksi pada periode ini.</div>`
      : `<table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Dompet</th>
              <th class="num">Nominal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
  }
</body>
</html>`;
}

export function openMonthlyReportPrint(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  month: string,
  appName: string,
) {
  if (typeof window === "undefined") return;
  const html = buildMonthlyReportHTML(transactions, wallets, month, appName);
  const w = window.open("", "_blank");
  if (!w) {
    // Popup blocked — fall back to a same-tab navigation so the
    // user can still print from the browser menu.
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    window.location.href = dataUrl;
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Wait one tick for layout to settle before invoking the print
  // dialog — on Firefox the print preview is empty if you call it
  // synchronously after `document.write`.
  w.addEventListener("load", () => {
    setTimeout(() => w.print(), 50);
  });
}

// ── Templates ─────────────────────────────────────────────────────────────

export function getTransactionsCSVTemplate(): string {
  const headers = [...TRANSACTION_CSV_HEADERS];
  const example = [
    "txn-001",
    "2026-06-15",
    "expense",
    "50000",
    "Makanan",
    "Makan siang",
    "Dompet Utama",
    "kantor; mingguan",
  ];
  return rowsToCSV([headers, example]);
}

export function getWalletsCSVTemplate(): string {
  const headers = [...WALLET_CSV_HEADERS];
  const example = ["wlt-001", "Dompet Utama", "cash", "500000", "IDR"];
  return rowsToCSV([headers, example]);
}

export function getBackupJSONTemplate(appName = "FinTrack"): string {
  const template: BackupBundle = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appName,
    wallets: [
      {
        id: "wlt-001",
        name: "Dompet Utama",
        type: "cash",
        balance: 500000,
        currency: "IDR",
        color: "#22c55e",
        icon: "💵",
      },
    ],
    transactions: [
      {
        id: "txn-001",
        type: "expense",
        amount: 50000,
        category: "Makanan",
        categoryIcon: "🍔",
        walletId: "wlt-001",
        walletName: "Dompet Utama",
        description: "Contoh transaksi",
        date: "2026-06-15T00:00:00.000Z",
        tags: ["contoh"],
      },
    ],
    budgets: [],
    investments: [],
    bills: [],
    savingGoals: [],
    debts: [],
    cards: [],
    wishlist: [],
    reimbursements: [],
    notes: [],
    recurringTransactions: [],
    categories: [],
    subCategories: [],
  };
  return JSON.stringify(template, null, 2);
}

export function downloadTransactionsCSVTemplate() {
  downloadBlob(
    getTransactionsCSVTemplate(),
    "template-transaksi.csv",
    "text/csv;charset=utf-8",
  );
}

export function downloadWalletsCSVTemplate() {
  downloadBlob(
    getWalletsCSVTemplate(),
    "template-dompet.csv",
    "text/csv;charset=utf-8",
  );
}

export function downloadBackupJSONTemplate(appName?: string) {
  downloadBlob(
    getBackupJSONTemplate(appName),
    "template-backup.json",
    "application/json",
  );
}

// ── Import (parse + validate) ─────────────────────────────────────────────

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportResult<T> {
  items: T[];
  issues: ImportIssue[];
}

/**
 * Parse a transactions CSV. Returns the transactions it could
 * build (skipping rows with fatal errors) plus a list of issues
 * the UI can show. The `id` column is optional — empty means
 * "create new".
 */
export function importTransactionsFromCSV(
  raw: string,
  wallets: readonly Wallet[],
): ImportResult<Omit<Transaction, "categoryIcon" | "walletName">> {
  const rows = parseCSV(raw);
  const issues: ImportIssue[] = [];
  const items: Omit<Transaction, "categoryIcon" | "walletName">[] = [];

  if (rows.length === 0) {
    issues.push({ row: 0, message: "File kosong." });
    return { items, issues };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const required = ["date", "type", "amount", "category", "wallet"];
  for (const key of required) {
    if (!header.includes(key)) {
      issues.push({ row: 1, message: `Kolom wajib tidak ada: ${key}` });
      return { items, issues };
    }
  }

  const walletByName = new Map(wallets.map((w) => [w.name.toLowerCase(), w]));

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((c) => c.trim() === "")) continue; // skip blank lines
    const cells = indexHeaders(header as readonly string[], row);

    const date = cells["date"];
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
      issues.push({ row: i + 1, message: `Tanggal tidak valid: "${date}"` });
      continue;
    }
    const type = cells["type"].toLowerCase();
    if (type !== "income" && type !== "expense" && type !== "transfer") {
      issues.push({
        row: i + 1,
        message: `Tipe harus income/expense/transfer, dapat "${type}"`,
      });
      continue;
    }
    const amount = parseAmount(cells["amount"]);
    if (!Number.isFinite(amount) || amount < 0) {
      issues.push({
        row: i + 1,
        message: `Nominal tidak valid: "${cells["amount"]}"`,
      });
      continue;
    }
    const category = cells["category"].trim();
    if (!category) {
      issues.push({ row: i + 1, message: "Kategori kosong" });
      continue;
    }

    const walletRef = cells["wallet"].trim();
    const wallet =
      walletByName.get(walletRef.toLowerCase()) ??
      wallets.find((w) => w.id === walletRef);
    if (!wallet) {
      issues.push({
        row: i + 1,
        message: `Dompet tidak ditemukan: "${walletRef}"`,
      });
      continue;
    }

    const id = cells["id"]?.trim() || `txn-import-${Date.now()}-${i}`;
    const tags = cells["tags"]
      ? cells["tags"]
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    items.push({
      id,
      type: type as Transaction["type"],
      amount,
      category,
      walletId: wallet.id,
      description: cells["description"] ?? "",
      date: new Date(date).toISOString(),
      tags: tags.length ? tags : undefined,
    });
  }

  return { items, issues };
}

export function importBackupFromJSON(raw: string): {
  bundle: BackupBundle | null;
  error: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      bundle: null,
      error: `JSON tidak valid: ${err instanceof Error ? err.message : err}`,
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { bundle: null, error: "Root harus berupa object." };
  }
  const obj = parsed as Partial<BackupBundle>;
  if (typeof obj.version !== "number") {
    return { bundle: null, error: "Field 'version' tidak ada / bukan number." };
  }
  if (obj.version > EXPORT_FORMAT_VERSION) {
    return {
      bundle: null,
      error: `Versi backup (${obj.version}) lebih baru dari yang didukung aplikasi (${EXPORT_FORMAT_VERSION}).`,
    };
  }
  return { bundle: obj as BackupBundle, error: null };
}
