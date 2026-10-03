import assert from "node:assert/strict";
import { calculateActivity } from "../src/lib/gamification";
const empty = { transactions: [], savingGoals: [], bills: [], debts: [] };
const now = new Date("2026-10-03T12:00:00Z");
const initial = calculateActivity(empty, now);
assert.equal(initial.totalXP, 0);
assert.equal(initial.level, 1);
assert.equal(initial.badges.filter((badge) => badge.isUnlocked).length, 0);
assert.equal(initial.currentStreak, 0);
const dates = [
  "2026-09-30T18:00:00Z",
  "2026-10-01T18:00:00Z",
  "2026-10-02T18:00:00Z",
];
const activity = calculateActivity(
  {
    ...empty,
    transactions: dates.map((date) => ({ date, type: "income", amount: 1000 })),
  },
  now,
);
assert.equal(activity.currentStreak, 3);
assert.equal(activity.longestStreak, 3);
assert.equal(activity.last7Days.at(-1)?.count, 1);
assert.equal(
  activity.badges.find((badge) => badge.id === "three-days")?.isUnlocked,
  true,
);
assert.equal(activity.totalXP, 85);
const invalid = calculateActivity(
  {
    ...empty,
    transactions: [
      { date: "2026-10-04", amount: 1, type: "income" },
      { date: "invalid", amount: 1, type: "income" },
      { date: "2026-10-03", amount: 0, type: "expense" },
    ],
  },
  now,
);
assert.equal(invalid.totalXP, 0);
const milestone = calculateActivity(
  {
    ...empty,
    transactions: Array.from({ length: 10 }, () => ({
      date: "2026-10-03",
      amount: 10,
      type: "expense",
    })),
    savingGoals: [{ currentAmount: 100, targetAmount: 100 }],
    bills: [{ status: "paid" }],
    debts: [{ isSettled: true }],
  },
  now,
);
assert.equal(milestone.totalXP, 300);
assert.equal(milestone.level, 3);
assert.equal(milestone.badges.filter((badge) => badge.isUnlocked).length, 5);
assert.equal(
  calculateActivity(empty, now).totalXP,
  0,
  "Removing records must not preserve fabricated rewards",
);
assert.equal(
  calculateActivity(empty, now).last7Days.every((day) => day.count === 0),
  true,
);
console.log(
  "PASS: empty state, real records, Jakarta date boundary, current/longest streak, badge thresholds, goal/bill/debt milestones, XP/levels, invalid/future transactions, recalculation",
);
