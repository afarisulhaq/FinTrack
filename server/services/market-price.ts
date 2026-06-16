import fs from "fs";
import path from "path";

type YahooChartResult = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
        symbol?: string;
      };
    }>;
    error?: { description?: string } | null;
  };
};

type BareksaFund = {
  id?: string;
  pid?: string;
  code?: string;
  name?: string;
  ptype_name?: string;
  currency?: string;
  im?: { name?: string };
  nav?: { value?: string; date?: string };
};

type BareksaGoldProduct = {
  product_code: string;
  buy: string;
  sell: string;
  return: number;
  return_percent: number;
  price_date: string;
  return_one_year: number;
  return_one_year_percent: number;
  discount?: {
    percentage: number;
    buy: number;
    start_date: string;
    end_date: string;
    return: number;
    return_percent: number;
  };
};

type YahooSearchResult = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
    exchDisp?: string;
    currency?: string;
  }>;
};

export type MarketSearchResult = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
};

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search";
// Yahoo runs two frontends (query1 / query2). One of them is usually
// reachable even when the other is throttling or 401-gating a
// datacenter IP. We try them in order and use whichever answers first.
const YAHOO_CHART_HOSTS = [
  "https://query2.finance.yahoo.com",
  "https://query1.finance.yahoo.com",
];
// Optional authenticated session. Get these once by visiting
// https://finance.yahoo.com in a browser, opening DevTools → Network,
// and copying the `Cookie` request header and the `crumb` value from
// /v1/test/getcrumb. Without them, the public endpoints are often
// blocked from VPS IPs. See README for a one-shot fetch script.
const YAHOO_COOKIE = process.env.YAHOO_COOKIE?.trim();
const YAHOO_CRUMB = process.env.YAHOO_CRUMB?.trim();
const yahooAuthHeaders: Record<string, string> = {};
if (YAHOO_COOKIE) yahooAuthHeaders["Cookie"] = YAHOO_COOKIE;
if (YAHOO_CRUMB) {
  yahooAuthHeaders["X-Yahoo-Crumb"] = YAHOO_CRUMB;
  // Some endpoints take the crumb as a query param instead of a header.
  // The chart endpoint is fine with the header alone, so this is just
  // a safety net if Yahoo rotates the contract.
}
const BAREKSA_FUND_LIST_URL =
  "https://www.bareksa.com/id/data/reksadana/daftar-reksadana";
const BAREKSA_EMAS_URL = "https://www.bareksa.com/bareksaemas";
const BAREKSA_CACHE_TTL_MS = 5 * 60 * 1000;
let bareksaFundCache: { funds: BareksaFund[]; expiresAt: number } | null = null;
let bareksaGoldCache: {
  products: BareksaGoldProduct[];
  expiresAt: number;
} | null = null;

// ── In-memory cache for Yahoo Finance responses ────────────────────
// Yahoo's public endpoints (query1.finance.yahoo.com and friends)
// aggressively rate-limit per IP. Without a cache, opening the
// Investments page (one call per holding) or the Market Watch page
// (one call per symbol in the list, dispatched in parallel) hits
// `429 Too Many Requests` within minutes.
//
// We cache quotes for 1 minute, prices for 5 minutes, and search
// results for 30 seconds. On any fetch error — especially a 429 —
// we fall back to the stale cached value if one exists, so the UI
// keeps working through a rate-limit window. A global 5-minute
// cooldown after a 429 prevents us from retrying the dead endpoint
// over and over from concurrent requests (a 60s cooldown was too
// short and produced a tight retry loop while the rate-limit window
// was still active).
type CacheEntry<T> = { value: T; expiresAt: number };

const QUOTE_TTL_MS = 60 * 1000;
const PRICE_TTL_MS = 5 * 60 * 1000;
const SEARCH_TTL_MS = 30 * 1000;
const YAHOO_COOLDOWN_MS = 5 * 60 * 1000;
// Hard cap on a single Yahoo request — without this, a hung socket
// or slow DNS could leave the user staring at a spinner indefinitely.
const YAHOO_FETCH_TIMEOUT_MS = 10 * 1000;

