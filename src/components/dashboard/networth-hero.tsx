"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "~/lib/utils";

export interface PaceItem {
  label: string;
  value: string;
  tone?: "success" | "danger" | "plain";
}

/**
 * The one focal card on the dashboard: what the user is worth right now, then
 * the four numbers that explain it. The split bar shows how much of the total
 * is liquid versus invested, which is the question the headline number raises.
 */
export function NetWorthHero({
  netWorth,
  cash,
  portfolio,
  currency,
  monthLabel,
  income,
  expense,
  transactionCount,
}: {
  netWorth: number;
  cash: number;
  portfolio: number;
  currency: string;
  monthLabel: string;
  income: number;
  expense: number;
  transactionCount: number;
}) {
  const total = Math.max(cash + portfolio, 1);
  const cashShare = Math.round((cash / total) * 100);
  const saved = income - expense;
  const savingRate = income > 0 ? Math.round((saved / income) * 100) : null;

  const pace: PaceItem[] = [
    { label: "Masuk", value: formatCurrency(income, true, currency), tone: "success" },
    { label: "Keluar", value: formatCurrency(expense, true, currency), tone: "danger" },
    { label: "Selisih", value: formatCurrency(saved, true, currency), tone: saved < 0 ? "danger" : "success" },
    { label: "Transaksi", value: String(transactionCount) },
  ];

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-semibold">
            Kekayaan bersih
          </h2>
          <p className="text-text-muted mt-0.5 text-sm">
            Kas ditambah nilai portofolio
          </p>
        </div>
        <Link
          href="/statistics"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Rincian <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <span className="text-text-primary text-[clamp(34px,4vw,46px)] leading-none font-semibold tracking-tight tabular-nums">
          {formatCurrency(netWorth, false, currency)}
        </span>
        {savingRate !== null && (
          <span
            className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              savingRate >= 0
                ? "bg-success/12 text-success"
                : "bg-danger/12 text-danger"
            }`}
          >
            {savingRate >= 0 ? "Sisa" : "Minus"} {Math.abs(savingRate)}% dari pemasukan
          </span>
        )}
      </div>

      <div>
        <div className="flex h-2.5 gap-0.5" aria-hidden>
          <span
            className="bg-primary h-full rounded-[3px]"
            style={{ flexGrow: Math.max(cash, 1) }}
          />
          <span
            className="bg-primary/35 h-full rounded-[3px]"
            style={{ flexGrow: Math.max(portfolio, 1) }}
          />
        </div>
        <div className="text-text-muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <i className="bg-primary h-2 w-2 rounded-full" aria-hidden />
            Kas
            <span className="text-text-primary tabular-nums">
              {formatCurrency(cash, false, currency)}
            </span>
            <span className="tabular-nums">({cashShare}%)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="bg-primary/35 h-2 w-2 rounded-full" aria-hidden />
            Portofolio
            <span className="text-text-primary tabular-nums">
              {formatCurrency(portfolio, false, currency)}
            </span>
            <span className="tabular-nums">({100 - cashShare}%)</span>
          </span>
        </div>
      </div>

      <div className="border-border/60 border-t pt-3">
        <p className="text-text-muted mb-2 text-xs font-semibold">
          {monthLabel}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {pace.map((item) => (
            <div
              key={item.label}
              className="bg-bg-elevated/70 rounded-md px-2.5 py-2 [box-shadow:inset_0_0_0_1px_var(--border-subtle)]"
            >
              <small className="text-text-muted block text-[10px] font-semibold">
                {item.label}
              </small>
              <span
                className={`mt-0.5 block text-base font-semibold tabular-nums ${
                  item.tone === "success"
                    ? "text-success"
                    : item.tone === "danger"
                      ? "text-danger"
                      : "text-text-primary"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
