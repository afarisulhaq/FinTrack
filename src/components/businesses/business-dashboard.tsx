"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "~/lib/api";
import type { BusinessDashboard } from "~/lib/business-dashboard";
import { subscribeServerListInvalidation } from "~/lib/page-records";
import { formatCurrency } from "~/lib/utils";
import { useAuthStore } from "~/store/useAuthStore";

type Month = BusinessDashboard["monthly"][number];
type DashboardState = {
  scope: string;
  status: "loading" | "ready" | "error";
  data?: BusinessDashboard;
  error?: string;
};
type FilterOptions = {
  token: string;
  currentYear: number;
  years: number[];
  businesses: BusinessDashboard["businesses"];
};

const focusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary";
const selectClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-text-secondary bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary";
const incomeClass = "text-green-800 [.dark_&]:text-green-400";
const expenseClass = "text-red-700 [.dark_&]:text-red-400";
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const compactNumber = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function differenceClass(value: number) {
  return value < 0
    ? expenseClass
    : value > 0
      ? incomeClass
      : "text-text-primary";
}

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: Month }[];
}) {
  const month = payload?.[0]?.payload;
  if (!active || !month) return null;
  return (
    <div className="border-border-strong bg-bg-surface text-text-primary max-w-[min(18rem,80vw)] rounded-lg border p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold">{month.label}</p>
      <dl className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt>Pemasukan</dt>
          <dd className={`font-mono tabular-nums ${incomeClass}`}>
            {formatCurrency(month.income)}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt>Pengeluaran</dt>
          <dd className={`font-mono tabular-nums ${expenseClass}`}>
            {formatCurrency(month.expense)}
          </dd>
        </div>
        <div className="border-border flex flex-wrap justify-between gap-x-4 gap-y-1 border-t pt-1.5">
          <dt>Selisih kas</dt>
          <dd
            className={`font-mono font-semibold tabular-nums ${differenceClass(month.difference)}`}
          >
            {formatCurrency(month.difference)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function MonthlyChart({ data }: { data: BusinessDashboard }) {
  const patternId = useId().replace(/:/g, "");
  return (
    <div className="border-border bg-bg-surface min-w-0 rounded-xl border p-4 sm:p-5">
      <h3 className="text-text-primary font-semibold">
        Pemasukan dan pengeluaran per bulan
      </h3>
      <p className="text-text-secondary mt-1 text-xs">
        Januari sampai Desember {data.year}, dalam rupiah.
      </p>
      <ul
        className="text-text-secondary mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs"
        aria-label="Keterangan grafik"
      >
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-success h-3 w-3 rounded-sm" />
          Pemasukan (batang penuh)
        </li>
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <rect
              width="12"
              height="12"
              fill="var(--bg-surface)"
              stroke="var(--danger)"
            />
            <path
              d="M0 8 8 0M4 12 12 4M0 2 2 0M10 12 12 10"
              stroke="var(--danger)"
              strokeWidth="2"
            />
          </svg>
          Pengeluaran (arsir)
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-primary w-5 border-t-2 border-dashed"
          />
          Selisih kas (garis putus-putus)
        </li>
      </ul>
      <div
        className="mt-4 h-64 min-w-0 sm:h-72"
        role="img"
        aria-label={`Grafik kas bulanan tahun ${data.year}. Angka lengkap tersedia pada tabel bulanan di bawah.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data.monthly}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barGap={1}
            accessibilityLayer
          >
            <defs>
              <pattern
                id={patternId}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="var(--bg-surface)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--danger)"
                  strokeWidth="4"
                />
              </pattern>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={0}
            />
            <YAxis
              width={46}
              tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
              tickFormatter={(value: number) => compactNumber.format(value)}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="var(--text-secondary)" />
            <Tooltip
              content={<MonthlyTooltip />}
              cursor={{ fill: "var(--bg-elevated)" }}
            />
            <Bar
              dataKey="income"
              name="Pemasukan"
              fill="var(--success)"
              maxBarSize={14}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              name="Pengeluaran"
              fill={`url(#${patternId})`}
              stroke="var(--danger)"
              strokeWidth={1}
              maxBarSize={14}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="difference"
              name="Selisih kas"
              stroke="var(--primary)"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 2, fill: "var(--bg-surface)", strokeWidth: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="border-border mt-3 border-t pt-1">
        <summary
          className={`text-text-primary min-h-11 cursor-pointer content-center rounded-lg py-3 text-sm font-medium ${focusClass}`}
        >
          Lihat angka bulanan
        </summary>
        <div
          className={`max-w-full overflow-x-auto rounded-lg ${focusClass}`}
          role="region"
          aria-label={`Tabel kas bulanan ${data.year}, geser untuk semua kolom`}
          tabIndex={0}
        >
          <table className="w-full min-w-[580px] text-right text-xs tabular-nums">
            <caption className="text-text-secondary pb-3 text-left">
              Seluruh bulan {data.year}. Bulan tanpa transaksi ditampilkan
              dengan nilai nol.
            </caption>
            <thead className="border-border bg-bg-elevated text-text-secondary border-y">
              <tr>
                <th scope="col" className="p-2 text-left font-medium">
                  Bulan
                </th>
                <th scope="col" className="p-2 font-medium">
                  Pemasukan
                </th>
                <th scope="col" className="p-2 font-medium">
                  Pengeluaran
                </th>
                <th scope="col" className="p-2 font-medium">
                  Selisih kas
                </th>
                <th scope="col" className="p-2 font-medium">
                  Transaksi
                </th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((month) => (
                <tr key={month.month} className="border-border-subtle border-b">
                  <th
                    scope="row"
                    className="text-text-primary p-2 text-left font-medium"
                  >
                    {month.label}
                  </th>
                  <td className={`p-2 font-mono ${incomeClass}`}>
                    {formatCurrency(month.income)}
                  </td>
                  <td className={`p-2 font-mono ${expenseClass}`}>
                    {formatCurrency(month.expense)}
                  </td>
                  <td
                    className={`p-2 font-mono ${differenceClass(month.difference)}`}
                  >
                    {formatCurrency(month.difference)}
                  </td>
                  <td className="text-text-secondary p-2">
                    {month.transactionCount.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function DashboardContent({ data }: { data: BusinessDashboard }) {
  const dateFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: data.timezone,
  });
  return (
    <>
      {data.totals.transactionCount === 0 && (
        <div
          role="status"
          className="border-border bg-bg-elevated text-text-secondary rounded-lg border p-4 text-sm"
        >
          Belum ada transaksi untuk{" "}
          {data.businesses.find((business) => business.id === data.businessId)
            ?.name ?? "semua bisnis"}{" "}
          pada {data.year}. Pilih tahun atau bisnis lain, atau catat transaksi
          dari halaman bisnis.
        </div>
      )}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MonthlyChart data={data} />
        <aside
          className="border-border bg-bg-elevated min-w-0 rounded-xl border p-4 sm:p-5"
          aria-label={`Ringkasan kas ${data.year}`}
        >
          <h3 className="text-text-secondary text-sm font-medium">
            Selisih kas {data.year}
          </h3>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight break-words tabular-nums sm:text-3xl ${differenceClass(data.totals.difference)}`}
          >
            {formatCurrency(data.totals.difference)}
          </p>
          <p className="text-text-secondary mt-2 text-xs leading-relaxed">
            Pemasukan dikurangi pengeluaran tercatat. Bukan laba akuntansi
            karena belum memperhitungkan persediaan dan HPP.
          </p>
          <dl className="border-border mt-5 space-y-3 border-t pt-4 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-text-secondary">Pemasukan</dt>
              <dd
                className={`font-mono font-medium break-words tabular-nums ${incomeClass}`}
              >
                {formatCurrency(data.totals.income)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-text-secondary">Pengeluaran</dt>
              <dd
                className={`font-mono font-medium break-words tabular-nums ${expenseClass}`}
              >
                {formatCurrency(data.totals.expense)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Margin kas</dt>
              <dd className="text-text-primary font-mono font-medium tabular-nums">
                {data.totals.marginPercent === null
                  ? "Tidak tersedia"
                  : `${percent.format(data.totals.marginPercent)}%`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Jumlah transaksi</dt>
              <dd className="text-text-primary font-mono font-medium tabular-nums">
                {data.totals.transactionCount.toLocaleString("id-ID")}
              </dd>
            </div>
          </dl>
          <p className="text-text-secondary mt-4 text-xs leading-relaxed">
            Margin kas = selisih kas ÷ pemasukan.{" "}
            {data.totals.marginPercent === null
              ? "Belum dapat dihitung karena pemasukan nol."
              : "Dihitung dari periode dan bisnis yang dipilih."}
          </p>
        </aside>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section
          className="min-w-0"
          aria-labelledby="business-contributions-heading"
        >
          <h3
            id="business-contributions-heading"
            className="text-text-primary font-semibold"
          >
            Kontribusi bisnis
          </h3>
          <p className="text-text-secondary mt-1 text-xs">
            Porsi pemasukan pada {data.year}, sesuai filter bisnis.
          </p>
          <ul className="divide-border border-border mt-3 divide-y border-y">
            {data.contributions.map((business) => {
              const share =
                data.totals.income > 0
                  ? (business.income / data.totals.income) * 100
                  : null;
              return (
                <li key={business.id} className="py-3">
                  <Link
                    href={`/businesses/${business.id}`}
                    className={`text-text-primary flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg text-sm font-medium hover:underline ${focusClass}`}
                  >
                    <span className="min-w-0 break-words">{business.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(business.income)}
                    </span>
                  </Link>
                  <div className="text-text-secondary flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
                    <span>
                      {share === null
                        ? "Porsi belum dapat dihitung"
                        : `${percent.format(share)}% dari pemasukan`}
                    </span>
                    <span>
                      Selisih kas{" "}
                      <span
                        className={`font-mono tabular-nums ${differenceClass(business.difference)}`}
                      >
                        {formatCurrency(business.difference)}
                      </span>
                    </span>
                  </div>
                  {share !== null && (
                    <div
                      aria-hidden="true"
                      className="bg-bg-elevated mt-2 h-1 rounded-sm"
                    >
                      <div
                        className="bg-success h-1 rounded-sm"
                        style={{
                          width: `${Math.min(100, Math.max(0, share))}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="min-w-0" aria-labelledby="business-recent-heading">
          <h3
            id="business-recent-heading"
            className="text-text-primary font-semibold"
          >
            Transaksi terbaru
          </h3>
          <p className="text-text-secondary mt-1 text-xs break-words">
            Maksimal 6 transaksi dalam filter. Waktu {data.timezone}.
          </p>
          {data.recent.length === 0 ? (
            <p className="text-text-secondary mt-4 text-sm">
              Belum ada transaksi pada periode ini.
            </p>
          ) : (
            <ul className="divide-border border-border mt-3 divide-y border-y">
              {data.recent.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/businesses/${entry.businessId}`}
                    className={`hover:bg-bg-elevated block min-h-11 rounded-lg py-3 ${focusClass}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
                      <span className="text-text-primary min-w-0 font-medium break-words">
                        {entry.description ||
                          (entry.type === "income"
                            ? "Pemasukan"
                            : "Pengeluaran")}
                      </span>
                      <span
                        className={`font-mono font-medium tabular-nums ${entry.type === "income" ? incomeClass : expenseClass}`}
                      >
                        {entry.type === "income" ? "+" : "−"}
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                    <p className="text-text-secondary mt-1 text-xs break-words">
                      {entry.type === "income" ? "Pemasukan" : "Pengeluaran"} ·{" "}
                      {entry.businessName}
                      {entry.walletName ? ` · ${entry.walletName}` : ""}
                    </p>
                    <time
                      dateTime={entry.date}
                      className="text-text-secondary mt-1 block text-xs"
                    >
                      {dateFormat.format(new Date(entry.date))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function BusinessDashboardPanel() {
  const token = useAuthStore((state) => state.token);
  return <ScopedBusinessDashboard key={token ?? "signed-out"} token={token} />;
}

function ScopedBusinessDashboard({ token }: { token: string | null }) {
  const [year, setYear] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [state, setState] = useState<DashboardState | null>(null);
  const scope = JSON.stringify([token, year, businessId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const requestId = useRef(0);
  const filterOptions = options?.token === token ? options : null;
  const currentState = state?.scope === scope ? state : null;
  const data = currentState?.status === "ready" ? currentState.data : undefined;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (!token) return;
    setState({ scope, status: "loading" });
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (businessId) params.set("businessId", businessId);
    const query = params.toString();
    try {
      const response = await api.get<BusinessDashboard>(
        `/businesses/dashboard${query ? `?${query}` : ""}`,
        token,
      );
      if (id !== requestId.current || currentScope.current !== scope) return;
      setState({ scope, status: "ready", data: response });
      setOptions((previous) => ({
        token,
        currentYear: !year
          ? response.year
          : previous?.token === token
            ? previous.currentYear
            : response.year,
        years: response.years,
        businesses: response.businesses,
      }));
    } catch (error) {
      if (id !== requestId.current || currentScope.current !== scope) return;
      setState({
        scope,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat ringkasan bisnis.",
      });
    }
  }, [token, year, businessId, scope]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  useEffect(
    () =>
      subscribeServerListInvalidation("/businesses/dashboard", () => {
        void load();
      }),
    [load],
  );

  function resetFilters() {
    setYear("");
    setBusinessId("");
  }

  return (
    <section
      className="min-w-0 space-y-5"
      aria-labelledby="business-dashboard-heading"
      aria-busy={
        Boolean(token) && (!currentState || currentState.status === "loading")
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="business-dashboard-heading"
            className="text-text-primary text-lg font-semibold tracking-tight"
          >
            Arus kas bisnis
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Bandingkan pemasukan, pengeluaran, dan selisih kas sepanjang tahun.
          </p>
        </div>
        {filterOptions && (
          <div className="flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
            <label className="min-w-[100px] flex-1 space-y-1.5 sm:flex-none">
              <span className="text-text-secondary block text-xs font-medium">
                Tahun
              </span>
              <select
                aria-label="Tahun ringkasan bisnis"
                value={year || String(filterOptions.currentYear)}
                onChange={(event) => setYear(event.target.value)}
                className={selectClass}
              >
                {filterOptions.years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 basis-full space-y-1.5 sm:w-52 sm:basis-auto">
              <span className="text-text-secondary block text-xs font-medium">
                Bisnis
              </span>
              <select
                aria-label="Bisnis dalam ringkasan"
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                className={selectClass}
              >
                <option value="">Semua bisnis</option>
                {filterOptions.businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!year && !businessId}
              className={`border-text-secondary text-text-primary hover:bg-bg-elevated min-h-11 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
            >
              Reset filter
            </button>
          </div>
        )}
      </div>
      <p className="text-text-secondary text-xs leading-relaxed">
        Filter berlaku untuk grafik, ringkasan, kontribusi, dan transaksi
        terbaru di bagian ini. Kartu buku kas bisnis di bawah tetap menampilkan
        total sepanjang waktu.
      </p>
      {!token ? (
        <p role="status" className="text-text-secondary py-8 text-sm">
          Menunggu sesi akun untuk memuat arus kas bisnis.
        </p>
      ) : currentState?.status === "error" ? (
        <div
          role="alert"
          className="border-border bg-bg-surface rounded-xl border p-5"
        >
          <p className="text-text-primary font-medium">
            Arus kas bisnis belum dapat dimuat
          </p>
          <p className="text-text-secondary mt-1 text-sm break-words">
            {currentState.error}
          </p>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className={`border-text-secondary text-text-primary hover:bg-bg-elevated mt-4 min-h-11 rounded-lg border px-4 py-2 text-sm font-medium ${focusClass}`}
          >
            Coba lagi
          </button>
        </div>
      ) : !data ? (
        <p
          role="status"
          className="border-border bg-bg-surface text-text-secondary rounded-xl border px-5 py-12 text-sm"
        >
          Memuat arus kas bisnis dan transaksi pada periode terpilih...
        </p>
      ) : data.businesses.length === 0 ? (
        <p
          role="status"
          className="border-border bg-bg-surface text-text-secondary rounded-xl border p-5 text-sm"
        >
          Belum ada bisnis. Tambahkan bisnis untuk mulai mencatat pemasukan dan
          pengeluaran.
        </p>
      ) : (
        <DashboardContent data={data} />
      )}
    </section>
  );
}
