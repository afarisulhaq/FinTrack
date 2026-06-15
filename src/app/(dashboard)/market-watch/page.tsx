"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuthStore } from "~/store/useAuthStore";
import { api } from "~/lib/api";
import { formatCurrency } from "~/lib/utils";

interface MarketQuote {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}

type RecCategory = "buy" | "up" | "down";

interface Recommendation {
  quote: MarketQuote;
  category: RecCategory;
  rangePosition: number | null;
  signal: string;
}

const RECOMMENDATION_UNIVERSE: string[] = [
  "BBCA",
  "BBRI",
  "BMRI",
  "BBNI",
  "BRIS",
  "TLKM",
  "ISAT",
  "UNVR",
  "ICBP",
  "INDF",
  "MYOR",
  "SIDO",
  "ASII",
  "AUTO",
  "ANTM",
  "INCO",
  "MDKA",
  "ADRO",
  "PTBA",
  "ITMG",
  "BSDE",
  "PWON",
  "GOTO",
  "EMTK",
  "BUKA",
  "UNTR",
  "KAEF",
  "HMSP",
  "GGRM",
];

function classify(quote: MarketQuote): Recommendation | null {
  const { price, changePercent, fiftyTwoWeekHigh, fiftyTwoWeekLow } = quote;

  let rangePosition: number | null = null;
  if (
    fiftyTwoWeekHigh &&
    fiftyTwoWeekLow &&
    fiftyTwoWeekHigh > fiftyTwoWeekLow
  ) {
    rangePosition =
      ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
  }

  if (changePercent < -2) {
    return {
      quote,
      category: "down",
      rangePosition,
      signal: `Turun ${Math.abs(changePercent).toFixed(2)}% hari ini`,
    };
  }
  if (rangePosition !== null && rangePosition > 80) {
    return {
      quote,
      category: "down",
      rangePosition,
      signal: `Di ${rangePosition.toFixed(0)}% range 52W`,
    };
  }
  if (rangePosition !== null && rangePosition < 30) {
    return {
      quote,
      category: "buy",
      rangePosition,
      signal: `Diskon di ${rangePosition.toFixed(0)}% range 52W`,
    };
  }
  if (changePercent > 1) {
    return {
      quote,
      category: "up",
      rangePosition,
      signal: `Naik ${changePercent.toFixed(2)}% hari ini`,
    };
  }
  return null;
}

const STORAGE_KEY = "fintrack:market-watchlist";
const DEFAULT_SYMBOLS = ["BBCA", "BBRI", "TLKM", "ANTM", "GOTO"];

function loadWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYMBOLS;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_SYMBOLS;
  } catch {
    return DEFAULT_SYMBOLS;
  }
}