const quoteCache = new Map<string, CacheEntry<MarketQuote | null>>();
type YahooPriceResult = {
  symbol: string;
  price: number;
  currency: string;
  name: string;
};
const priceCache = new Map<string, CacheEntry<YahooPriceResult | null>>();
const searchCache = new Map<string, CacheEntry<MarketSearchResult[]>>();

let yahooCooldownUntil = 0;

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): { value: T; stale: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return { value: entry.value, stale: entry.expiresAt <= Date.now() };
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function inYahooCooldown() {
  return Date.now() < yahooCooldownUntil;
}

function tripYahooCooldown() {
  yahooCooldownUntil = Date.now() + YAHOO_COOLDOWN_MS;
  console.warn(
    `[market-price] Yahoo Finance rate-limited; cooling down for ${YAHOO_COOLDOWN_MS / 1000}s`,
  );
}

// ── Persistent disk-backed cache ──────────────────────────────────
// In-memory cache is wiped on every container restart. The VPS that
// hosts production often can't reach Yahoo at all (Yahoo soft-blocks
// datacenter IPs), so a fresh deploy would otherwise show "Quote
// market tidak ditemukan" for every symbol until something
// eventually succeeds. The persistent cache writes every successful
// fetch to a JSON file in `./data/yahoo-cache.json`, so on boot we
// re-hydrate the in-memory cache from the last known good values.
//
// Set YAHOO_PERSISTENT_CACHE_PATH to override the file location
// (useful when mounting a volume in Docker).
const PERSISTENT_CACHE_PATH =
  process.env.YAHOO_PERSISTENT_CACHE_PATH ??
  path.join(process.cwd(), "data", "yahoo-cache.json");

// We only persist "real" results, not the null/stale entries — a
// null would just mask a real failure and the user would rather know.
const persistentQuoteCache = new Map<string, CacheEntry<MarketQuote>>();
const persistentPriceCache = new Map<string, CacheEntry<YahooPriceResult>>();
let persistentCacheLoaded = false;
let persistentCacheDirty = false;
let persistentWriteTimer: ReturnType<typeof setTimeout> | null = null;

function loadPersistentCache() {
  if (persistentCacheLoaded) return;
  persistentCacheLoaded = true;
  try {
    if (!fs.existsSync(PERSISTENT_CACHE_PATH)) return;
    const raw = fs.readFileSync(PERSISTENT_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      quotes?: Record<string, CacheEntry<MarketQuote>>;
      prices?: Record<string, CacheEntry<YahooPriceResult>>;
    };
    if (parsed.quotes) {
      for (const [k, v] of Object.entries(parsed.quotes)) {
        persistentQuoteCache.set(k, v);
      }
    }
    if (parsed.prices) {
      for (const [k, v] of Object.entries(parsed.prices)) {
        persistentPriceCache.set(k, v);
      }
    }
    console.log(
      `[market-price] loaded ${persistentQuoteCache.size} quotes, ${persistentPriceCache.size} prices from persistent cache at ${PERSISTENT_CACHE_PATH}`,
    );
  } catch (err) {
    console.warn(
      "[market-price] failed to load persistent cache:",
      err instanceof Error ? err.message : err,
    );
  }
}

function schedulePersistentWrite() {
  persistentCacheDirty = true;
  if (persistentWriteTimer) return;
  // Debounce — a busy page can produce dozens of writes per second.
  persistentWriteTimer = setTimeout(() => {
    persistentWriteTimer = null;
    if (!persistentCacheDirty) return;
    persistentCacheDirty = false;
    const snapshot = {
      quotes: Object.fromEntries(persistentQuoteCache),
      prices: Object.fromEntries(persistentPriceCache),
    };
    try {
      const dir = path.dirname(PERSISTENT_CACHE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        PERSISTENT_CACHE_PATH,
        JSON.stringify(snapshot),
        "utf-8",
      );
    } catch (err) {
      console.warn(
        "[market-price] failed to write persistent cache:",
        err instanceof Error ? err.message : err,
      );
    }
  }, 2000);
}

export const GOLD_PRODUCTS: Record<
  string,
  {
    name: string;
    exchange: string;
    currency: string;
    buyPrice: number;
    sellPrice: number;
  }
> = {
  "GOLD:PEGADAIAN": {
    name: "Pegadaian",
    exchange: "Pegadaian (Persero)",
    currency: "IDR",
    buyPrice: 2649000,
    sellPrice: 2516000,
  },
  "GOLD:TREASURY": {
    name: "Treasury",
    exchange: "PT Treasury",
    currency: "IDR",
    buyPrice: 2561019,
    sellPrice: 2472824,
  },
  "GOLD:INDOGOLD": {
    name: "Indogold",
    exchange: "PT Indogold Solusi Gadai",
    currency: "IDR",
    buyPrice: 2580000,
    sellPrice: 2500000,
  },
};

export function normalizeMarketSymbol(symbol: string, assetClass = "stock") {
  const value = symbol.trim().toUpperCase();
  if (!value) return value;
  if (assetClass === "stock" && /^[A-Z]{4}$/.test(value)) return `${value}.JK`;
  return value;
}

function parseBareksaFundData(html: string) {
  const marker = "var data = '";
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const dataStart = start + marker.length;
  const dataEnd = html.indexOf("';", dataStart);
  if (dataEnd < 0) return [];
  try {
    return JSON.parse(html.slice(dataStart, dataEnd)) as BareksaFund[];
  } catch {
    return [];
  }
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getBareksaFunds() {
  if (bareksaFundCache && bareksaFundCache.expiresAt > Date.now()) {
    return bareksaFundCache.funds;
  }

  const response = await fetch(BAREKSA_FUND_LIST_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 FinTrack/1.0",
    },
  });
  if (!response.ok) return bareksaFundCache?.funds ?? [];

  const funds = parseBareksaFundData(await response.text());
  if (funds.length > 0) {
    bareksaFundCache = {
      funds,
      expiresAt: Date.now() + BAREKSA_CACHE_TTL_MS,
    };
  }
  return funds;
}

