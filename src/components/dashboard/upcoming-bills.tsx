"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { daysUntil, formatCurrency } from "~/lib/utils";

export interface BillRow {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  status: string;
  icon: string;
}

function dueLabel(days: number) {
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "Jatuh tempo hari ini";
  if (days === 1) return "Besok";
  return `${days} hari lagi`;
}

/** Date tile + name + amount. The tile is the scanning cue: when is it due. */
export function UpcomingBills({
  bills,
  currency,
}: {
  bills: BillRow[];
  currency: string;
}) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-semibold">Tagihan</h2>
          <p className="text-text-muted mt-0.5 text-sm">Belum dibayar</p>
        </div>
        <Link
          href="/bills"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Semua <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {bills.length === 0 ? (
        <p className="text-text-muted py-6 text-center text-sm">
          Tidak ada tagihan tertunda.
        </p>
      ) : (
        <div className="flex flex-col">
          {bills.map((bill) => {
            const days = daysUntil(bill.dueDate);
            const date = new Date(bill.dueDate);
            const day = Number.isNaN(date.getTime()) ? "-" : date.getDate();
            const month = Number.isNaN(date.getTime())
              ? ""
              : date
                  .toLocaleDateString("id-ID", { month: "short" })
                  .replace(".", "");
            return (
              <Link
                key={bill.id}
                href="/bills"
                className="hover:bg-bg-elevated/70 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="bg-bg-elevated flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-md leading-none">
                  <b className="text-text-primary text-sm tabular-nums">{day}</b>
                  <small className="text-text-muted mt-1 text-[10px] font-semibold">
                    {month}
                  </small>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary flex items-center gap-1.5 truncate text-sm font-semibold">
                    <DynamicIcon
                      name={bill.icon}
                      className="text-text-muted h-3.5 w-3.5 shrink-0"
                    />
                    {bill.name}
                  </span>
                  <span
                    className={`block truncate text-xs font-medium ${
                      days < 0
                        ? "text-danger"
                        : days <= 3
                          ? "text-warning"
                          : "text-text-muted"
                    }`}
                  >
                    {dueLabel(days)}
                  </span>
                </span>
                <span className="text-text-primary shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(bill.amount, true, currency)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
