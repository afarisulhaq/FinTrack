"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import type { SpendCategory } from "./spend-split";

interface Insight {
  tone: "good" | "bad";
  title: string;
  body: string;
}

/**
 * Two observations the numbers actually support: the month-over-month move,
 * and the category that took the largest share. Nothing here is generated
 * prose; every figure is read from the summary the API returned.
 */
export function InsightCard({
  categories,
  currency,
  currentExpense,
  previousExpense,
  currentLabel,
  previousLabel,
}: {
  categories: SpendCategory[];
  currency: string;
  currentExpense: number;
  previousExpense: number;
  currentLabel: string;
  previousLabel: string;
}) {
  const [slide, setSlide] = useState(0);
  const insights: Insight[] = [];

  if (previousExpense > 0) {
    const delta = Math.round(
      ((currentExpense - previousExpense) / previousExpense) * 100,
    );
    const down = delta <= 0;
    insights.push({
      tone: down ? "good" : "bad",
      title: `Pengeluaran ${down ? "turun" : "naik"} ${Math.abs(delta)}%`,
      body: `${formatCurrency(currentExpense, false, currency)} sejauh ini, ${formatCurrency(previousExpense, false, currency)} pada ${previousLabel}.`,
    });
  }

  const total = categories.reduce((sum, row) => sum + row.value, 0);
  const top = categories[0];
  if (top && total > 0) {
    const share = Math.round((top.value / total) * 100);
    insights.push({
      tone: "bad",
      title: `${top.name} menyerap ${share}% pengeluaran`,
      body: `${formatCurrency(top.value, false, currency)} dari ${formatCurrency(total, false, currency)} di ${currentLabel}.`,
    });
  }

  if (insights.length === 0) {
    return (
      <section className="card">
        <h2 className="text-text-primary text-lg font-semibold">Catatan</h2>
        <p className="text-text-muted mt-2 text-sm">
          Belum cukup data bulan ini untuk dibandingkan dengan bulan lalu.
        </p>
      </section>
    );
  }

  const active = insights[slide % insights.length];
  const Icon = active.tone === "good" ? TrendingDown : TrendingUp;

  return (
    <section className="card flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-text-primary text-lg font-semibold">Catatan</h2>
        <span className="text-text-muted text-xs font-semibold">
          {currentLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-start gap-1.5">
        <span
          className={`mb-1 flex h-9 w-9 items-center justify-center rounded-md ${
            active.tone === "good"
              ? "bg-success/12 text-success"
              : "bg-warning/12 text-warning"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <b className="text-text-primary text-base leading-snug font-semibold">
          {active.title}
        </b>
        <p className="text-text-muted text-sm leading-relaxed">{active.body}</p>
        <Link
          href="/statistics"
          className="text-primary mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
        >
          Lihat analisis <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {insights.length > 1 && (
        <div className="mt-3 flex gap-1.5">
          {insights.map((insight, position) => (
            <button
              key={insight.title}
              type="button"
              onClick={() => setSlide(position)}
              aria-label={`Catatan ${position + 1}: ${insight.title}`}
              aria-pressed={position === slide}
              className="group flex h-11 flex-1 items-center md:h-6"
            >
              <span
                className={`h-1 w-full rounded-full transition-colors ${
                  position === slide
                    ? "bg-primary"
                    : "bg-border group-hover:bg-border-strong"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
