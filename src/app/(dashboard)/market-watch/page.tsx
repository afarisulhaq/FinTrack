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
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";

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
  const savingWatchlist = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const symbols = loadedToken === token ? members : [];
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const quoteRequest = useRef(0);
  const watchlistPager = useServerPagination<string, { symbols: string[] | null; storage: string }>(
    "/market-watchlist/", {}, { pageSize: 6 },
  );
  const searchPager = useServerPagination<SearchResult>(
    "/market-search", { q: searchText, assetClass: "stock" },
    { pageSize: 6, enabled: query.trim().length >= 2 && searchText === query },
  );
  const results = searchText === query ? searchPager.items : [];
  const searching = query.trim().length >= 2 && (searchText !== query || searchPager.loading);

  useEffect(() => {
    setLoadedToken(null);
    setMembers([]);
    setWatchlistError("");
    setWatchlistStorage("");
    savingWatchlist.current = null;
    setSaving(false);
  }, [token]);

  const watchlistSummary = watchlistPager.summary;
  const reloadWatchlist = watchlistPager.reload;
  useEffect(() => {
    const summary = watchlistSummary;
    if (!token || !summary) return;
    if (summary.symbols !== null) {
      setMembers(summary.symbols);
      setWatchlistStorage(summary.storage);
      setLoadedToken(token);
      return;
    }
    if (savingWatchlist.current === token) return;
    savingWatchlist.current = token;
    setSaving(true);
    void api.post<{ symbols: string[]; storage: string }>("/market-watchlist/", token, { symbols: loadWatchlist() })
      .then((list) => {
        if (useAuthStore.getState().token !== token) return;
        setMembers(list.symbols);
        setWatchlistStorage(list.storage);
        setLoadedToken(token);
        if (list.storage === "database") window.localStorage.removeItem(STORAGE_KEY);
        reloadWatchlist();
      })
      .catch(() => { if (useAuthStore.getState().token === token) setWatchlistError("Watchlist gagal dimuat. Coba muat ulang daftar."); })
      .finally(() => { if (savingWatchlist.current === token) { savingWatchlist.current = null; setSaving(false); } });
  }, [token, watchlistSummary, reloadWatchlist]);

  const fetchQuotes = useCallback(async () => {
    if (!token || watchlistPager.items.length === 0) { setLoading(false); return; }
    const id = ++quoteRequest.current;
    setLoading(true);
    try {
      const entries = await Promise.all(
        watchlistPager.items.map(async (symbol) => {
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
      if (id === quoteRequest.current) setQuotes(map);
    } finally {
      if (id === quoteRequest.current) setLoading(false);
    }
  }, [token, watchlistPager.items]);

  useEffect(() => {
    const requests = quoteRequest;
    void fetchQuotes();
    return () => { requests.current++; };
  }, [fetchQuotes]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function changeSymbol(symbol: string, action: "add" | "remove") {
    if (!token || loadedToken !== token || savingWatchlist.current === token) return;
    const clean = symbol.trim().toUpperCase().replace(/\.JK$/, "");
    if (!clean || (action === "add" && symbols.includes(clean))) return;
    savingWatchlist.current = token;
    setSaving(true);
    setWatchlistError("");
    try {
      const list = await api.put<{ symbols: string[]; storage: string }>(
        "/market-watchlist/",
        token,
        { symbol: clean, action },
      );
      if (useAuthStore.getState().token !== token) return;
      setMembers(list.symbols);
      watchlistPager.reload();
      if (action === "add") {
        setQuery("");
      }
    } catch {
      if (useAuthStore.getState().token === token)
        setWatchlistError(
          "Perubahan watchlist gagal disimpan. Silakan coba lagi.",
        );
    } finally {
      if (savingWatchlist.current === token) {
        savingWatchlist.current = null;
        setSaving(false);
      }
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
      <ServerListStatus {...watchlistPager} />
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
            <div className="bg-bg-elevated border-border absolute z-20 mt-1 w-full rounded-lg border p-2 shadow-lg">
              {searching && (
                <div className="text-text-muted px-3 py-2 text-xs">
                  Mencari…
                </div>
              )}
              {searchPager.items.map((r) => (
                <button
                  key={r.symbol}
                  disabled={saving || loadedToken !== token}
                  onClick={() => addSymbol(r.symbol)}
                  className="hover:bg-bg-surface focus-visible:ring-primary flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left focus-visible:ring-2"
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
              <Pagination {...searchPager} label="hasil pencarian saham" />
            </div>
          )}
          {searchPager.error && <p role="alert" className="text-danger mt-2 text-sm">{searchPager.error}</p>}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-text-primary text-lg font-semibold">Watchlist Saya</h2>
        <p className="text-text-secondary text-sm">{symbols.length} saham dipantau</p>
      </div>
      {/* Quote cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {watchlistPager.items.map((symbol) => {
          const q = quotes[symbol];
          const positive = (q?.changePercent ?? 0) >= 0;
          return (
            <Card key={symbol} className="relative">
              <button
                disabled={saving || loadedToken !== token}
                onClick={() => removeSymbol(symbol)}
                className="text-text-secondary hover:text-danger focus-visible:ring-primary absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2"
                aria-label={`Hapus ${symbol}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="mb-3 pr-10">
                <p className="text-text-primary text-lg font-bold">{symbol}</p>
                <p className="text-text-muted truncate text-xs">
                  {q?.name ?? (loading ? "Memuat…" : "Harga belum tersedia")}
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
      <Pagination {...watchlistPager} label="saham pantauan" />

      {watchlistPager.total === 0 && watchlistPager.initialized && !watchlistPager.loading && !watchlistPager.error && (
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