export default function MarketWatchPage() {
  const token = useAuthStore((state) => state.token);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (!token) return;
    setRecLoading(true);
    try {
      const entries = await Promise.allSettled(
        RECOMMENDATION_UNIVERSE.map((symbol) =>
          api.get<MarketQuote>(
            `/market-quote/${encodeURIComponent(symbol)}?assetClass=stock`,
            token,
          ),
        ),
      );
      const recs: Recommendation[] = [];
      for (const entry of entries) {
        if (entry.status === "fulfilled") {
          const r = classify(entry.value);
          if (r) recs.push(r);
        }
      }
      setRecommendations(recs);
    } finally {
      setRecLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  const buyRecs = useMemo(
    () =>
      recommendations
        .filter((r) => r.category === "buy")
        .sort((a, b) => (a.rangePosition ?? 50) - (b.rangePosition ?? 50)),
    [recommendations],
  );
  const upRecs = useMemo(
    () =>
      recommendations
        .filter((r) => r.category === "up")
        .sort((a, b) => b.quote.changePercent - a.quote.changePercent),
    [recommendations],
  );
  const downRecs = useMemo(
    () =>
      recommendations
        .filter((r) => r.category === "down")
        .sort((a, b) => a.quote.changePercent - b.quote.changePercent),
    [recommendations],
  );

  // Load watchlist from localStorage on mount
  useEffect(() => {
    setSymbols(loadWatchlist());
  }, []);

  // Persist watchlist
  useEffect(() => {
    if (symbols.length === 0) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  const fetchQuotes = useCallback(async () => {
    if (!token || symbols.length === 0) return;
    setLoading(true);
    try {
      const entries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote = await api.get<MarketQuote>(
              `/market-quote/${encodeURIComponent(symbol)}?assetClass=stock`,
              token,
            );
            return [symbol, quote] as const;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<string, MarketQuote> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setQuotes(map);
    } finally {
      setLoading(false);
    }
  }, [token, symbols]);

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  // Debounced symbol search
  useEffect(() => {
    if (query.trim().length < 2 || !token) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<SearchResult[]>(
          `/market-search?q=${encodeURIComponent(query)}&assetClass=stock`,
          token,
        );
        setResults(data.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, token]);

  function addSymbol(symbol: string) {
    const clean = symbol.trim().toUpperCase().replace(/\.JK$/, "");
    if (!clean || symbols.includes(clean)) return;
    setSymbols((prev) => [...prev, clean]);
    setQuery("");
    setResults([]);
  }

  function removeSymbol(symbol: string) {
    setSymbols((prev) => prev.filter((s) => s !== symbol));
    setQuotes((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  }

  return (
    <PageWrapper
      title="Market Watch"
      subtitle="Pantau pergerakan harga saham, range harian & 52 minggu untuk menentukan area beli"
      actions={
        <Button
          variant="outline"
          size="sm"
          loading={loading}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void fetchQuotes()}
        >
          Refresh
        </Button>
      }
    >
      {/* Disclaimer */}
      <Card className="border-warning/30 bg-warning/5">
        <p className="text-text-secondary text-xs leading-relaxed">
          <span className="text-warning font-semibold">Catatan:</span> Halaman
          ini menampilkan data harga pasar apa adanya untuk membantu kamu
          memantau saham. Ini{" "}
          <span className="font-semibold">bukan rekomendasi beli/jual</span>.
          Pergerakan harga besok tidak bisa diprediksi pasti — gunakan data
          range harga di bawah sebagai acuan area pantau, dan selalu lakukan
          analisis sendiri.
        </p>
      </Card>

      {/* Recommendations */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            <h3 className="text-text-primary font-semibold">
              Rekomendasi Hari Ini
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={recLoading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void fetchRecommendations()}
          >
            Refresh
          </Button>
        </div>
        <p className="text-text-muted mb-4 text-xs">
          Dihasilkan otomatis dari posisi harga dalam rentang 52 minggu dan
          momentum harian.{" "}
          <span className="text-warning font-semibold">
            Bukan saran investasi.
          </span>{" "}
          Selalu riset sendiri.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RecColumn
            title="Peluang Beli"
            icon={<TrendingUp className="h-4 w-4" />}
            borderClass="border-success/30"
            bgClass="bg-success/5"
            titleClass="text-success"
            recs={buyRecs}
            emptyText="Tidak ada saham di area diskon 52W saat ini"
          />
          <RecColumn
            title="Potensi Naik"
            icon={<TrendingUp className="h-4 w-4" />}
            borderClass="border-primary/30"
            bgClass="bg-primary/5"
            titleClass="text-primary"
            recs={upRecs}
            emptyText="Tidak ada saham dengan momentum naik kuat"
          />
          <RecColumn
            title="Potensi Turun"
            icon={<TrendingDown className="h-4 w-4" />}
            borderClass="border-danger/30"
            bgClass="bg-danger/5"
            titleClass="text-danger"
            recs={downRecs}
            emptyText="Tidak ada sinyal penurunan saat ini"
          />
        </div>
      </Card>

      {/* Add ticker */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Plus className="text-primary h-5 w-5" />
          <h3 className="text-text-primary font-semibold">Tambah Saham</h3>
        </div>
        <div className="relative">
          <Input
            placeholder="Cari kode saham (mis. BBCA, TLKM)…"
            leftIcon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) addSymbol(query);
            }}
          />
          {(results.length > 0 || searching) && (
            <div className="bg-bg-elevated border-border absolute z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
              {searching && (
                <div className="text-text-muted px-3 py-2 text-xs">
                  Mencari…
                </div>
              )}
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => addSymbol(r.symbol)}
                  className="hover:bg-bg-surface flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-text-primary truncate text-sm font-medium">
                      {r.symbol.replace(/\.JK$/, "")}
                    </p>
                    <p className="text-text-muted truncate text-xs">{r.name}</p>
                  </div>
                  <span className="text-text-muted ml-2 shrink-0 text-[10px]">
                    {r.exchange}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Quote cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {symbols.map((symbol) => {
          const q = quotes[symbol];
          const positive = (q?.changePercent ?? 0) >= 0;
          return (
            <Card key={symbol} className="relative">
              <button
                onClick={() => removeSymbol(symbol)}
                className="text-text-muted hover:text-danger absolute top-3 right-3 transition-colors"
                aria-label={`Hapus ${symbol}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="mb-3">
                <p className="text-text-primary text-lg font-bold">{symbol}</p>
                <p className="text-text-muted truncate text-xs">
                  {q?.name ?? "Memuat…"}
                </p>
              </div>

              {q ? (
                <>
                  <div className="flex items-end justify-between">
                    <p className="text-text-primary text-2xl font-bold">
                      {formatCurrency(q.price)}
                    </p>
                    <span
                      className={
                        "flex items-center gap-1 text-sm font-semibold " +
                        (positive ? "text-success" : "text-danger")
                      }
                    >
                      {positive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {positive ? "+" : ""}
                      {q.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  <div className="border-border mt-4 space-y-2 border-t pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Prev Close</span>
                      <span className="text-text-secondary">
                        {formatCurrency(q.previousClose)}
                      </span>
                    </div>
                    {q.dayLow != null && q.dayHigh != null && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Range Hari Ini</span>
                        <span className="text-text-secondary">
                          {formatCurrency(q.dayLow)} –{" "}
                          {formatCurrency(q.dayHigh)}
                        </span>
                      </div>
                    )}
                    {q.fiftyTwoWeekLow != null &&
                      q.fiftyTwoWeekHigh != null && (
                        <div className="flex justify-between">
                          <span className="text-text-muted">
                            Range 52 Minggu
                          </span>
                          <span className="text-text-secondary">
                            {formatCurrency(q.fiftyTwoWeekLow)} –{" "}
                            {formatCurrency(q.fiftyTwoWeekHigh)}
                          </span>
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className="text-text-muted flex h-24 items-center justify-center text-sm">
                  {loading ? "Memuat data…" : "Data tidak tersedia"}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {symbols.length === 0 && (
        <Card className="text-center">
          <Eye className="text-text-muted mx-auto mb-2 h-8 w-8" />
          <p className="text-text-muted text-sm">
            Belum ada saham dipantau. Tambahkan kode saham di atas.
          </p>
        </Card>
      )}
    </PageWrapper>
  );
}

// ── Recommendation helpers ──────────────────────────────────────────────────

function RecColumn({
  title,
  icon,
  borderClass,
  bgClass,
  titleClass,
  recs,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  borderClass: string;
  bgClass: string;
  titleClass: string;
  recs: Recommendation[];
  emptyText: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${borderClass} ${bgClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={titleClass}>{icon}</span>
          <span className={`text-sm font-semibold ${titleClass}`}>{title}</span>
        </div>
        <span className="text-text-muted text-xs font-medium">
          {recs.length}
        </span>
      </div>
      <div className="space-y-2">
        {recs.slice(0, 5).map((rec) => (
          <RecItem key={rec.quote.symbol} rec={rec} />
        ))}
        {recs.length === 0 && (
          <p className="text-text-muted px-1 py-3 text-center text-xs">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

function RecItem({ rec }: { rec: Recommendation }) {
  const { quote, rangePosition, signal } = rec;
  const positive = quote.changePercent >= 0;
  const clampedPos =
    rangePosition !== null ? Math.max(0, Math.min(100, rangePosition)) : null;
  return (
    <div className="bg-bg-surface rounded-lg p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-text-primary text-sm font-bold">
          {quote.symbol.replace(/\.JK$/, "")}
        </span>
        <span className="text-text-secondary text-xs">
          {formatCurrency(quote.price)}
        </span>
      </div>
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={
            positive
              ? "text-success text-xs font-semibold"
              : "text-danger text-xs font-semibold"
          }
        >
          {positive ? "+" : ""}
          {quote.changePercent.toFixed(2)}%
        </span>
        {clampedPos !== null && (
          <span className="text-text-muted text-[10px]">
            {clampedPos.toFixed(0)}% range
          </span>
        )}
      </div>
      {clampedPos !== null && (
        <div className="bg-bg-elevated relative mb-1.5 h-1 overflow-hidden rounded-full">
          <div className="from-success/30 via-warning/30 to-danger/30 absolute inset-0 bg-gradient-to-r" />
          <div
            className="border-primary absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 bg-white shadow-sm"
            style={{ left: `${clampedPos}%`, top: "-0.75px" }}
            aria-label={`Posisi ${clampedPos.toFixed(0)}% dari 52W low`}
          />
        </div>
      )}
      <p className="text-text-muted text-[10px] leading-tight">{signal}</p>
    </div>
  );
}
