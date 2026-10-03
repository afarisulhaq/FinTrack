"use client";

import { useMemo, useState } from "react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Modal } from "~/components/ui/modal";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { useFinanceStore } from "~/store/useFinanceStore";
import { ACTIVITY_LEVELS, calculateActivity } from "~/lib/gamification";

const progressClass =
  "w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-bg-elevated [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary";

export default function GamificationPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const savingGoals = useFinanceStore((s) => s.savingGoals);
  const bills = useFinanceStore((s) => s.bills);
  const debts = useFinanceStore((s) => s.debts);
  const timezone = useFinanceStore((s) => s.userProfile.timezone);
  const lastSyncedAt = useFinanceStore((s) => s.lastSyncedAt);
  const syncError = useFinanceStore((s) => s.syncError);
  const refreshAll = useFinanceStore((s) => s.refreshAll);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const activity = useMemo(
    () =>
      calculateActivity(
        { transactions, savingGoals, bills, debts },
        new Date(lastSyncedAt ?? Date.now()),
        timezone,
      ),
    [transactions, savingGoals, bills, debts, timezone, lastSyncedAt],
  );
  const selected = activity.badges.find((badge) => badge.id === selectedId);
  const unlocked = activity.badges.filter((badge) => badge.isUnlocked).length;
  async function retry() {
    setRetrying(true);
    setError("");
    const ok = await refreshAll();
    if (!ok) setError("Tidak bisa memuat catatan. Silakan coba lagi.");
    setRetrying(false);
  }

  return (
    <PageWrapper title="Gamifikasi">
      <p className="text-text-secondary text-sm">
        Pencapaian dari transaksi, tabungan, tagihan, dan utang yang kamu catat.
        Ini mengukur aktivitas pencatatan, bukan kesehatan finansial atau
        peringkat antar pengguna.
      </p>
      {(syncError || error) && (
        <div
          role="alert"
          className="border-border bg-bg-surface rounded-xl border p-4"
        >
          <p>{error || syncError}</p>
          <Button
            className="mt-3 min-h-11"
            variant="outline"
            loading={retrying}
            onClick={() => void retry()}
          >
            Coba lagi
          </Button>
        </div>
      )}
      {lastSyncedAt === null ? (
        <p role="status" className="text-text-secondary">
          {syncError || error ? "Catatan belum tersedia." : "Memuat catatan..."}
        </p>
      ) : (
        <>
          <section className="border-border bg-bg-surface rounded-xl border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-text-secondary text-sm">
                  Level {activity.level}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {activity.levelName}
                </h2>
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {activity.totalXP.toLocaleString("id-ID")} XP
              </p>
            </div>
            <progress
              aria-label="Progres level pencatatan"
              className={`${progressClass} mt-4 h-3`}
              value={activity.progress}
              max={100}
            />
            <p className="text-text-secondary mt-2 text-sm">
              {activity.next
                ? `${Math.max(0, activity.next.xp - activity.totalXP)} XP lagi menuju ${activity.next.name}.`
                : "Level pencatatan tertinggi tercapai."}
            </p>
            <p className="text-text-secondary mt-3 text-sm">
              5 XP per transaksi valid, ditambah bonus lencana yang syaratnya
              terpenuhi. Progres dihitung ulang dari catatan yang masih
              tersimpan.
            </p>
            <dl className="border-border mt-5 grid gap-4 border-t pt-4 sm:grid-cols-3">
              {[
                ["Transaksi tercatat", activity.recordCount],
                ["Streak saat ini", activity.currentStreak],
                ["Streak terpanjang", activity.longestStreak],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-text-secondary text-sm">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {value}
                    {label !== "Transaksi tercatat" && " hari"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Aktivitas tujuh hari terakhir
            </h2>
            <p className="text-text-secondary text-sm">
              Hari tanpa catatan tidak dianggap sebagai hari tanpa pengeluaran.
              Kalender mengikuti zona waktu {timezone}.
            </p>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-7">
              {activity.last7Days.map((day) => (
                <li
                  key={day.date}
                  className="border-border bg-bg-surface rounded-lg border p-3"
                >
                  <p className="text-text-secondary text-sm">
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${day.date}T00:00:00Z`))}
                  </p>
                  <p className="mt-2 font-semibold tabular-nums">
                    {day.count} catatan
                  </p>
                </li>
              ))}
            </ol>
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Koleksi Lencana</h2>
              <p className="text-text-secondary text-sm">
                {unlocked}/{activity.badges.length} diraih
              </p>
            </div>
            {activity.recordCount === 0 && unlocked === 0 && (
              <p className="text-text-secondary">
                Belum ada pencapaian. Mulai catat transaksi untuk mengisi
                progres lencana.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activity.badges.map((badge) => (
                <button
                  key={badge.id}
                  onClick={() => setSelectedId(badge.id)}
                  className="border-border bg-bg-surface hover:border-primary focus-visible:outline-primary min-h-11 min-w-0 rounded-xl border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <DynamicIcon
                      name={badge.icon}
                      className="text-text-secondary h-6 w-6 shrink-0"
                    />
                    <span className="text-text-secondary text-sm font-medium">
                      {badge.isUnlocked ? "Diraih" : "Belum diraih"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">{badge.name}</h3>
                  <p className="text-text-secondary mt-1 text-sm">
                    {badge.condition}
                  </p>
                  <progress
                    aria-label={`Progres ${badge.name}`}
                    className={`${progressClass} mt-4 h-2`}
                    value={badge.progress}
                    max={100}
                  />
                  <p className="text-text-secondary mt-2 text-sm">
                    {badge.progress}% · Bonus {badge.xpReward} XP
                  </p>
                </button>
              ))}
            </div>
          </section>
          <section className="border-border bg-bg-surface rounded-xl border p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Peringkat Finansial Kamu</h2>
            <p className="text-text-secondary mt-2 text-sm">
              Level pencatatan pribadimu berdasarkan XP. Tidak ada perbandingan
              dengan pengguna lain.
            </p>
            <ol className="divide-border mt-4 divide-y">
              {ACTIVITY_LEVELS.map((level, index) => (
                <li
                  key={level.xp}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {index + 1}. {level.name}
                    </p>
                    <p className="text-text-secondary mt-1 text-sm">
                      Mulai {level.xp.toLocaleString("id-ID")} XP
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {index + 1 === activity.level
                      ? "Level kamu"
                      : index + 1 < activity.level
                        ? "Terlewati"
                        : "Belum tercapai"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? "Detail lencana"}
        description={selected?.description}
      >
        <div className="space-y-3">
          <p>{selected?.condition}</p>
          <p className="text-text-secondary text-sm">
            Status: {selected?.isUnlocked ? "Diraih" : "Belum diraih"}. Progres:{" "}
            {selected?.progress}%. Bonus: {selected?.xpReward} XP.
          </p>
        </div>
      </Modal>
    </PageWrapper>
  );
}
