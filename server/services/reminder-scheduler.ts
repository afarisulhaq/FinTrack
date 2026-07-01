/**
 * Reminder scheduler — runs periodic checks and sends push notifications
 * for bills approaching due date, daily transaction reminders, budget
 * alerts, and debt reminders.
 *
 * Uses setInterval (no cron dependency). Each tick (~60 s) checks what's
 * due and deduplicates using a "last sent" timestamp per (userId, type).
 */

import { canUseDatabase, db } from "../prisma-client.js";
import { sendPushToUser } from "../routes/push.js";

// ── Dedup: track last-sent per (userId, notificationType) ───────────────────
// ponytail: move to Redis/DB when multi-server
const lastSent = new Map<string, number>();

function dedupKey(userId: string, type: string, extra = ""): string {
  return `${userId}:${type}:${extra}`;
}

/** Returns true if this notification hasn't been sent within `cooldownMs`. */
function shouldSend(key: string, cooldownMs: number): boolean {
  const prev = lastSent.get(key);
  if (prev && Date.now() - prev < cooldownMs) return false;
  lastSent.set(key, Date.now());
  return true;
}

// Cooldowns
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// ── Formatters ──────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / ONE_DAY);
}

// ── Checker functions ───────────────────────────────────────────────────────

/** Bill reminders: notify X days before due date. */
async function checkBillReminders() {
  if (!(await canUseDatabase())) return;

  // Get all users who have bill reminders enabled
  const settings = await db.notificationSetting.findMany({
    where: { prefBillReminder: true, channelPush: true },
  });

  for (const s of settings) {
    if (!s.userId) continue;
    const days = s.prefBillReminderDays || 3;

    const bills = await db.bill.findMany({
      where: {
        userId: s.userId,
        status: "unpaid",
        dueDate: {
          lte: new Date(Date.now() + days * ONE_DAY),
          gte: new Date(), // not past due (handled separately)
        },
      },
    });

    for (const bill of bills) {
      const key = dedupKey(s.userId, "bill", bill.id);
      if (!shouldSend(key, ONE_DAY)) continue;

      const d = daysUntil(bill.dueDate);
      const label = d === 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi`;

      await sendPushToUser(s.userId, {
        title: "📋 Tagihan Jatuh Tempo",
        body: `${bill.name} ${formatRp(Number(bill.amount))} jatuh tempo ${label}`,
        url: "/bills",
        tag: `bill-${bill.id}`,
      });
    }

    // Overdue bills
    const overdue = await db.bill.findMany({
      where: {
        userId: s.userId,
        status: "unpaid",
        dueDate: { lt: new Date() },
      },
    });

    for (const bill of overdue) {
      const key = dedupKey(s.userId, "bill-overdue", bill.id);
      if (!shouldSend(key, ONE_DAY)) continue;

      const d = Math.abs(daysUntil(bill.dueDate));
      await sendPushToUser(s.userId, {
        title: "🚨 Tagihan Terlambat!",
        body: `${bill.name} ${formatRp(Number(bill.amount))} sudah lewat ${d} hari`,
        url: "/bills",
        tag: `bill-overdue-${bill.id}`,
      });
    }
  }
}

/** Daily transaction reminder. */
async function checkDailyReminders() {
  if (!(await canUseDatabase())) return;

  const settings = await db.notificationSetting.findMany({
    where: { prefDailyReminder: true, channelPush: true },
  });

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (const s of settings) {
    if (!s.userId) continue;

    // Only send around the configured reminder time (±30 min window)
    const target = s.prefDailyReminderTime || "08:00";
    const [tH, tM] = target.split(":").map(Number);
    const targetMin = (tH ?? 8) * 60 + (tM ?? 0);
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (Math.abs(currentMin - targetMin) > 30) continue;

    const key = dedupKey(s.userId, "daily", "");
    if (!shouldSend(key, ONE_DAY)) continue;

    await sendPushToUser(s.userId, {
      title: "📝 Catat Transaksi Hari Ini",
      body: "Jangan lupa catat pengeluaran dan pemasukan hari ini!",
      url: "/transactions",
      tag: "daily-reminder",
    });
  }
}

/** Budget alert: notify when spending exceeds threshold %. */
async function checkBudgetAlerts() {
  if (!(await canUseDatabase())) return;

  const settings = await db.notificationSetting.findMany({
    where: { prefBudgetAlert: true, channelPush: true },
  });

  for (const s of settings) {
    if (!s.userId) continue;
    const threshold = s.prefBudgetAlertThreshold || 80;

    const budgets = await db.budget.findMany({
      where: { userId: s.userId },
    });

    for (const budget of budgets) {
      const limit = Number(budget.limit);
      const spent = Number(budget.spent);
      if (limit <= 0) continue;

      const pct = Math.round((spent / limit) * 100);
      if (pct < threshold) continue;

      const key = dedupKey(s.userId, "budget", budget.id);
      // Only alert once when crossing the threshold (cooldown = 1 day)
      if (!shouldSend(key, ONE_DAY)) continue;

      const label =
        pct >= 100
          ? `melebihi limit (${pct}%)`
          : `sudah ${pct}% dari limit`;

      await sendPushToUser(s.userId, {
        title: "💰 Peringatan Anggaran",
        body: `${budget.category} ${label} — ${formatRp(spent)} / ${formatRp(limit)}`,
        url: "/budget",
        tag: `budget-${budget.id}`,
      });
    }
  }
}

/** Debt reminder: notify about unsettled debts with due dates. */
async function checkDebtReminders() {
  if (!(await canUseDatabase())) return;

  const settings = await db.notificationSetting.findMany({
    where: { prefDebtReminder: true, channelPush: true },
  });

  for (const s of settings) {
    if (!s.userId) continue;

    const debts = await db.debt.findMany({
      where: {
        userId: s.userId,
        isSettled: false,
        dueDate: {
          lte: new Date(Date.now() + 3 * ONE_DAY), // within 3 days
          not: null,
        },
      },
    });

    for (const debt of debts) {
      if (!debt.dueDate) continue;
      const key = dedupKey(s.userId, "debt", debt.id);
      if (!shouldSend(key, ONE_DAY)) continue;

      const d = daysUntil(debt.dueDate);
      const remaining = Number(debt.amount) - Number(debt.paidAmount);
      const direction = debt.direction === "owe" ? "Bayar ke" : "Tagih dari";
      const label = d < 0 ? `sudah lewat ${Math.abs(d)} hari` : d === 0 ? "hari ini" : `${d} hari lagi`;

      await sendPushToUser(s.userId, {
        title: `📌 ${direction} ${debt.personName}`,
        body: `${formatRp(remaining)} jatuh tempo ${label}`,
        url: "/debts",
        tag: `debt-${debt.id}`,
      });
    }
  }
}

// ── Main tick ───────────────────────────────────────────────────────────────

async function tick() {
  try {
    await Promise.allSettled([
      checkBillReminders(),
      checkDailyReminders(),
      checkBudgetAlerts(),
      checkDebtReminders(),
    ]);
  } catch (err) {
    console.warn("[Scheduler] tick error:", err);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Start the reminder scheduler. Call once from server boot. */
export function startReminderScheduler(intervalMs = 60_000) {
  if (intervalId) return; // already running
  console.log(`[Scheduler] Starting reminder scheduler (every ${intervalMs / 1000}s)`);

  // First tick after a short delay (let the server finish booting)
  setTimeout(() => void tick(), 5_000);

  intervalId = setInterval(() => void tick(), intervalMs);
}

/** Stop the scheduler (for graceful shutdown). */
export function stopReminderScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
