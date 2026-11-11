"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "~/lib/utils";

export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
}

/**
 * Six months of money in and money out, as paired columns. The user picks a
 * month to read its exact numbers, so the chart never depends on hover alone
 * (hover does not exist on a phone).
 */
export function CashflowTubes({
  data,
  currency,
}: {
  data: CashflowPoint[];
  currency: string;
}) {
  const last = Math.max(data.length - 1, 0);
  const [active, setActive] = useState(last);
  const selected = data[active] ?? data[last];
  // An all-zero period has no shape to draw. Without this guard the scale
  // tops out at Rp 1 and the axis prints "Rp1" twice, which reads as a bug.
  const hasFlow = data.some((row) => row.income > 0 || row.expense > 0);
  const peak = Math.max(1, ...data.flatMap((row) => [row.income, row.expense]));
  const kept = selected ? selected.income - selected.expense : 0;

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-semibold">Arus kas</h2>
          <p className="text-text-muted mt-0.5 text-sm">
            {data.length} bulan terakhir
          </p>
        </div>
        <Link
          href="/statistics"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Statistik <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-success h-2 w-2 rounded-full" aria-hidden />
          Masuk
          <span className="text-text-primary tabular-nums">
            {formatCurrency(selected?.income ?? 0, true, currency)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-danger h-2 w-2 rounded-full" aria-hidden />
          Keluar
          <span className="text-text-primary tabular-nums">
            {formatCurrency(selected?.expense ?? 0, true, currency)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          Sisa
          <span
            className={`tabular-nums ${kept < 0 ? "text-danger" : "text-success"}`}
          >
            {formatCurrency(kept, true, currency)}
          </span>
        </span>
      </div>

      <div className="relative sm:pl-10">
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 left-0 hidden flex-col justify-between ${hasFlow ? "sm:flex" : ""}`}
          aria-hidden
        >
          {[1, 0.5, 0].map((ratio) => (
            <div key={ratio} className="border-border-subtle relative border-t border-dashed">
              <span className="text-text-muted absolute -top-2 -left-10 text-[10px] font-semibold tabular-nums">
                {formatCurrency(peak * ratio, true, currency)}
              </span>
            </div>
          ))}
        </div>

        {!hasFlow && (
          <p className="text-text-muted flex h-40 items-center justify-center text-center text-sm">
            Belum ada uang masuk atau keluar dalam enam bulan ini.
          </p>
        )}

        <div className={`relative h-40 items-end gap-1 sm:gap-1.5 ${hasFlow ? "flex" : "hidden"}`}>
          {data.map((row, position) => {
            const isActive = position === active;
            return (
              <button
                key={row.month}
                type="button"
                onClick={() => setActive(position)}
                aria-pressed={isActive}
                aria-label={`${row.month}: masuk ${formatCurrency(row.income, false, currency)}, keluar ${formatCurrency(row.expense, false, currency)}`}
                className="group flex h-full flex-1 flex-col justify-end rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="flex h-full items-end gap-0.5">
                  <span
                    className={`flex-1 rounded-t-[4px] transition-all duration-300 ${
                      isActive ? "bg-success" : "bg-success/45 group-hover:bg-success/70"
                    }`}
                    style={{ height: `${Math.max((row.income / peak) * 100, 2)}%` }}
                  />
                  <span
                    className={`flex-1 rounded-t-[4px] transition-all duration-300 ${
                      isActive ? "bg-danger" : "bg-danger/45 group-hover:bg-danger/70"
                    }`}
                    style={{ height: `${Math.max((row.expense / peak) * 100, 2)}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-text-muted flex gap-1 pl-0 text-[11px] font-semibold sm:gap-1.5 sm:pl-10">
        {data.map((row, position) => (
          <span
            key={row.month}
            className={`flex-1 text-center ${position === active ? "text-text-primary" : ""}`}
          >
            {row.month.slice(0, 3)}
          </span>
        ))}
      </div>
    </section>
  );
}