async function searchBareksaMutualFunds(
  query: string,
): Promise<MarketSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return [];

  const funds = await getBareksaFunds();
  return funds
    .filter((fund) => {
      const haystack = normalizeSearchText(
        `${fund.name ?? ""} ${fund.code ?? ""} ${fund.im?.name ?? ""}`,
      );
      return normalizedQuery
        .split(" ")
        .every((part) => haystack.includes(part));
    })
    .slice(0, 10)
    .map((fund) => ({
      symbol: `BAREKSA:${fund.pid ?? fund.id}`,
      name: fund.name ?? fund.code ?? "Reksa Dana",
      type: "MUTUALFUND_ID",
      exchange: [fund.ptype_name, fund.im?.name].filter(Boolean).join(" · "),
      currency: fund.currency ?? "IDR",
    }));
}

async function getBareksaMutualFundPrice(symbol: string) {
  const fundId = symbol.replace(/^BAREKSA:/i, "");
  if (!fundId) return null;

  const funds = await getBareksaFunds();
  const fund = funds.find((item) => item.pid === fundId || item.id === fundId);
  const price = Number(fund?.nav?.value ?? 0);
  if (!fund || !price) return null;

  return {
    symbol: `BAREKSA:${fund.pid ?? fund.id}`,
    price,
    currency: fund.currency ?? "IDR",
    name: fund.name ?? fund.code ?? `Bareksa ${fundId}`,
  };
}

function parseBareksaEmasData(html: string): BareksaGoldProduct[] {
  const marker = '"emasData":';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const dataStart = start + marker.length;
  const dataEnd = html.indexOf("]", dataStart) + 1;
  if (dataEnd <= 0) return [];
  try {
    const parsed = JSON.parse(html.slice(dataStart, dataEnd));
    return parsed.data ?? [];
  } catch {
    return [];
  }
}

export async function getBareksaGoldPrices(): Promise<BareksaGoldProduct[]> {
  if (bareksaGoldCache && bareksaGoldCache.expiresAt > Date.now()) {
    return bareksaGoldCache.products;
  }

  const response = await fetch(BAREKSA_EMAS_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 FinTrack/1.0",
    },
  });
  if (!response.ok) return bareksaGoldCache?.products ?? [];

  const products = parseBareksaEmasData(await response.text());
  if (products.length > 0) {
    bareksaGoldCache = {
      products,
      expiresAt: Date.now() + BAREKSA_CACHE_TTL_MS,
    };
  }
  return products;
}

