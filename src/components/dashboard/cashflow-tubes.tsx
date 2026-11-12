"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "~/lib/utils";

export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
}

const RANGES = [
  { id: "3", label: "3 bulan", months: 3 },
  { id: "6", label: "6 bulan", months: 6 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/** Round the axis top up to a readable step, so labels are not Rp 1.347.882. */
function axisSteps(peak: number, count = 4) {
  if (peak <= 0) return [0];
  const raw = peak / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return Array.from({ length: count + 1 }, (_, index) => step * index);
}

/**
 * Money in and money out per month, as paired capsules. Both columns of a month
 * share one scale, so the space between the two fills is that month's margin.
 *
 * The range control changes what is drawn from the data already loaded, not
 * what is fetched: the summary arrives as a fixed window, and pretending
 * otherwise would show a spinner for a chart we already have.
 */
export function CashflowTubes({
  data,
  currency,
}: {
  data: CashflowPoint[];
  currency: string;
}) {
  const hasFlow = data.some((row) => row.income > 0 || row.expense > 0);
  const [range, setRange] = useState<RangeId>(data.length <= 3 ? "3" : "6");
  const months = RANGES.find((entry) => entry.id === range)?.months ?? 6;

  const visible = useMemo(() => data.slice(-months), [data, months]);
  const last = Math.max(visible.length - 1, 0);
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked === null ? last : Math.min(picked, last);

  const peak = Math.max(1, ...visible.flatMap((row) => [row.income, row.expense]));
  const steps = axisSteps(peak);
  const top = steps[steps.length - 1] || peak;

  const totalIn = visible.reduce((sum, row) => sum + row.income, 0);
  const totalOut = visible.reduce((sum, row) => sum + row.expense, 0);
  const kept = totalIn - totalOut;
  const current = visible[active];
  const activeRatio = current ? Math.min(current.income / top, 1) : 0;

  return (
    <section className="card flex min-w-0 flex-col">
      <div className="chead">
        <div className="chead__text">
          <h2>Uang masuk &amp; keluar</h2>
          <p>
            {range === "3" ? "Tiga bulan terakhir" : "Enam bulan terakhir"}
            {" · "}
            <Link href="/statistics" className="text-primary hover:underline">
              Statistik
            </Link>
          </p>
        </div>
        <div className="seg" role="group" aria-label="Rentang">
          {RANGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={range === entry.id}
              onClick={() => {
                setRange(entry.id);
                setPicked(null);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {!hasFlow ? (
        <p className="text-text-muted flex h-40 items-center justify-center text-center text-sm">
          Belum ada uang masuk atau keluar dalam periode ini.
        </p>
      ) : (
        <>
          <div className="tubes__sum">
            <span>
              <i className="tubes__key tubes__key--in" aria-hidden />
              Masuk <span>{formatCurrency(totalIn, true, currency)}</span>
            </span>
            <span>
              <i className="tubes__key tubes__key--out" aria-hidden />
              Keluar <span>{formatCurrency(totalOut, true, currency)}</span>
            </span>
            <span className="tubes__kept">
              Sisa <span>{formatCurrency(kept, true, currency)}</span>
            </span>
          </div>

          <div className="tubes__plot" style={{ height: 236 }}>
            <div className="tubes__grid" aria-hidden>
              {[...steps].reverse().map((step) => (
                <div key={step}>
                  <span>{formatCurrency(step, true, currency)}</span>
                </div>
              ))}
            </div>

            <div
              className="tubes__cols"
              role="listbox"
              aria-label="Uang masuk dan keluar per bulan"
              tabIndex={0}
              aria-activedescendant={`tube-${range}-${active}`}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setPicked(Math.min(last, active + 1));
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setPicked(Math.max(0, active - 1));
                }
              }}
            >
              {visible.map((row, index) => {
                const isActive = index === active;
                return (
                  <div
                    key={`${row.month}-${index}`}
                    id={`tube-${range}-${index}`}
                    role="option"
                    aria-selected={isActive}
                    aria-label={`${row.month}: masuk ${formatCurrency(row.income, false, currency)}, keluar ${formatCurrency(row.expense, false, currency)}`}
                    className={`tube ${isActive ? "is-hi" : ""}`}
                    onPointerEnter={() => setPicked(index)}
                    onClick={() => setPicked(index)}
                  >
                    <div className="tube__pair">
                      <span className="tube__sleeve">
                        <i
                          className="tube__fill tube__fill--in"
                          style={{ transform: `scaleY(${(row.income / top).toFixed(4)})` }}
                        />
                      </span>
                      <span className="tube__sleeve">
                        <i
                          className="tube__fill tube__fill--out"
                          style={{ transform: `scaleY(${(row.expense / top).toFixed(4)})` }}
                        />
                      </span>
                    </div>
                    <span className="tube__label">{row.month.slice(0, 3)}</span>
                    {isActive && (
                      <div
                        className="tube__flag"
                        style={{
                          bottom: `calc(2rem + (100% - 1.625rem) * ${activeRatio.toFixed(4)})`,
                        }}
                      >
                        <b>{formatCurrency(row.income, true, currency)}</b>
                        <small>keluar {formatCurrency(row.expense, true, currency)}</small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-text-muted mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span>
              {current
                ? `${current.month}: masuk ${formatCurrency(current.income, true, currency)}, keluar ${formatCurrency(current.expense, true, currency)}`
                : null}
            </span>
            <Link
              href="/statistics"
              className="text-primary inline-flex min-h-11 items-center gap-1 hover:underline md:min-h-0"
            >
              Rincian <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
