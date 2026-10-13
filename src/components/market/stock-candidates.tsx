"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { analyzeStock } from "../../../server/services/stock-screening";
import { api } from "~/lib/api";
import { formatCurrency } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

type Candidate = ReturnType<typeof analyzeStock>;
type Scan = {
  candidates: Candidate[];
  unavailable: { symbol: string; reason: string }[];
  scanned: number;
  generatedAt: string;
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
  const [data, setData] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!token) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const scan = await api.get<Scan>("/stock-screening", token);
      if (id === requestId.current) setData(scan);
    } catch (cause) {
      if (id === requestId.current)
        setError(
          cause instanceof Error ? cause.message : "Analisis gagal dimuat",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token]);
  const cancel = useCallback(() => {
    requestId.current++;
  }, []);
  useEffect(() => {
    setData(null);
    void load();
    return cancel;
  }, [load, cancel]);
  const rows =
    data?.candidates.filter((item) => showAll || item.signals.length > 0) ?? [];
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-text-primary font-semibold">Kandidat Pantauan</h3>
        <Button
          size="sm"
          variant="outline"
          loading={loading}
          onClick={() => void load()}
        >
          Perbarui Analisis
        </Button>
      </div>
      <p className="text-text-secondary text-sm">
        Penyaringan 20 saham BEI berdasarkan sesi harian lengkap. Indikasi
        akumulasi berasal dari harga dan volume; data broker summary belum
        tersedia.
      </p>
      {data && (
        <p className="text-text-muted mt-2 text-xs">
          {data.candidates.length}/{data.scanned} saham dianalisis · Diperiksa{" "}
          {new Date(data.generatedAt).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}{" "}
          WIB · Cache maksimal 15 menit
        </p>
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
          <label className="text-text-secondary mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            Tampilkan juga saham tanpa sinyal
          </label>
          {!rows.length && (
            <p className="text-text-secondary mt-4 text-sm">
              Belum ada saham yang memenuhi kriteria pada data ini. Lihat semua
              saham untuk memeriksa indikator dan risikonya.
            </p>
          )}
          <div className="divide-border mt-3 divide-y">
            {rows.map((item) => (
              <div key={item.symbol} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-text-primary font-semibold">
                      {item.symbol}{" "}
                      <span className="ml-2 font-mono tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                    </p>
                    <p className="text-text-secondary text-xs">
                      {item.name} · Penutupan{" "}
                      {new Date(item.asOf).toLocaleDateString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || symbols.includes(item.symbol)}
                    onClick={() => onAdd(item.symbol)}
                  >
                    {symbols.includes(item.symbol)
                      ? "Sudah Dipantau"
                      : "Tambah Pantauan"}
                  </Button>
                </div>
                <p className="text-text-primary mt-2 text-sm font-medium">
                  {item.signals.join(" · ") ||
                    "Belum memenuhi kriteria pantauan"}
                </p>
                {item.reasons.map((reason) => (
                  <p key={reason} className="text-text-secondary mt-1 text-sm">
                    {reason}
                  </p>
                ))}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-text-muted">Support 20 sesi</p>
                    <p className="text-text-primary font-mono">
                      {formatCurrency(item.support)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Resistance 20 sesi</p>
                    <p className="text-text-primary font-mono">
                      {formatCurrency(item.resistance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Volume / rerata 20 sesi</p>
                    <p className="text-text-primary font-mono">
                      {item.relativeVolume.toFixed(2)}×
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">RSI14 (rerata sederhana)</p>
                    <p className="text-text-primary font-mono">
                      {item.rsi.toFixed(1)}
                    </p>
                  </div>
                </div>
                {item.signals.length > 0 && (
                  <p className="text-text-secondary mt-2 text-xs">
                    Skenario perlu ditinjau ulang jika penutupan turun di bawah{" "}
                    {formatCurrency(item.invalidation)}.
                  </p>
                )}
                {item.risks.map((risk) => (
                  <p key={risk} className="text-warning mt-1 text-xs">
                    {risk}
                  </p>
                ))}
                <details className="text-text-secondary mt-2 text-xs">
                  <summary className="cursor-pointer py-1">
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
              </div>
            ))}
          </div>
          {data.unavailable.length > 0 && (
            <details className="text-text-secondary mt-3 text-xs">
              <summary className="cursor-pointer py-1">
                {data.unavailable.length} saham belum dapat dianalisis
              </summary>
              {data.unavailable.map((item) => (
                <p key={item.symbol} className="mt-1">
                  {item.symbol}: {item.reason}
                </p>
              ))}
            </details>
          )}
        </>
      )}
      <details className="text-text-secondary border-border mt-4 border-t pt-3 text-xs">
        <summary className="cursor-pointer py-1">Metode penyaringan</summary>
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
