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
const BAREKSA_FUND_LIST_URL =
  "https://www.bareksa.com/id/data/reksadana/daftar-reksadana";
const BAREKSA_EMAS_URL = "https://www.bareksa.com/bareksaemas";
const BAREKSA_CACHE_TTL_MS = 5 * 60 * 1000;
let bareksaFundCache: { funds: BareksaFund[]; expiresAt: number } | null = null;
let bareksaGoldCache: {
  products: BareksaGoldProduct[];
  expiresAt: number;
} | null = null;

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

  return [...bareksaGoldResults, ...bareksaResults, ...yahooResults].slice(
    0,
    10,
  );
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

export async function getYahooFinanceQuote(
  symbol: string,
  assetClass = "stock",
): Promise<MarketQuote | null> {
  const normalized = normalizeMarketSymbol(symbol, assetClass);
  if (!normalized) return null;

  const response = await fetch(
    `${YAHOO_CHART_URL}/${encodeURIComponent(normalized)}?interval=1d&range=1d`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 FinTrack/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  const data = (await response.json()) as YahooChartResult;
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  if (!price) return null;

  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
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

  const response = await fetch(
    `${YAHOO_CHART_URL}/${encodeURIComponent(normalized)}?interval=1d&range=5d`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 FinTrack/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  const data = (await response.json()) as YahooChartResult;
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  if (!price) return null;

  return {
    symbol: normalized,
    price,
    currency: meta.currency ?? "IDR",
    name: meta.longName ?? meta.shortName ?? meta.symbol ?? normalized,
  };
}
