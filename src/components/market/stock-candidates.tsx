"use client";

import { useState } from "react";
import type { StockAnalysis } from "../../../server/services/stock-screening";
import { formatCurrency } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Pagination } from "~/components/ui/pagination";
import { ServerPaginatedList } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";

type ScanSummary = {
  scanned: number;
  analyzedCount: number;
  generatedAt: string;
  signalCount: number;
  unavailableCount: number;
};
export function StockCandidates({
  token,
  symbols,
  onAdd,
  disabled,
}: {
  token: string | null;
  symbols: string[];
  onAdd: (symbol: string) => void;
  disabled: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const pager = useServerPagination<StockAnalysis, ScanSummary>(
    "/stock-screening",
    { showAll, search: query },
    { pageSize: 6, enabled: !!token },
  );
  const data = pager.summary;
  const loading = pager.loading;
  const error = pager.error;
  const signalCount = data?.signalCount ?? 0;
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-text-primary text-xl font-bold tracking-tight">
            Kandidat Pantauan
          </h2>
          <p className="text-text-secondary mt-1 max-w-2xl text-sm leading-relaxed">
            Bandingkan sinyal, level harga, dan risiko dari sesi harian lengkap.
            Indikasi akumulasi memakai harga dan volume, bukan broker summary.
          </p>
        </div>
        <Button
          className="h-11 shrink-0"
          variant="outline"
          loading={loading}
          onClick={pager.reload}
        >
          Perbarui Analisis
        </Button>
      </div>
      {data && (
        <div className="border-border mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-y py-4">
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary mr-2 text-2xl tabular-nums">
              {signalCount}
            </strong>
            saham dengan sinyal
          </p>
          <div className="text-text-secondary text-xs leading-relaxed">
            <p>
              {data.analyzedCount} dari {data.scanned} saham dianalisis
            </p>
            <p>
              Diperiksa{" "}
              {new Date(data.generatedAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB · Cache maksimal 15 menit
            </p>
          </div>
        </div>
      )}
      {loading && (
        <p role="status" className="text-text-secondary mt-4 text-sm">
          Mengambil riwayat dan menghitung indikator…
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
          {data
            ? " Hasil sebelumnya tetap ditampilkan; periksa tanggal sesi."
            : ""}
        </p>
      )}
      {data && (
        <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Input
                className="placeholder:text-text-secondary focus:border-text-primary focus:ring-text-primary h-11"
                aria-label="Cari kandidat saham"
                placeholder="Cari kode atau nama saham"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <label className="text-text-secondary flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                className="accent-primary focus-visible:outline-text-primary h-4 w-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                type="checkbox"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
              />
              Sertakan saham tanpa sinyal
            </label>
          </div>
          {pager.total === 0 && !loading && !error && (
            <p className="text-text-secondary mt-4 text-sm">
              {query.trim()
                ? "Tidak ada saham yang cocok. Coba kode atau nama lain."
                : "Belum ada saham yang memenuhi kriteria. Sertakan saham tanpa sinyal untuk memeriksa indikatornya."}
            </p>
          )}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {pager.items.map((item) => (
              <article
                key={item.symbol}
                className="border-border bg-bg-surface min-w-0 rounded-xl border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-text-primary text-lg font-bold tracking-tight">
                      {item.symbol}
                    </h3>
                    <p className="text-text-secondary mt-0.5 text-xs break-words">
                      {item.name}
                    </p>
                    <p className="text-text-primary mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                      {formatCurrency(item.price)}
                    </p>
                    <p className="text-text-secondary mt-1 text-xs">
                      Penutupan{" "}
                      {new Date(item.asOf).toLocaleDateString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
                    disabled={disabled || symbols.includes(item.symbol)}
                    onClick={() => onAdd(item.symbol)}
                  >
                    {symbols.includes(item.symbol)
                      ? "Sudah Dipantau"
                      : "Tambah Pantauan"}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.signals.length ? (
                    item.signals.map((signal) => (
                      <span
                        key={signal}
                        className="bg-primary/10 text-text-primary rounded-md px-2.5 py-1 text-xs font-semibold"
                      >
                        {signal}
                      </span>
                    ))
                  ) : (
                    <span className="text-text-secondary text-sm">
                      Belum memenuhi kriteria pantauan
                    </span>
                  )}
                </div>
                {item.reasons.map((reason) => (
                  <p key={reason} className="text-text-secondary mt-1 text-sm">
                    {reason}
                  </p>
                ))}
                <dl className="border-border bg-bg-elevated/50 mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border p-3 text-xs">
                  <div>
                    <dt className="text-text-secondary">Support 20 sesi</dt>
                    <dd className="text-text-primary mt-1 text-sm font-semibold tabular-nums">
                      {formatCurrency(item.support)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Resistance 20 sesi</dt>
                    <dd className="text-text-primary mt-1 text-sm font-semibold tabular-nums">
                      {formatCurrency(item.resistance)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">
                      Volume / rerata 20 sesi
                    </dt>
                    <dd className="text-text-primary mt-1 text-sm font-semibold tabular-nums">
                      {item.relativeVolume.toFixed(2)}×
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">
                      RSI14 (rerata sederhana)
                    </dt>
                    <dd className="text-text-primary mt-1 text-sm font-semibold tabular-nums">
                      {item.rsi.toFixed(1)}
                    </dd>
                  </div>
                </dl>
                {item.signals.length > 0 && (
                  <p className="text-text-secondary mt-2 text-xs">
                    Skenario perlu ditinjau ulang jika penutupan turun di bawah{" "}
                    {formatCurrency(item.invalidation)}.
                  </p>
                )}
                {item.risks.map((risk) => (
                  <p
                    key={risk}
                    className="text-text-secondary mt-2 text-xs leading-relaxed"
                  >
                    <strong className="text-text-primary">Risiko: </strong>
                    {risk}
                  </p>
                ))}
                <details className="text-text-secondary mt-2 text-xs">
                  <summary className="focus-visible:outline-text-primary flex min-h-11 cursor-pointer items-center rounded-md focus-visible:outline-2">
                    Rincian indikator
                  </summary>
                  <p className="mt-1 font-mono">
                    CMF20 {item.cmf.toFixed(2)} · OBV Δ5{" "}
                    {item.obvChange.toLocaleString("id-ID")} · ATR14{" "}
                    {item.atrPercent.toFixed(2)}% · Nilai transaksi rata-rata{" "}
                    {formatCurrency(item.turnover)}/hari · MA20{" "}
                    {formatCurrency(item.sma20)} · MA50{" "}
                    {formatCurrency(item.sma50)}
                  </p>
                </details>
              </article>
            ))}
          </div>
          <Pagination {...pager} label="kandidat" />
          {data.unavailableCount > 0 && (
            <details className="text-text-secondary mt-3 text-xs">
              <summary className="focus-visible:outline-text-primary flex min-h-11 cursor-pointer items-center rounded-md focus-visible:outline-2">
                {data.unavailableCount} saham belum dapat dianalisis
              </summary>
              <ServerPaginatedList<{ symbol: string; reason: string }>
                path="/stock-screening"
                query={{ view: "unavailable" }}
                label="saham belum dianalisis"
                pageSize={6}
              >
                {(items) => (
                  <div>
                    {items.map((item) => (
                      <p key={item.symbol} className="mt-2 break-words">
                        <strong>{item.symbol}:</strong> {item.reason}
                      </p>
                    ))}
                  </div>
                )}
              </ServerPaginatedList>
            </details>
          )}
        </>
      )}
      <details className="text-text-secondary border-border mt-4 border-t pt-3 text-xs">
        <summary className="focus-visible:outline-text-primary flex min-h-11 cursor-pointer items-center rounded-md focus-visible:outline-2">
          Metode penyaringan
        </summary>
        <p className="mt-2">
          Breakout: penutupan di atas high 20 sesi sebelumnya, volume minimal
          1,5× rerata. Akumulasi: CMF20 &gt; 0,1, OBV 5 sesi naik, volume 5 sesi
          minimal 1,2× periode 20 sesi sebelumnya, rentang harga maksimal 15%.
          Tren: MA20 &gt; MA50, harga maksimal 3% di atas MA20, RSI14 45–70.
          Kandidat membutuhkan nilai transaksi rata-rata minimal Rp1 miliar/hari
          dan data maksimal 7 hari. Batas ini merupakan aturan penyaringan,
          bukan probabilitas keuntungan.
        </p>
        <p className="mt-2">
          Sesi hari ini sebelum 16.30 WIB tidak dihitung. Nilai transaksi adalah
          estimasi harga penutupan × volume. Periksa aksi korporasi sebelum
          menggunakan level harga.
        </p>
        <a
          href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/OBV"
          target="_blank"
          rel="noreferrer"
          className="text-primary mt-2 inline-block underline"
        >
          Referensi indikator OBV
        </a>
      </details>
    </Card>
  );
}
