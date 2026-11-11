"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { ProgressBar } from "~/components/ui/progress-bar";
import { formatCurrency, percentage } from "~/lib/utils";

export interface GoalRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
}

export function SavingGoals({
  goals,
  currency,
}: {
  goals: GoalRow[];
  currency: string;
}) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-semibold">Tabungan</h2>
          <p className="text-text-muted mt-0.5 text-sm">Target terdekat</p>
        </div>
        <Link
          href="/savings"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Semua <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <p className="text-text-muted py-6 text-center text-sm">
          Belum ada target tabungan.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((goal) => (
            <div key={goal.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <DynamicIcon
                  name={goal.icon}
                  className="text-text-muted h-4 w-4 shrink-0"
                />
                <span className="text-text-primary flex-1 truncate text-sm font-semibold">
                  {goal.name}
                </span>
                <span className="text-text-primary text-xs font-semibold tabular-nums">
                  {percentage(goal.currentAmount, goal.targetAmount)}%
                </span>
              </div>
              <ProgressBar
                value={goal.currentAmount}
                max={goal.targetAmount}
                color={goal.color}
                size="sm"
              />
              <div className="text-text-muted mt-1 flex justify-between text-[11px] font-semibold tabular-nums">
                <span>{formatCurrency(goal.currentAmount, true, currency)}</span>
                <span>{formatCurrency(goal.targetAmount, true, currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
