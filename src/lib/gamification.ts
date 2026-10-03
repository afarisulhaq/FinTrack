import type { GamificationBadge } from "./types";

export const ACTIVITY_LEVELS = [
  { name: "Mulai mencatat", xp: 0 },
  { name: "Pencatat aktif", xp: 100 },
  { name: "Pencatat konsisten", xp: 300 },
  { name: "Penjaga catatan", xp: 600 },
  { name: "Pencatat berpengalaman", xp: 1000 },
];

interface ActivityData {
  transactions: { date: string; amount: number; type: string }[];
  savingGoals: { currentAmount: number; targetAmount: number }[];
  bills: { status: string }[];
  debts: { isSettled: boolean }[];
}

function dateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dayNumber(key: string) {
  return Date.parse(`${key}T00:00:00Z`) / 86400000;
}

export function calculateActivity(
  data: ActivityData,
  now = new Date(),
  timezone = "Asia/Jakarta",
) {
  const today = dayNumber(dateKey(now, timezone));
  const records = data.transactions
    .filter(
      (tx) =>
        Number.isFinite(tx.amount) &&
        tx.amount > 0 &&
        ["income", "expense", "transfer"].includes(tx.type),
    )
    .map((tx) => {
      const date = new Date(tx.date);
      if (Number.isNaN(date.getTime())) return null;
      const day = dayNumber(
        /^\d{4}-\d{2}-\d{2}$/.test(tx.date) ? tx.date : dateKey(date, timezone),
      );
      return day <= today ? day : null;
    })
    .filter((day): day is number => day !== null);
  const days = [...new Set(records)].sort((a, b) => a - b);
  let run = 0,
    longestStreak = 0;
  days.forEach((day, index) => {
    run = index && day === days[index - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });
  const recordedDays = new Set(days);
  let currentStreak = 0;
  let cursor = recordedDays.has(today) ? today : today - 1;
  while (recordedDays.has(cursor)) {
    currentStreak++;
    cursor--;
  }
  const achievedGoals = data.savingGoals.filter(
    (goal) => goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount,
  ).length;
  const paidBills = data.bills.filter((bill) => bill.status === "paid").length;
  const settledDebts = data.debts.filter((debt) => debt.isSettled).length;
  const definitions = [
    {
      id: "first-record",
      name: "Catatan pertama",
      count: records.length,
      target: 1,
      reward: 20,
      icon: "Receipt",
      condition: "Catat 1 transaksi",
    },
    {
      id: "ten-records",
      name: "Sepuluh catatan",
      count: records.length,
      target: 10,
      reward: 50,
      icon: "NotebookPen",
      condition: "Catat 10 transaksi",
    },
    {
      id: "fifty-records",
      name: "Lima puluh catatan",
      count: records.length,
      target: 50,
      reward: 100,
      icon: "BookOpen",
      condition: "Catat 50 transaksi",
    },
    {
      id: "three-days",
      name: "Tiga hari konsisten",
      count: longestStreak,
      target: 3,
      reward: 50,
      icon: "CalendarCheck",
      condition: "Catat transaksi selama 3 hari berturut-turut",
    },
    {
      id: "seven-days",
      name: "Seminggu konsisten",
      count: longestStreak,
      target: 7,
      reward: 100,
      icon: "CalendarDays",
      condition: "Catat transaksi selama 7 hari berturut-turut",
    },
    {
      id: "saving-goal",
      name: "Target tabungan tercapai",
      count: achievedGoals,
      target: 1,
      reward: 100,
      icon: "PiggyBank",
      condition: "Capai 1 target tabungan",
    },
    {
      id: "paid-bill",
      name: "Tagihan dibayar",
      count: paidBills,
      target: 1,
      reward: 30,
      icon: "BadgeCheck",
      condition: "Tandai 1 tagihan sebagai dibayar",
    },
    {
      id: "settled-debt",
      name: "Utang atau piutang selesai",
      count: settledDebts,
      target: 1,
      reward: 50,
      icon: "Handshake",
      condition: "Selesaikan 1 utang atau piutang",
    },
  ];
  const badges: GamificationBadge[] = definitions.map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.condition,
    condition: `${Math.min(rule.count, rule.target)} dari ${rule.target}. ${rule.condition}.`,
    icon: rule.icon,
    color: "#92400e",
    category: "milestone",
    isUnlocked: rule.count >= rule.target,
    progress: Math.min(100, Math.floor((rule.count / rule.target) * 100)),
    xpReward: rule.reward,
  }));
  const totalXP =
    records.length * 5 +
    badges
      .filter((badge) => badge.isUnlocked)
      .reduce((sum, badge) => sum + badge.xpReward, 0);
  const levelIndex = ACTIVITY_LEVELS.reduce(
    (index, level, i) => (totalXP >= level.xp ? i : index),
    0,
  );
  const next = ACTIVITY_LEVELS[levelIndex + 1];
  const progress = next
    ? Math.min(
        100,
        ((totalXP - ACTIVITY_LEVELS[levelIndex].xp) /
          (next.xp - ACTIVITY_LEVELS[levelIndex].xp)) *
          100,
      )
    : 100;
  return {
    badges,
    totalXP,
    level: levelIndex + 1,
    levelName: ACTIVITY_LEVELS[levelIndex].name,
    next,
    progress,
    currentStreak,
    longestStreak,
    recordCount: records.length,
    activeDays: days.length,
    last7Days: Array.from({ length: 7 }, (_, i) => ({
      date: new Date((today - 6 + i) * 86400000).toISOString().slice(0, 10),
      count: records.filter((day) => day === today - 6 + i).length,
    })),
  };
}
