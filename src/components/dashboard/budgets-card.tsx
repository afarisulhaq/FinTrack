"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CardHead } from "~/components/ui/card-head";
import { IconTile } from "~/components/ui/icon-tile";
import { formatCurrency, percentage } from "~/lib/utils";

export interface BudgetRow {
  id: string;
  category: string;
  categoryIcon: string;
  limit: number;
  spent: number;
  color: string;
  period: "daily" | "weekly" | "monthly";
}

const LONG_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function periodNote(period: BudgetRow["period"]) {
  if (period === "daily") return "harian";
  if (period === "weekly") return "mingguan";
  return "bulanan";
}

/**
 * The budget panel: how much of the month's plan is already spent, and which
 * categories are running hot. The thin tick on each meter is today's mark —
 * a bar that stops short of it is behind schedule, one that passes it is not.
 */
export function BudgetsCard({
  budgets,
  totalLimit,
  totalSpent,
  overspentCount,
  currency,
  loading,
}: {
  budgets: BudgetRow[];
  totalLimit: number;
  totalSpent: number;
  overspentCount: number;
  currency: string;
  loading?: boolean;
}) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const pace = (dayOfMonth / daysInMonth) * 100;
  const remaining = totalLimit - totalSpent;

  const rows = [...budgets]
    .sort((a, b) => percentage(b.spent, b.limit) - percentage(a.spent, a.limit))
    .slice(0, 4);

  return (
    <section className="card flex flex-col">
      <CardHead
        title="Anggaran"
        subtitle={`Hari ke-${dayOfMonth} dari ${daysInMonth} di ${LONG_MONTHS[now.getMonth()]}${
          overspentCount > 0
            ? `. ${overspentCount} kategori sudah lewat batas.`
            : "."
        }`}
        action={
          <Link
            href="/budget"
            className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
          >
            Kelola <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      {loading && budgets.length === 0 ? (
        <p className="text-text-muted text-sm" role="status">
          Memuat anggaran…
        </p>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-text-secondary text-sm">
            Belum ada anggaran untuk bulan ini.
          </p>
          <Link
            href="/budget"
            className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
          >
            Buat anggaran pertama <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="border-border-subtle flex items-baseline justify-between gap-3 border-t pt-3">
            <span className="text-text-muted text-xs font-semibold">
              Dianggarkan
            </span>
            <span className="text-text-primary text-lg font-semibold tabular-nums">
              {formatCurrency(totalLimit, true, currency)}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {rows.map((budget) => {
              const pct = percentage(budget.spent, budget.limit);
              const over = budget.spent > budget.limit;
              const left = budget.limit - budget.spent;
              return (
                <div key={budget.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <IconTile icon={budget.categoryIcon} color={budget.color} size="sm" />
                    <span className="text-text-primary min-w-0 flex-1 truncate text-sm font-semibold">
                      {budget.category}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        over ? "text-danger" : "text-text-primary"
                      }`}
                    >
                      {formatCurrency(Math.abs(left), true, currency)}
                      <span className="text-text-muted ml-1 text-[11px] font-semibold">
                        {over ? "lebih" : "sisa"}
                      </span>
                    </span>
                  </div>

                  <div className="relative">
                    <div className="bg-bg-elevated h-2.5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          background: over
                            ? "var(--danger)"
                            : pct >= 80
                              ? "var(--warning)"
                              : "var(--gradient-primary)",
                        }}
                      />
                    </div>
                    <span
                      aria-hidden
                      className="bg-text-primary/55 absolute -top-1 -bottom-1 w-0.5 rounded"
                      style={{ left: `calc(${pace}% - 1px)` }}
                    />
                  </div>

                  <div className="text-text-muted flex justify-between gap-2 text-[11px] font-semibold tabular-nums">
                    <span>{formatCurrency(budget.spent, true, currency)} terpakai</span>
                    <span>
                      {formatCurrency(budget.limit, true, currency)} {periodNote(budget.period)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-border-subtle flex items-baseline justify-between gap-3 border-t pt-3">
            <span className="text-text-muted text-xs font-semibold">
              {budgets.length} kategori · terpakai{" "}
              {formatCurrency(totalSpent, true, currency)}
            </span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                remaining < 0 ? "text-danger" : "text-success"
              }`}
            >
              {remaining < 0 ? "lewat " : "sisa "}
              {formatCurrency(Math.abs(remaining), true, currency)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
