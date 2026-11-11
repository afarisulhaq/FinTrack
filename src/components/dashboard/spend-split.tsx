"use client";

import { CalendarClock } from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { formatCurrency } from "~/lib/utils";

export interface SpendCategory {
  name: string;
  value: number;
  icon: string;
  color: string;
}

/**
 * Where this month's money went. The bar is the shape of the month at a
 * glance; the rows carry the exact numbers. Category colours stay on the
 * bar and the dots, never on the text, because a user-picked colour cannot
 * be guaranteed to pass contrast in both themes.
 */
export function SpendSplit({
  categories,
  currency,
  monthLabel,
  previousExpense,
  previousLabel,
}: {
  categories: SpendCategory[];
  currency: string;
  monthLabel: string;
  previousExpense: number;
  previousLabel: string;
}) {
  const total = categories.reduce((sum, row) => sum + row.value, 0);
  const shown = categories.slice(0, 5);
  const rest = categories.slice(5);
  const restTotal = rest.reduce((sum, row) => sum + row.value, 0);

  const now = new Date();
  const elapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = elapsed > 0 ? Math.round((total / elapsed) * daysInMonth) : 0;

  if (total === 0) {
    return (
      <section className="card flex flex-col gap-3">
        <div>
          <h2 className="text-text-primary text-lg font-semibold">
            Ke mana uang pergi
          </h2>
          <p className="text-text-muted mt-0.5 text-sm">{monthLabel}</p>
        </div>
        <p className="text-text-muted py-6 text-center text-sm">
          Belum ada pengeluaran tercatat bulan ini.
        </p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-text-primary text-lg font-semibold">
          Ke mana uang pergi
        </h2>
        <p className="text-text-muted mt-0.5 text-sm">
          {monthLabel} · {formatCurrency(total, false, currency)}
        </p>
      </div>

      <div className="flex h-3 gap-0.5" aria-hidden>
        {shown.map((row) => (
          <span
            key={row.name}
            className="h-full rounded-[3px]"
            style={{
              flexGrow: row.value,
              backgroundColor: row.color,
            }}
          />
        ))}
        {restTotal > 0 && (
          <span
            className="bg-text-muted/40 h-full rounded-[3px]"
            style={{ flexGrow: restTotal }}
          />
        )}
      </div>

      <div className="flex flex-col">
        {shown.map((row) => (
          <div key={row.name} className="flex items-center gap-2.5 py-1.5 text-sm font-semibold">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <DynamicIcon
              name={row.icon}
              className="text-text-muted h-4 w-4 shrink-0"
            />
            <span className="text-text-primary flex-1 truncate">{row.name}</span>
            <span className="text-text-muted text-xs tabular-nums">
              {Math.round((row.value / total) * 100)}%
            </span>
            <b className="text-text-primary min-w-[68px] text-right tabular-nums">
              {formatCurrency(row.value, true, currency)}
            </b>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="text-text-secondary flex items-center gap-2.5 py-1.5 text-sm font-semibold">
            <span className="bg-text-muted/40 h-2.5 w-2.5 shrink-0 rounded-[3px]" aria-hidden />
            <span className="flex-1 truncate">
              {rest.length} kategori lain
            </span>
            <span className="text-text-muted text-xs tabular-nums">
              {Math.round((restTotal / total) * 100)}%
            </span>
            <b className="min-w-[68px] text-right tabular-nums">
              {formatCurrency(restTotal, true, currency)}
            </b>
          </div>
        )}
      </div>

      <p className="bg-primary/10 text-text-secondary flex items-start gap-2 rounded-md px-3 py-2.5 text-sm">
        <CalendarClock className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Dengan laju ini, {monthLabel} berakhir di sekitar{" "}
          <b className="text-text-primary tabular-nums">
            {formatCurrency(projected, false, currency)}
          </b>
          {previousExpense > 0 && (
            <>
              , {previousLabel} sebesar{" "}
              <b className="text-text-primary tabular-nums">
                {formatCurrency(previousExpense, false, currency)}
              </b>
            </>
          )}
          .
        </span>
      </p>
    </section>
  );
}
