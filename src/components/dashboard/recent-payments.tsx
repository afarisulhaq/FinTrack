"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { formatCurrency } from "~/lib/utils";
import type { Transaction } from "~/lib/types";

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function RecentPayments({
  items,
  currency,
  loading,
}: {
  items: Transaction[];
  currency: string;
  loading?: boolean;
}) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-semibold">
            Transaksi terakhir
          </h2>
          <p className="text-text-muted mt-0.5 text-sm">Semua dompet</p>
        </div>
        <Link
          href="/transactions"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Semua <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-text-muted py-6 text-center text-sm" role="status">
          Memuat transaksi…
        </p>
      ) : items.length === 0 ? (
        <p className="text-text-muted py-6 text-center text-sm">
          Belum ada transaksi tercatat.
        </p>
      ) : (
        <div className="-mx-2 flex flex-col">
          {items.slice(0, 6).map((row) => {
            const isIncome = row.type === "income";
            const isTransfer = row.type === "transfer";
            return (
              <Link
                key={row.id}
                href="/transactions"
                className="hover:bg-bg-elevated/70 flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors"
              >
                <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                  <DynamicIcon name={row.categoryIcon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block truncate text-sm font-semibold">
                    {row.description || row.category}
                  </span>
                  <span className="text-text-muted block truncate text-xs">
                    {row.category} · {row.walletName} · {shortDate(row.date)}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    isTransfer
                      ? "text-text-secondary"
                      : isIncome
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {isTransfer ? "" : isIncome ? "+" : "−"}
                  {formatCurrency(row.amount, false, currency)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