async function searchBareksaGold(query: string): Promise<MarketSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return [];

  const products = await getBareksaGoldPrices();
  if (products.length === 0) {
    // fallback: return predefined gold products if scraping failed
    return Object.entries(GOLD_PRODUCTS)
      .filter(([symbol]) => {
        const name = GOLD_PRODUCTS[symbol].name.toLowerCase();
        return (
          normalizeSearchText(name).includes(normalizedQuery) ||
          symbol.toLowerCase().includes(normalizedQuery)
        );
      })
      .map(([symbol, info]) => ({
        symbol,
        name: info.name,
        type: "GOLD",
        exchange: info.exchange,
        currency: info.currency,
      }));
  }

  const productNames: Record<string, string> = {
    EMASPEGADAIAN: "Pegadaian",
    EMASTREASURY: "Treasury",
    EMASINDOGOLD: "Indogold",
  };

  return products
    .filter((p) => {
      const name = productNames[p.product_code] ?? p.product_code;
      const haystack = normalizeSearchText(`${name} ${p.product_code}`);
      return normalizedQuery
        .split(" ")
        .every((part) => haystack.includes(part));
    })
    .map((p) => {
      const name = productNames[p.product_code] ?? p.product_code;
      const symbol = `GOLD:${p.product_code.replace(/^EMAS/, "")}`;
      return {
        symbol,
        name,
        type: "GOLD",
        exchange: GOLD_PRODUCTS[symbol]?.exchange ?? "Bareksa Emas",
        currency: "IDR",
      };
    });
}

async function getBareksaGoldPrice(symbol: string) {
  const codeMap: Record<string, string> = {
    "GOLD:PEGADAIAN": "EMASPEGADAIAN",
    "GOLD:TREASURY": "EMASTREASURY",
    "GOLD:INDOGOLD": "EMASINDOGOLD",
  };
  const info = GOLD_PRODUCTS[symbol.toUpperCase()];
  if (!info) return null;

  // Try to get updated prices from Bareksa
  const products = await getBareksaGoldPrices().catch(() => []);
  if (products.length > 0) {
    const productCode = codeMap[symbol.toUpperCase()];
    const product = products.find((p) => p.product_code === productCode);
    if (product) {
      const price = Number(product.buy.replace(/\./g, ""));
      if (price) {
        return {
          symbol: symbol.toUpperCase(),
          price,
          currency: info.currency,
          name: info.name,
        };
      }
    }
  }

  // Fallback to hardcoded price
  if (info.buyPrice) {
    return {
      symbol: symbol.toUpperCase(),
      price: info.buyPrice,
      currency: info.currency,
      name: info.name,
    };
  }

  return null;
}

