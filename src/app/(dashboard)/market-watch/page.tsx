"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuthStore } from "~/store/useAuthStore";
import { StockCandidates } from "~/components/market/stock-candidates";
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

const STORAGE_KEY = "fintrack:market-watchlist";
const DEFAULT_SYMBOLS = ["BBCA", "BBRI", "TLKM", "ANTM", "GOTO"];

function loadWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYMBOLS;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) &&
      parsed.every((symbol) => typeof symbol === "string")
      ? parsed
      : DEFAULT_SYMBOLS;
  } catch {
    return DEFAULT_SYMBOLS;
  }
}

export default function MarketWatchPage() {
  const token = useAuthStore((state) => state.token);
  const [watchlistError, setWatchlistError] = useState("");
  const [watchlistStorage, setWatchlistStorage] = useState("");
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const savingWatchlist = useRef(false);
  const [saving, setSaving] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadedToken(null);
    setSymbols([]);
    setWatchlistError("");
    setWatchlistStorage("");
    if (!token) return;
    async function load() {
      try {
        let list = await api.get<{ symbols: string[] | null; storage: string }>(
          "/market-watchlist/",
          token!,
        );
        if (cancelled) return;
        if (list.symbols === null) {
          list = await api.post("/market-watchlist/", token!, {
            symbols: loadWatchlist(),
          });
          if (cancelled) return;
          if (list.storage === "database")
            window.localStorage.removeItem(STORAGE_KEY);
        }
        setSymbols(list.symbols ?? []);
        setWatchlistStorage(list.storage);
        setLoadedToken(token);
      } catch {
        if (!cancelled)
          setWatchlistError(
            "Watchlist gagal dimuat. Muat ulang halaman untuk mencoba lagi.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

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

  async function changeSymbol(symbol: string, action: "add" | "remove") {
    if (!token || loadedToken !== token || savingWatchlist.current) return;
    const clean = symbol.trim().toUpperCase().replace(/\.JK$/, "");
    if (!clean || (action === "add" && symbols.includes(clean))) return;
    savingWatchlist.current = true;
    setSaving(true);
    setWatchlistError("");
    try {
      const list = await api.put<{ symbols: string[]; storage: string }>(
        "/market-watchlist/",
        token,
        { symbol: clean, action },
      );
      if (useAuthStore.getState().token !== token) return;
      setSymbols(list.symbols);
      if (action === "add") {
        setQuery("");
        setResults([]);
      }
    } catch {
      if (useAuthStore.getState().token === token)
        setWatchlistError(
          "Perubahan watchlist gagal disimpan. Silakan coba lagi.",
        );
    } finally {
      savingWatchlist.current = false;
      setSaving(false);
    }
  }

  const addSymbol = (symbol: string) => void changeSymbol(symbol, "add");
  const removeSymbol = (symbol: string) => void changeSymbol(symbol, "remove");

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
      {watchlistError && (
        <p role="alert" className="text-danger mb-4 text-sm">
          {watchlistError}
        </p>
      )}
      {watchlistStorage === "memory" && (
        <p className="text-warning mb-4 text-sm">
          Database belum dikonfigurasi. Watchlist sementara tidak bertahan
          setelah backend dimulai ulang.
        </p>
      )}
      {!loadedToken && !watchlistError && (
        <p className="text-text-secondary mb-4 text-sm">Memuat watchlist…</p>
      )}
      {saving && (
        <p role="status" className="text-text-secondary mb-4 text-sm">
          Menyimpan watchlist…
        </p>
      )}
      {/* Disclaimer */}
      <Card className="border-warning/30 bg-warning/5">
        <p className="text-text-secondary text-xs leading-relaxed">
          Analisis harga dan volume untuk menyusun daftar pantauan. Level
          historis tidak menjamin pergerakan berikutnya; periksa risiko dan aksi
          korporasi sebelum mengambil keputusan.
        </p>
      </Card>

      <StockCandidates
        token={token}
        symbols={symbols}
        onAdd={addSymbol}
        disabled={saving || loadedToken !== token}
      />

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
                  disabled={saving || loadedToken !== token}
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
                disabled={saving || loadedToken !== token}
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
