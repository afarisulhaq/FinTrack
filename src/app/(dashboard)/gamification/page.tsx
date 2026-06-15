"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Snowflake, Trophy, Shield, Zap } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { ProgressBar } from "~/components/ui/progress-bar";
import { useFinanceStore } from "~/store/useFinanceStore";
import { formatDate, cn } from "~/lib/utils";
import type { GamificationBadge } from "~/lib/types";

// ─── XP Level Thresholds (index = level - 1) ──────────────────────────────────

const XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

function getXPInfo(totalXP: number, level: number) {
  const nextIdx = Math.min(level, XP_LEVELS.length - 1);
  const curIdx = Math.min(level - 1, XP_LEVELS.length - 1);
  const currentThreshold = XP_LEVELS[curIdx];
  const nextThreshold = XP_LEVELS[nextIdx];
  const range = nextThreshold - currentThreshold;
  const progress =
    range > 0 ? ((totalXP - currentThreshold) / range) * 100 : 100;
  return {
    nextThreshold,
    progress: Math.min(Math.max(progress, 0), 100),
  };
}

// ─── Health Score Ring ─────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 68;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - score / 100);
  const color =
    score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label =
    score >= 70 ? "Sehat" : score >= 50 ? "Cukup" : "Perlu Perhatian";

  return (
    <div className="relative w-[180px] h-[180px] shrink-0">
      {/* SVG ring — rotated so the gap starts at the top */}
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#22263a"
          strokeWidth="14"
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${circ}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${color}80)`,
            transition: "stroke-dashoffset 1.2s ease-out",
          }}
        />
      </svg>

      {/* Inner text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className="text-4xl font-black leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-xs text-text-muted">/100</span>
        <span
          className="text-sm font-semibold mt-0.5"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Leaderboard Mock ──────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isCurrentUser: boolean;
  emoji: string;
}

const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Ahmad R.", score: 88, isCurrentUser: false, emoji: "🦅" },
  { rank: 2, name: "Budi S.", score: 81, isCurrentUser: false, emoji: "🦁" },
  { rank: 3, name: "Kamu", score: 72, isCurrentUser: true, emoji: "⭐" },
  { rank: 4, name: "Citra M.", score: 65, isCurrentUser: false, emoji: "🌸" },
  { rank: 5, name: "Dian K.", score: 59, isCurrentUser: false, emoji: "🦊" },
];

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GamificationPage() {
  const gamification = useFinanceStore((s) => s.gamification);
  const transactions = useFinanceStore((s) => s.transactions);

  const [selectedBadge, setSelectedBadge] =
    useState<GamificationBadge | null>(null);

  const g = gamification;
  const { nextThreshold, progress: xpProgress } = getXPInfo(
    g.totalXP,
    g.level
  );

  const unlockedBadges = useMemo(
    () => g.badges.filter((b) => b.isUnlocked),
    [g.badges]
  );
  const lockedBadges = useMemo(
    () => g.badges.filter((b) => !b.isUnlocked),
    [g.badges]
  );

  // Build last-7-days activity grid from real transaction data
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0];
      const hasRecord = transactions.some(
        (tx) => tx.type === "expense" && tx.date.split("T")[0] === dateStr
      );
      return {
        date: d,
        dateStr,
        hasRecord,
        label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      };
    });
  }, [transactions]);

  // Pillar breakdown rows
  const pillars = [
    {
      icon: "💰",
      label: "Tabungan",
      score: g.breakdown.savings,
      max: 25,
      detail: "Savings rate 22%",
    },
    {
      icon: "📊",
      label: "Anggaran",
      score: g.breakdown.budget,
      max: 25,
      detail: "80% kategori dalam batas",
    },
    {
      icon: "💳",
      label: "Utang",
      score: g.breakdown.debt,
      max: 25,
      detail: "Debt-to-income 18%",
    },
    {
      icon: "📈",
      label: "Investasi",
      score: g.breakdown.investment,
      max: 25,
      detail: "Portofolio aktif",
    },
  ];

  const lowestPillar = pillars.reduce((a, b) => (a.score < b.score ? a : b));

  const TIPS: Record<string, string> = {
    Tabungan: "Tingkatkan saving rate ke 20% untuk skor lebih baik",
    Anggaran: "Jaga pengeluaran tetap dalam batas anggaran setiap bulan",
    Utang:
      "Kurangi debt-to-income ratio dengan melunasi utang lebih cepat",
    Investasi:
      "Tambah aset investasi untuk meningkatkan skor finansial kamu",
  };

  return (
    <PageWrapper
      title="Gamifikasi"
      subtitle="Level up finansialmu dan raih semua pencapaian!"
    >
      {/* ══ Section 1: Hero — Level & XP ════════════════════════════════════ */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Left: Level badge + XP bar */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Circular level badge */}
            <div
              className="shrink-0 w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a78bfa 100%)",
                boxShadow: "0 0 28px rgba(99,102,241,0.45)",
              }}
            >
              <span className="text-3xl font-black text-white select-none">
                {g.level}
              </span>
            </div>

            {/* Level name + XP progress */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-lg font-bold text-text-primary">
                  {g.levelName}
                </span>
                <Badge variant="purple" size="sm">
                  Level {g.level}
                </Badge>
              </div>
              <p className="text-sm text-text-muted mb-3">
                {g.totalXP.toLocaleString("id-ID")} XP terkumpul
              </p>

              {/* Animated XP progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{g.totalXP.toLocaleString("id-ID")} XP</span>
                  <span>
                    {nextThreshold.toLocaleString("id-ID")} XP ke Level{" "}
                    {g.level + 1}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-bg-elevated overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
                      boxShadow: "0 0 10px rgba(99,102,241,0.5)",
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-20 bg-border shrink-0" />

          {/* Right: Streak stats */}
          <div className="flex gap-8 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Flame className="w-6 h-6 text-warning" />
                <span className="text-3xl font-black text-text-primary">
                  {g.currentStreak}
                </span>
              </div>
              <span className="text-xs text-text-muted">Hari Berturut-turut</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Snowflake className="w-6 h-6" style={{ color: "#0ea5e9" }} />
                <span className="text-3xl font-black text-text-primary">
                  {g.zeroSpendStreak}
                </span>
              </div>
              <span className="text-xs text-text-muted">Hari Zero Spend</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ══ Section 2: Financial Health Score ══════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-text-primary">
              Skor Kesehatan Finansial
            </h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* SVG ring */}
            <HealthRing score={g.healthScore} />

            {/* Breakdown rows */}
            <div className="flex-1 w-full space-y-4">
              {pillars.map((p) => (
                <div key={p.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none select-none">
                        {p.icon}
                      </span>
                      <span className="text-sm font-medium text-text-primary">
                        {p.label}
                      </span>
                      <span className="text-xs text-text-muted hidden sm:block truncate">
                        — {p.detail}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-text-primary shrink-0">
                      {p.score}
                      <span className="text-text-muted font-normal">
                        /{p.max}
                      </span>
                    </span>
                  </div>
                  <ProgressBar
                    value={p.score}
                    max={p.max}
                    color={
                      p.score / p.max >= 0.7
                        ? "#22c55e"
                        : p.score / p.max >= 0.5
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Smart tip based on lowest pillar */}
          <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-bg-elevated border border-border">
            <span className="text-base shrink-0 select-none">💡</span>
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-warning">Tips: </span>
              {TIPS[lowestPillar.label]}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ══ Section 3: Streak Tracker ═══════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-warning" />
            <h3 className="text-base font-semibold text-text-primary">
              Streak Tracker
            </h3>
          </div>
          <Badge variant="warning" size="sm">
            🏆 Terpanjang: {g.longestStreak} hari
          </Badge>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
            {/* Big streak number */}
            <div className="flex items-center gap-3 shrink-0">
              <motion.span
                className="text-5xl select-none"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                🔥
              </motion.span>
              <div>
                <div className="text-4xl font-black text-warning leading-none">
                  {g.currentStreak}
                </div>
                <div className="text-sm text-text-muted">hari berturut-turut</div>
              </div>
            </div>

            {/* 7-day dot grid */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wide">
                7 Hari Terakhir
              </p>
              <div className="flex gap-2 flex-wrap">
                {last7Days.map((day) => (
                  <div
                    key={day.dateStr}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        "text-sm font-bold border transition-colors",
                        day.hasRecord
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-bg-elevated text-text-muted border-border"
                      )}
                    >
                      {day.hasRecord ? "✓" : "–"}
                    </div>
                    <span className="text-[10px] text-text-muted capitalize">
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-spend counts */}
            <div className="shrink-0 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none">⭐</span>
                <div>
                  <div className="font-bold text-text-primary">
                    {g.zeroSpendStreak}{" "}
                    <span className="font-normal text-text-muted text-sm">
                      hari
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    Zero spend bulan ini
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none">🌟</span>
                <div>
                  <div className="font-bold text-text-primary">
                    {g.totalZeroSpendDays}{" "}
                    <span className="font-normal text-text-muted text-sm">
                      hari
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    Total zero spend tahun ini
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ══ Section 4: Badges / Achievements ════════════════════════════════ */}
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            <h3 className="text-lg font-bold text-text-primary">
              Koleksi Lencana
            </h3>
          </div>
          <Badge variant="purple">
            {unlockedBadges.length}/{g.badges.length} diraih
          </Badge>
        </div>

        {/* ── Unlocked badges ─────────────────────────────── */}
        {unlockedBadges.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-success mb-3">
              Sudah Diraih ✅
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {unlockedBadges.map((badge, i) => (
                <motion.button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="text-left p-4 rounded-xl border relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    backgroundColor: `${badge.color}18`,
                    borderColor: `${badge.color}35`,
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: `0 0 22px ${badge.color}35`,
                  }}
                >
                  {/* Shimmer sweep overlay */}
                  <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <motion.div
                      className="absolute top-0 bottom-0 w-1/2"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${badge.color}30, transparent)`,
                      }}
                      initial={{ left: "-60%" }}
                      animate={{ left: "160%" }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        repeatDelay: 2.5 + i * 0.4,
                        ease: "easeInOut",
                      }}
                    />
                  </div>

                  <div className="text-3xl mb-2 select-none">{badge.icon}</div>
                  <div className="text-sm font-semibold text-text-primary mb-0.5 leading-tight">
                    {badge.name}
                  </div>
                  <div className="text-xs text-text-secondary leading-tight mb-3 line-clamp-2">
                    {badge.description}
                  </div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    {badge.unlockedAt && (
                      <span className="text-[10px] text-text-muted">
                        {formatDate(badge.unlockedAt, "short")}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                      style={{
                        backgroundColor: `${badge.color}25`,
                        color: badge.color,
                      }}
                    >
                      +{badge.xpReward} XP
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── Locked / in-progress badges ─────────────────── */}
        {lockedBadges.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-text-muted mb-3">
              Dalam Progress 🔓
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {lockedBadges.map((badge, i) => (
                <motion.button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="text-left p-4 rounded-xl border border-border bg-bg-elevated cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  whileHover={{
                    scale: 1.01,
                    borderColor: "rgba(99,102,241,0.4)",
                  }}
                >
                  <div className="text-3xl mb-2 select-none grayscale opacity-40">
                    {badge.icon}
                  </div>
                  <div className="text-sm font-semibold text-text-secondary mb-0.5 leading-tight">
                    {badge.name}
                  </div>
                  <div className="text-xs text-text-muted leading-tight mb-2 line-clamp-2">
                    {badge.description}
                  </div>

                  {badge.progress !== undefined && badge.progress > 0 && (
                    <div className="mb-2 space-y-0.5">
                      <ProgressBar
                        value={badge.progress}
                        max={100}
                        color="#6366f1"
                        size="sm"
                      />
                      <span className="text-[10px] text-primary block">
                        {badge.progress}% selesai
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1 flex-wrap mt-auto">
                    <span className="text-[10px] text-text-muted truncate flex-1 leading-tight">
                      {badge.condition}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bg-surface border border-border text-text-muted ml-1 shrink-0">
                      +{badge.xpReward} XP
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ Section 5: Leaderboard Preview ══════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            <h3 className="text-base font-semibold text-text-primary">
              Peringkat Finansial Kamu
            </h3>
          </div>
          <Badge variant="default" size="sm">
            Preview
          </Badge>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {LEADERBOARD.map((entry) => {
              const scoreColor =
                entry.score >= 70
                  ? "#22c55e"
                  : entry.score >= 50
                    ? "#f59e0b"
                    : "#ef4444";
              return (
                <motion.div
                  key={entry.rank}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl",
                    entry.isCurrentUser
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-bg-elevated border border-transparent"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: entry.rank * 0.07 }}
                >
                  {/* Rank */}
                  <span className="w-7 text-center font-bold text-base select-none">
                    {RANK_ICONS[entry.rank] ?? entry.rank}
                  </span>

                  {/* Avatar emoji */}
                  <span className="text-xl select-none">{entry.emoji}</span>

                  {/* Name */}
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium",
                      entry.isCurrentUser
                        ? "text-primary"
                        : "text-text-primary"
                    )}
                  >
                    {entry.name}
                    {entry.isCurrentUser && (
                      <span className="ml-1.5 text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                        Kamu
                      </span>
                    )}
                  </span>

                  {/* Score bar + number */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-2 bg-bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${entry.score}%`,
                          backgroundColor: scoreColor,
                          boxShadow: `0 0 6px ${scoreColor}60`,
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold tabular-nums w-7 text-right"
                      style={{ color: scoreColor }}
                    >
                      {entry.score}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* ══ Badge Detail Modal ══════════════════════════════════════════════ */}
      <Modal
        open={selectedBadge !== null}
        onClose={() => setSelectedBadge(null)}
        title={selectedBadge?.name ?? ""}
        description={selectedBadge?.description}
        size="sm"
      >
        {selectedBadge && (
          <div className="space-y-4">
            {/* Large icon with glow / grayscale */}
            <div className="flex justify-center py-4">
              <motion.div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl select-none"
                style={{
                  backgroundColor: selectedBadge.isUnlocked
                    ? `${selectedBadge.color}22`
                    : "#22263a",
                  boxShadow: selectedBadge.isUnlocked
                    ? `0 0 32px ${selectedBadge.color}40`
                    : "none",
                }}
                animate={
                  selectedBadge.isUnlocked
                    ? { scale: [1, 1.06, 1] }
                    : undefined
                }
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span
                  className={cn(!selectedBadge.isUnlocked && "grayscale opacity-50")}
                >
                  {selectedBadge.icon}
                </span>
              </motion.div>
            </div>

            {/* Detail rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg">
                <span className="text-sm text-text-muted">Kategori</span>
                <span className="text-sm font-medium text-text-primary capitalize">
                  {selectedBadge.category}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg">
                <span className="text-sm text-text-muted">XP Reward</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: selectedBadge.color }}
                >
                  +{selectedBadge.xpReward} XP
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg">
                <span className="text-sm text-text-muted">Status</span>
                {selectedBadge.isUnlocked ? (
                  <span className="text-sm font-semibold text-success">
                    ✅ Diraih
                  </span>
                ) : (
                  <span className="text-sm font-medium text-text-muted">
                    🔒 Terkunci
                  </span>
                )}
              </div>

              {selectedBadge.isUnlocked && selectedBadge.unlockedAt && (
                <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg">
                  <span className="text-sm text-text-muted">Diraih pada</span>
                  <span className="text-sm font-medium text-text-primary">
                    {formatDate(selectedBadge.unlockedAt, "short")}
                  </span>
                </div>
              )}

              {!selectedBadge.isUnlocked && (
                <div className="p-3 bg-bg-elevated rounded-lg space-y-2">
                  <p className="text-xs text-text-muted uppercase tracking-wide font-medium">
                    Syarat
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedBadge.condition}
                  </p>
                  {selectedBadge.progress !== undefined && (
                    <div className="space-y-1">
                      <ProgressBar
                        value={selectedBadge.progress}
                        max={100}
                        color={selectedBadge.color}
                        size="sm"
                      />
                      <p className="text-xs text-text-muted">
                        {selectedBadge.progress}% selesai
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