export async function searchYahooFinance(
  query: string,
  assetClass = "stock",
): Promise<MarketSearchResult[]> {
  const value = query.trim();
  if (value.length < 2) return [];

  const cacheKey = `${assetClass}:${value.toLowerCase()}`;
  const cached = readCache(searchCache, cacheKey);
  if (cached && !cached.stale) return cached.value;

  // If Yahoo is in cooldown, return whatever we had cached (stale is
  // fine for a search-as-you-type box) or an empty result.
  if (inYahooCooldown()) {
    return cached?.value ?? [];
  }

  const params = new URLSearchParams({
    q: value,
    quotesCount: "10",
    newsCount: "0",
    enableFuzzyQuery: "true",
    quotesQueryId: "tss_match_phrase_query",
  });
  const [yahooResponse, bareksaResults, bareksaGoldResults] = await Promise.all(
    [
      fetch(`${YAHOO_SEARCH_URL}?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 FinTrack/1.0",
        },
      }).catch(() => null),
      searchBareksaMutualFunds(value).catch(() => []),
      searchBareksaGold(value).catch(() => []),
    ],
  );

  // If Yahoo failed and we have a stale cached search, prefer it over
  // returning just the Bareksa results (which usually aren't what the
  // user is searching for when assetClass=stock).
  if ((!yahooResponse || !yahooResponse.ok) && cached) {
    if (yahooResponse?.status === 429) tripYahooCooldown();
    return cached.value;
  }
  if (yahooResponse?.status === 429) tripYahooCooldown();

  const data: YahooSearchResult = yahooResponse?.ok
    ? ((await yahooResponse.json()) as YahooSearchResult)
    : {};
  const normalizedQuery = value.toUpperCase();
  const preferredTypes: Record<string, string[]> = {
    stock: ["EQUITY"],
    crypto: ["CRYPTOCURRENCY"],
    "mutual-fund": ["MUTUALFUND", "ETF"],
    bond: ["BOND"],
  };
  const preferred = preferredTypes[assetClass] ?? [];

  const yahooResults = (data.quotes ?? [])
    .filter((quote) => Boolean(quote.symbol))
    .map((quote) => ({
      symbol: String(quote.symbol).toUpperCase(),
      name: quote.longname ?? quote.shortname ?? String(quote.symbol),
      type: quote.quoteType ?? "",
      exchange: quote.exchDisp ?? quote.exchange ?? "",
      currency: quote.currency ?? "",
    }))
    .sort((a, b) => {
      const aExact = Number(a.symbol === normalizedQuery);
      const bExact = Number(b.symbol === normalizedQuery);
      if (aExact !== bExact) return bExact - aExact;

      const aStartsWith = Number(a.symbol.startsWith(normalizedQuery));
      const bStartsWith = Number(b.symbol.startsWith(normalizedQuery));
      if (aStartsWith !== bStartsWith) return bStartsWith - aStartsWith;

      const aPreferred = Number(preferred.includes(a.type));
      const bPreferred = Number(preferred.includes(b.type));
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;

      if (assetClass === "stock") {
        return (
          Number(b.symbol.endsWith(".JK")) - Number(a.symbol.endsWith(".JK"))
        );
      }
      return 0;
    });

  const combined = [
    ...bareksaGoldResults,
    ...bareksaResults,
    ...yahooResults,
  ].slice(0, 10);
  writeCache(searchCache, cacheKey, combined, SEARCH_TTL_MS);
  return combined;
}

export type MarketQuote = {
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
};

// Issue one Yahoo chart request, falling through the list of hosts
// until one answers. Returns the raw Response on the first 2xx, or
// null if every host is unreachable. Non-2xx responses (401, 403,
// 429) are returned as-is so the caller can decide what to do —
// 401/403 trigger the next host, 429 trips the global cooldown.
async function fetchYahooChart(
  symbol: string,
  range: string,
): Promise<{ host: string; response: Response } | null> {
  const lastAttemptStatus: number[] = [];
  for (const host of YAHOO_CHART_HOSTS) {
    const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 FinTrack/1.0",
          ...yahooAuthHeaders,
        },
        signal: AbortSignal.timeout(YAHOO_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn(
        `[market-price] fetch error from ${host} for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    if (response.ok) return { host, response };
    lastAttemptStatus.push(response.status);
    // 401/403 means the host is up but won't talk to us. Try the
    // next host — query2 often has looser datacenter rules than
    // query1.
    // 429 trips the global cooldown and stops further attempts; the
    // caller will short-circuit and reuse the cache.
    if (response.status === 429) {
      return { host, response };
    }
  }
  if (lastAttemptStatus.length > 0) {
    console.warn(
      `[market-price] all Yahoo hosts failed for ${symbol}; last statuses: ${lastAttemptStatus.join(",")}`,
    );
  }
  return null;
}

export async function getYahooFinanceQuote(
  symbol: string,
  assetClass = "stock",
): Promise<MarketQuote | null> {
  const normalized = normalizeMarketSymbol(symbol, assetClass);
  if (!normalized) return null;

  // Hydrate the persistent cache lazily so the very first call after
  // boot already sees the last known good values from the JSON file.
  loadPersistentCache();

  const cacheKey = `${assetClass}:${normalized}`;
  const cached = readCache(quoteCache, cacheKey);
  if (cached && !cached.stale) return cached.value;

  // Don't even attempt the network if Yahoo just rate-limited us.
  // The stale in-memory cache (if any) is the best we can do.
  if (inYahooCooldown()) {
    if (cached) return cached.value;
    // Fall back to whatever the persistent cache has — even if it's
    // hours old, the user still sees a number rather than a 404.
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) return persisted.value;
    return null;
  }

  const attempt = await fetchYahooChart(normalized, "1d");
  if (!attempt) {
    // Network/parse errors from every host. Serve stale cache if we
    // have one, otherwise try the persistent cache.
    if (cached) {
      console.warn(
        `[market-price] quote fetch failed for ${cacheKey}; serving stale in-memory cache`,
      );
      return cached.value;
    }
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) {
      console.warn(
        `[market-price] quote fetch failed for ${cacheKey}; serving persistent cache`,
      );
      return persisted.value;
    }
    return null;
  }

  const { host, response } = attempt;

  if (response.status === 429) {
    tripYahooCooldown();
    if (cached) return cached.value;
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) return persisted.value;
    // No cache to fall back on. Returning null (rather than throwing)
    // makes the route respond with a clean 404 "Quote market tidak
    // ditemukan" instead of a 502 carrying the raw upstream error.
    console.warn(
      `[market-price] quote fetch 429 for ${cacheKey} from ${host}; no cache, returning null`,
    );
    return null;
  }

  // 401/403 — the host refused us, but `fetchYahooChart` already
  // tried the next host. If we got here, every host refused.
  if (response.status === 401 || response.status === 403) {
    if (cached) return cached.value;
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) {
      console.warn(
        `[market-price] quote fetch ${response.status} for ${cacheKey} from ${host}; serving persistent cache (set YAHOO_COOKIE + YAHOO_CRUMB to authenticate)`,
      );
      return persisted.value;
    }
    return null;
  }

  if (!response.ok) {
    if (cached) return cached.value;
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) return persisted.value;
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  let data: YahooChartResult;
  try {
    data = (await response.json()) as YahooChartResult;
  } catch (err) {
    if (cached) return cached.value;
    const persisted = persistentQuoteCache.get(cacheKey);
    if (persisted) return persisted.value;
    throw err;
  }
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) {
    writeCache(quoteCache, cacheKey, null, QUOTE_TTL_MS);
    return null;
  }

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  if (!price) {
    writeCache(quoteCache, cacheKey, null, QUOTE_TTL_MS);
    return null;
  }

  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  const result: MarketQuote = {
    symbol: normalized,
    name: meta.longName ?? meta.shortName ?? meta.symbol ?? normalized,
    currency: meta.currency ?? "IDR",
    price,
    previousClose,
    change,
    changePercent,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
  };
  writeCache(quoteCache, cacheKey, result, QUOTE_TTL_MS);
  // Mirror successful results to the persistent cache (without the
  // short TTL — persistent entries are just "last known good"). We
  // give them a long expiry so they survive cooldown windows.
  persistentQuoteCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  schedulePersistentWrite();
  return result;
}

