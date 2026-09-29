"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Snowflake,
  Trophy,
  Shield,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  Crown,
  Medal,
  Bird,
  Cat,
  Flower2,
  Star,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { ProgressBar } from "~/components/ui/progress-bar";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
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
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label =
    score >= 70 ? "Sehat" : score >= 50 ? "Cukup" : "Perlu Perhatian";

  return (
    <div className="relative h-[180px] w-[180px] shrink-0">
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
        <span className="text-4xl leading-none font-black" style={{ color }}>
          {score}
        </span>
        <span className="text-text-muted text-xs">/100</span>
        <span className="mt-0.5 text-sm font-semibold" style={{ color }}>
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
  Icon: React.ComponentType<{ className?: string }>;
}

const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Ahmad R.", score: 88, isCurrentUser: false, Icon: Bird },
  { rank: 2, name: "Budi S.", score: 81, isCurrentUser: false, Icon: Cat },
  { rank: 3, name: "Kamu", score: 72, isCurrentUser: true, Icon: Star },
  { rank: 4, name: "Citra M.", score: 65, isCurrentUser: false, Icon: Flower2 },
  { rank: 5, name: "Dian K.", score: 59, isCurrentUser: false, Icon: Cat },
];

const RANK_ICONS: Record<
  number,
  { Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  1: { Icon: Crown, tone: "text-warning" },
  2: { Icon: Medal, tone: "text-text-muted" },
  3: { Icon: Medal, tone: "text-warning" },
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GamificationPage() {
  const gamification = useFinanceStore((s) => s.gamification);
  const transactions = useFinanceStore((s) => s.transactions);

  const [selectedBadge, setSelectedBadge] = useState<GamificationBadge | null>(
    null,
  );

  const g = gamification;
  const { nextThreshold, progress: xpProgress } = getXPInfo(g.totalXP, g.level);

  const unlockedBadges = useMemo(
    () => g.badges.filter((b) => b.isUnlocked),
    [g.badges],
  );
  const lockedBadges = useMemo(
    () => g.badges.filter((b) => !b.isUnlocked),
    [g.badges],
  );

  // Build last-7-days activity grid from real transaction data
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0];
      const hasRecord = transactions.some(
        (tx) => tx.type === "expense" && tx.date.split("T")[0] === dateStr,
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
      icon: "Coins",
      label: "Tabungan",
      score: g.breakdown.savings,
      max: 25,
      detail: "Savings rate 22%",
    },
    {
      icon: "BarChart3",
      label: "Anggaran",
      score: g.breakdown.budget,
      max: 25,
      detail: "80% kategori dalam batas",
    },
    {
      icon: "CreditCard",
      label: "Utang",
      score: g.breakdown.debt,
      max: 25,
      detail: "Debt-to-income 18%",
    },
    {
      icon: "TrendingUp",
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
    Utang: "Kurangi debt-to-income ratio dengan melunasi utang lebih cepat",
    Investasi: "Tambah aset investasi untuk meningkatkan skor finansial kamu",
  };

  return (
    <PageWrapper
      title="Gamifikasi"
      subtitle="Level up finansialmu dan raih semua pencapaian!"
    >
      {/* ══ Section 1: Hero — Level & XP ════════════════════════════════════ */}
      <Card>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* Left: Level badge + XP bar */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/* Circular level badge */}
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, #FFD147 0%, #FFB347 60%, #FF8A7A 100%)",
                boxShadow: "0 0 28px rgba(255,209,71,0.45)",
              }}
            >
              <span className="text-3xl font-black text-white select-none">
                {g.level}
              </span>
            </div>

            {/* Level name + XP progress */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-text-primary text-lg font-bold">
                  {g.levelName}
                </span>
                <Badge variant="purple" size="sm">
                  Level {g.level}
                </Badge>
              </div>
              <p className="text-text-muted mb-3 text-sm">
                {g.totalXP.toLocaleString("id-ID")} XP terkumpul
              </p>

              {/* Animated XP progress bar */}
              <div className="space-y-1.5">
                <div className="text-text-muted flex justify-between text-xs">
                  <span>{g.totalXP.toLocaleString("id-ID")} XP</span>
                  <span>
                    {nextThreshold.toLocaleString("id-ID")} XP ke Level{" "}
                    {g.level + 1}
                  </span>
                </div>
                <div className="bg-bg-elevated relative h-3 overflow-hidden rounded-full">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #FFD147, #FFB347, #FF8A7A)",
                      boxShadow: "0 0 10px rgba(255,209,71,0.5)",
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
          <div className="bg-border hidden h-20 w-px shrink-0 sm:block" />

          {/* Right: Streak stats */}
          <div className="flex shrink-0 gap-8">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Flame className="text-warning h-6 w-6" />
                <span className="text-text-primary text-3xl font-black">
                  {g.currentStreak}
                </span>
              </div>
              <span className="text-text-muted text-xs">
                Hari Berturut-turut
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <Snowflake className="h-6 w-6" style={{ color: "#0ea5e9" }} />
                <span className="text-text-primary text-3xl font-black">
                  {g.zeroSpendStreak}
                </span>
              </div>
              <span className="text-text-muted text-xs">Hari Zero Spend</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ══ Section 2: Financial Health Score ══════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="text-primary h-5 w-5" />
            <h3 className="text-text-primary text-base font-semibold">
              Skor Kesehatan Finansial
            </h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center gap-8 md:flex-row">
            {/* SVG ring */}
            <HealthRing score={g.healthScore} />

            {/* Breakdown rows */}
            <div className="w-full flex-1 space-y-4">
              {pillars.map((p) => (
                <div key={p.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <DynamicIcon name={p.icon} className="h-4 w-4 shrink-0" />
                      <span className="text-text-primary text-sm font-medium">
                        {p.label}
                      </span>
                      <span className="text-text-muted hidden truncate text-xs sm:block">
                        - {p.detail}
                      </span>
                    </div>
                    <span className="text-text-primary shrink-0 text-sm font-bold">
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
          <div className="bg-bg-elevated border-border mt-5 flex items-start gap-2.5 rounded-xl border p-3.5">
            <span className="shrink-0 text-base select-none">💡</span>
            <p className="text-text-secondary text-sm leading-relaxed">
              <span className="text-warning font-semibold">Tips: </span>
              {TIPS[lowestPillar.label]}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ══ Section 3: Streak Tracker ═══════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="text-warning h-5 w-5" />
            <h3 className="text-text-primary text-base font-semibold">
              Streak Tracker
            </h3>
          </div>
          <Badge variant="warning" size="sm">
            Terpanjang: {g.longestStreak} hari
          </Badge>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
            {/* Big streak number */}
            <div className="flex shrink-0 items-center gap-3">
              <motion.span
                className="text-warning flex h-12 w-12 items-center justify-center"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                <Flame className="h-10 w-10" />
              </motion.span>
              <div>
                <div className="text-warning text-4xl leading-none font-black tabular-nums">
                  {g.currentStreak}
                </div>
                <div className="text-text-muted text-sm">
                  hari berturut-turut
                </div>
              </div>
            </div>

            {/* 7-day dot grid */}
            <div className="min-w-0 flex-1">
              <p className="text-text-muted mb-3 text-xs font-medium tracking-wide uppercase">
                7 Hari Terakhir
              </p>
              <div className="flex flex-wrap gap-2">
                {last7Days.map((day) => (
                  <div
                    key={day.dateStr}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        "border text-sm font-bold transition-colors",
                        day.hasRecord
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-bg-elevated text-text-muted border-border",
                      )}
                    >
                      {day.hasRecord ? "✓" : "–"}
                    </div>
                    <span className="text-text-muted text-[10px] capitalize">
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-spend counts */}
            <div className="shrink-0 space-y-3">
              <div className="flex items-center gap-2.5">
                <Snowflake className="text-info h-5 w-5" />
                <div>
                  <div className="text-text-primary font-bold tabular-nums">
                    {g.zeroSpendStreak}{" "}
                    <span className="text-text-muted text-sm font-normal">
                      hari
                    </span>
                  </div>
                  <div className="text-text-muted text-xs">
                    Zero spend bulan ini
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="text-primary h-5 w-5" />
                <div>
                  <div className="text-text-primary font-bold tabular-nums">
                    {g.totalZeroSpendDays}{" "}
                    <span className="text-text-muted text-sm font-normal">
                      hari
                    </span>
                  </div>
                  <div className="text-text-muted text-xs">
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
            <Zap className="text-warning h-5 w-5" />
            <h3 className="text-text-primary text-lg font-bold">
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
            <p className="text-text-success mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Sudah Diraih
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {unlockedBadges.map((badge, i) => (
                <motion.button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="focus-visible:ring-primary relative cursor-pointer overflow-hidden rounded-xl border p-4 text-left focus:outline-none focus-visible:ring-2"
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
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
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

                  <DynamicIcon name={badge.icon} className="mb-2 h-8 w-8" />
                  <div className="text-text-primary mb-0.5 text-sm leading-tight font-semibold">
                    {badge.name}
                  </div>
                  <div className="text-text-secondary mb-3 line-clamp-2 text-xs leading-tight">
                    {badge.description}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    {badge.unlockedAt && (
                      <span className="text-text-muted text-[10px]">
                        {formatDate(badge.unlockedAt, "short")}
                      </span>
                    )}
                    <span
                      className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold"
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
            <p className="text-text-muted mb-3 text-sm font-semibold">
              Dalam Progress 🔓
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {lockedBadges.map((badge, i) => (
                <motion.button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="border-border bg-bg-elevated focus-visible:ring-primary cursor-pointer rounded-xl border p-4 text-left focus:outline-none focus-visible:ring-2"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  whileHover={{
                    scale: 1.01,
                    borderColor: "rgba(255,209,71,0.4)",
                  }}
                >
                  <DynamicIcon
                    name={badge.icon}
                    className="mb-2 h-8 w-8 opacity-40 grayscale"
                  />
                  <div className="text-text-secondary mb-0.5 text-sm leading-tight font-semibold">
                    {badge.name}
                  </div>
                  <div className="text-text-muted mb-2 line-clamp-2 text-xs leading-tight">
                    {badge.description}
                  </div>

                  {badge.progress !== undefined && badge.progress > 0 && (
                    <div className="mb-2 space-y-0.5">
                      <ProgressBar
                        value={badge.progress}
                        max={100}
                        color="#FFD147"
                        size="sm"
                      />
                      <span className="text-primary block text-[10px]">
                        {badge.progress}% selesai
                      </span>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-1">
                    <span className="text-text-muted flex-1 truncate text-[10px] leading-tight">
                      {badge.condition}
                    </span>
                    <span className="bg-bg-surface border-border text-text-muted ml-1 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold">
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
            <Trophy className="text-warning h-5 w-5" />
            <h3 className="text-text-primary text-base font-semibold">
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
                    "flex items-center gap-3 rounded-xl px-4 py-3",
                    entry.isCurrentUser
                      ? "bg-primary/10 border-primary/30 border"
                      : "bg-bg-elevated border border-transparent",
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: entry.rank * 0.07 }}
                >
                  {/* Rank */}
                  {(() => {
                    const r = RANK_ICONS[entry.rank];
                    const RankIcon = r?.Icon;
                    return RankIcon ? (
                      <RankIcon className={cn("h-5 w-5", r.tone)} />
                    ) : (
                      <span className="text-text-muted w-7 text-center text-base font-bold tabular-nums">
                        {entry.rank}
                      </span>
                    );
                  })()}

                  {/* Avatar icon */}
                  <entry.Icon className="text-text-secondary h-5 w-5" />
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium",
                      entry.isCurrentUser
                        ? "text-primary"
                        : "text-text-primary",
                    )}
                  >
                    {entry.name}
                    {entry.isCurrentUser && (
                      <span className="text-primary bg-primary/10 border-primary/20 ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px]">
                        Kamu
                      </span>
                    )}
                  </span>

                  {/* Score bar + number */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="bg-bg-surface h-2 w-24 overflow-hidden rounded-full">
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
                      className="w-7 text-right text-sm font-bold tabular-nums"
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
                className="flex h-24 w-24 items-center justify-center rounded-2xl text-5xl select-none"
                style={{
                  backgroundColor: selectedBadge.isUnlocked
                    ? `${selectedBadge.color}22`
                    : "#22263a",
                  boxShadow: selectedBadge.isUnlocked
                    ? `0 0 32px ${selectedBadge.color}40`
                    : "none",
                }}
                animate={
                  selectedBadge.isUnlocked ? { scale: [1, 1.06, 1] } : undefined
                }
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span
                  className={cn(
                    !selectedBadge.isUnlocked && "opacity-50 grayscale",
                  )}
                >
                  <DynamicIcon
                    name={selectedBadge.icon}
                    className="h-10 w-10"
                  />
                </span>
              </motion.div>
            </div>

            {/* Detail rows */}
            <div className="space-y-2">
              <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
                <span className="text-text-muted text-sm">Kategori</span>
                <span className="text-text-primary text-sm font-medium capitalize">
                  {selectedBadge.category}
                </span>
              </div>

              <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
                <span className="text-text-muted text-sm">XP Reward</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: selectedBadge.color }}
                >
                  +{selectedBadge.xpReward} XP
                </span>
              </div>

              <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
                <span className="text-text-muted text-sm">Status</span>
                {selectedBadge.isUnlocked ? (
                  <span className="text-text-success flex items-center gap-1 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Diraih
                  </span>
                ) : (
                  <span className="text-text-muted flex items-center gap-1 text-sm font-medium">
                    <Lock className="h-4 w-4" /> Terkunci
                  </span>
                )}
              </div>

              {selectedBadge.isUnlocked && selectedBadge.unlockedAt && (
                <div className="bg-bg-elevated flex items-center justify-between rounded-lg p-3">
                  <span className="text-text-muted text-sm">Diraih pada</span>
                  <span className="text-text-primary text-sm font-medium">
                    {formatDate(selectedBadge.unlockedAt, "short")}
                  </span>
                </div>
              )}

              {!selectedBadge.isUnlocked && (
                <div className="bg-bg-elevated space-y-2 rounded-lg p-3">
                  <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
                    Syarat
                  </p>
                  <p className="text-text-primary text-sm font-medium">
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
                      <p className="text-text-muted text-xs">
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
