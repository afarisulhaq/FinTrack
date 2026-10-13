import type { GamificationBadge } from "./types.js";

export interface AnalyticsSummary {
  timezone: string;
  walletBalance: number;
  rootWalletCount: number;
  portfolioValue: number;
  monthlyData: { month: string; income: number; expense: number }[];
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  heatmap: { date: string; amount: number }[];
  categories: { name: string; value: number; icon: string; color: string }[];
  bills: { id: string; name: string; amount: number; dueDate: string; status: string; icon: string }[];
  goals: { id: string; name: string; icon: string; color: string; targetAmount: number; currentAmount: number }[];
}
export interface ActivitySummary {
  timezone: string;
  badges: GamificationBadge[];
  totalXP: number;
  level: number;
  levelName: string;
  next?: { name: string; xp: number };
  progress: number;
  currentStreak: number;
  longestStreak: number;
  recordCount: number;
  activeDays: number;
  last7Days: { date: string; count: number }[];
}