export async function getYahooFinancePrice(
  symbol: string,
  assetClass = "stock",
) {
  if (assetClass === "mutual-fund" && /^BAREKSA:/i.test(symbol)) {
    return getBareksaMutualFundPrice(symbol);
  }

  if (/^GOLD:/i.test(symbol)) {
    return getBareksaGoldPrice(symbol);
  }

  const normalized = normalizeMarketSymbol(symbol, assetClass);
  if (!normalized) return null;

  loadPersistentCache();

  const cacheKey = `${assetClass}:${normalized}`;
  const cached = readCache(priceCache, cacheKey);
  if (cached && !cached.stale) return cached.value;

  if (inYahooCooldown()) {
    if (cached) return cached.value;
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) return persisted.value;
    return null;
  }

  const attempt = await fetchYahooChart(normalized, "5d");
  if (!attempt) {
    if (cached) {
      console.warn(
        `[market-price] price fetch failed for ${cacheKey}; serving stale in-memory cache`,
      );
      return cached.value;
    }
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) {
      console.warn(
        `[market-price] price fetch failed for ${cacheKey}; serving persistent cache`,
      );
      return persisted.value;
    }
    return null;
  }

  const { host, response } = attempt;

  if (response.status === 429) {
    tripYahooCooldown();
    if (cached) return cached.value;
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) return persisted.value;
    console.warn(
      `[market-price] price fetch 429 for ${cacheKey} from ${host}; no cache, returning null`,
    );
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    if (cached) return cached.value;
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) return persisted.value;
    return null;
  }

  if (!response.ok) {
    if (cached) return cached.value;
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) return persisted.value;
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  let data: YahooChartResult;
  try {
    data = (await response.json()) as YahooChartResult;
  } catch (err) {
    if (cached) return cached.value;
    const persisted = persistentPriceCache.get(cacheKey);
    if (persisted) return persisted.value;
    throw err;
  }
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) {
    writeCache(priceCache, cacheKey, null, PRICE_TTL_MS);
    return null;
  }

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  if (!price) {
    writeCache(priceCache, cacheKey, null, PRICE_TTL_MS);
    return null;
  }

  const result: YahooPriceResult = {
    symbol: normalized,
    price,
    currency: meta.currency ?? "IDR",
    name: meta.longName ?? meta.shortName ?? meta.symbol ?? normalized,
  };
  writeCache(priceCache, cacheKey, result, PRICE_TTL_MS);
  persistentPriceCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  schedulePersistentWrite();
  return result;
}

