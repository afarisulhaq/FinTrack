"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarRange, PiggyBank } from "lucide-react";
import { formatCurrency, percentage } from "~/lib/utils";

export interface KpiPoint {
  month: string;
  income: number;
  expense: number;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Delta({ value, suffix }: { value: number; suffix?: string }) {
  const flat = Math.round(value) === 0;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        flat
          ? "bg-bg-elevated text-text-muted"
          : up
            ? "bg-success/12 text-success"
            : "bg-danger/12 text-danger"
      }`}
    >
      {!flat &&
        (up ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownLeft className="h-3 w-3" />
        ))}
      {flat ? "Tetap" : `${Math.abs(Math.round(value))}%`}
      {suffix ? <span className="font-semibold">{suffix}</span> : null}
    </span>
  );
}

/**
 * Four figures that answer "how is a normal month going?" rather than "what
 * happened in this one". The tiles are averages across the loaded period, so
 * a single odd month cannot make them unreadable.
 */
export function KpiRow({
  data,
  currency,
  periodLabel,
}: {
  data: KpiPoint[];
  currency: string;
  periodLabel: string;
}) {
  if (data.length === 0) return null;

  const incomes = data.map((row) => row.income);
  const expenses = data.map((row) => row.expense);
  const avgIn = mean(incomes);
  const avgOut = mean(expenses);
  const keptAvg = avgIn - avgOut;
  const keptPct = avgIn > 0 ? percentage(keptAvg, avgIn) : 0;

  const best = data.reduce((winner, row) =>
    row.income - row.expense > winner.income - winner.expense ? row : winner,
  );
  const bestKept = best.income - best.expense;

  const previous = data.length > 1 ? data[data.length - 2] : null;
  const current = data[data.length - 1];
  const outDelta =
    previous && previous.expense > 0
      ? ((current.expense - previous.expense) / previous.expense) * 100
      : 0;
  const inDelta =
    previous && previous.income > 0
      ? ((current.income - previous.income) / previous.income) * 100
      : 0;

  // Six months of zeros means the account is new, not that it had a flat six
  // months. Say so instead of crowning a "best month" worth nothing.
  const hasData = data.some((row) => row.income > 0 || row.expense > 0);
  const emptyNote = (
    <span className="text-text-muted text-[10px] font-semibold">
      Belum ada transaksi
    </span>
  );

  const tiles = [
    {
      label: "Rata-rata masuk",
      value: formatCurrency(avgIn, true, currency),
      foot: hasData ? <Delta value={inDelta} suffix=" vs bulan lalu" /> : emptyNote,
      icon: ArrowDownLeft,
      tile: "var(--tile-1)",
    },
    {
      label: "Rata-rata keluar",
      value: formatCurrency(avgOut, true, currency),
      foot: hasData ? <Delta value={outDelta} suffix=" vs bulan lalu" /> : emptyNote,
      icon: ArrowUpRight,
      tile: "var(--tile-2)",
    },
    {
      label: "Sisa tiap bulan",
      value: formatCurrency(keptAvg, true, currency),
      foot: hasData ? (
        <span className="text-text-muted text-[10px] font-semibold tabular-nums">
          {keptPct}% dari pemasukan
        </span>
      ) : (
        emptyNote
      ),
      icon: PiggyBank,
      tile: "var(--tile-3)",
    },
    {
      label: "Bulan terbaik",
      value: hasData ? best.month : "-",
      foot: hasData ? (
        <span className="text-text-muted text-[10px] font-semibold tabular-nums">
          sisa {formatCurrency(bestKept, true, currency)}
        </span>
      ) : (
        emptyNote
      ),
      icon: CalendarRange,
      tile: "var(--tile-4)",
    },
  ];

  return (
    <div className="page-grid grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="kpi"
          style={{ "--tile": tile.tile } as React.CSSProperties}
        >
          <span className="text-text-muted flex items-center gap-2 text-xs font-semibold">
            <tile.icon className="h-[17px] w-[17px] shrink-0" />
            {tile.label}
          </span>
          <span className="text-text-primary mt-2.5 text-2xl leading-[1.1] font-semibold tracking-[-0.01em]">
            {tile.value}
          </span>
          <span className="mt-auto flex items-end gap-2 pt-2">{tile.foot}</span>
        </div>
      ))}
      <span className="sr-only">{periodLabel}</span>
    </div>
  );
}