// ── Startup pre-warm for common IDX symbols ────────────────────────
// Calling this once at server boot does a background sweep over a
// short list of the most-watched IDX tickers. If Yahoo is reachable
// (or the operator has set YAHOO_COOKIE + YAHOO_CRUMB), the
// persistent cache is seeded with fresh data so the first browser
// request resolves instantly. If Yahoo is blocked, the sweep silently
// fails and the next request will fall through to whatever the
// previous boot left in the persistent cache.
const IDX_DEFAULT_SYMBOLS: Array<{ symbol: string; assetClass: string }> = [
  { symbol: "BBCA.JK", assetClass: "stock" },
  { symbol: "BBRI.JK", assetClass: "stock" },
  { symbol: "BMRI.JK", assetClass: "stock" },
  { symbol: "BBNI.JK", assetClass: "stock" },
  { symbol: "TLKM.JK", assetClass: "stock" },
  { symbol: "ASII.JK", assetClass: "stock" },
  { symbol: "UNVR.JK", assetClass: "stock" },
  { symbol: "ICBP.JK", assetClass: "stock" },
  { symbol: "INDF.JK", assetClass: "stock" },
  { symbol: "KLBF.JK", assetClass: "stock" },
  { symbol: "ANTM.JK", assetClass: "stock" },
  { symbol: "MDKA.JK", assetClass: "stock" },
  { symbol: "PTBA.JK", assetClass: "stock" },
  { symbol: "AMMN.JK", assetClass: "stock" },
  { symbol: "BRPT.JK", assetClass: "stock" },
  { symbol: "^JKSE", assetClass: "index" },
];

let prewarmStarted = false;
export async function prewarmCommonSymbols(): Promise<void> {
  if (prewarmStarted) return;
  prewarmStarted = true;

  loadPersistentCache();
  if (inYahooCooldown()) {
    console.log(
      "[market-price] prewarm skipped: Yahoo is in cooldown, using existing persistent cache",
    );
    return;
  }
  if (IDX_DEFAULT_SYMBOLS.length === 0) return;

  console.log(
    `[market-price] prewarming ${IDX_DEFAULT_SYMBOLS.length} common symbols...`,
  );
  let ok = 0;
  let failed = 0;
  await Promise.allSettled(
    IDX_DEFAULT_SYMBOLS.map(async ({ symbol, assetClass }) => {
      const result = await getYahooFinanceQuote(symbol, assetClass).catch(
        () => null,
      );
      if (result) ok++;
      else failed++;
    }),
  );
  console.log(
    `[market-price] prewarm complete: ${ok} ok, ${failed} failed (persistent cache now has ${persistentQuoteCache.size} quotes)`,
  );
}
