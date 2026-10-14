"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Wallet,
  LoaderCircle,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardBody } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Modal } from "~/components/ui/modal";
import { StatCard } from "~/components/ui/stat-card";
import { AmountInput } from "~/components/ui/amount-input";
import { Input } from "~/components/ui/input";
import { WalletPicker } from "~/components/ui/wallet-select";
import { Pagination } from "~/components/ui/pagination";
import { useServerPagination } from "~/lib/use-server-pagination";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { PortfolioPieChart } from "~/components/charts/portfolio-pie-chart";
import { PortfolioPerformanceChart } from "~/components/charts/portfolio-performance-chart";
import { useFinanceStore } from "~/store/useFinanceStore";
import { useAuthStore } from "~/store/useAuthStore";
import { api } from "~/lib/api";
import { formatCurrency } from "~/lib/utils";
import { invalidateServerLists } from "~/lib/page-records";
import type { AssetClass, Investment } from "~/lib/types";
import { flattenWalletTree, walletOptionLabel } from "~/lib/wallets";

type MarketSearchResult = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: "Saham",
  crypto: "Crypto",
  gold: "Emas",
  "mutual-fund": "Reksa Dana",
  bond: "Obligasi",
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  stock: "#FFD147",
  crypto: "#f59e0b",
  gold: "#d97706",
  "mutual-fund": "#22c55e",
  bond: "#38bdf8",
};

const ASSET_CLASS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: "stock", label: "Saham" },
  { value: "crypto", label: "Crypto" },
  { value: "gold", label: "Emas" },
  { value: "mutual-fund", label: "Reksa Dana" },
  { value: "bond", label: "Obligasi" },
];

const BROKER_OPTIONS = [
  "Stockbit",
  "Ajaib",
  "Bibit",
  "Bareksa",
  "Pintu",
  "Indodax",
  "Pegadaian",
  "Treasury",
  "Indogold",
  "Lainnya",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const addInvestment = useFinanceStore((s) => s.addInvestment);
  const updateInvestment = useFinanceStore((s) => s.updateInvestment);
  const deleteInvestment = useFinanceStore((s) => s.deleteInvestment);
  const wallets = useFinanceStore((s) => s.wallets);
  const walletLabels = useMemo(
    () => new Map(flattenWalletTree(wallets).map((wallet) => [wallet.id, walletOptionLabel(wallet, wallets)])),
    [wallets],
  );
  const token = useAuthStore((s) => s.token);

  const [ihsg, setIhsg] = useState<{
    price: number;
    changePercent: number;
  } | null>(null);

  const [activeBroker, setActiveBroker] = useState("Semua");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [portfolioRefreshing, setPortfolioRefreshing] = useState(false);
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [debouncedSymbol, setDebouncedSymbol] = useState("");
  const [priceStatus, setPriceStatus] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null);
  const symbolFieldRef = useRef<HTMLDivElement>(null);
  const autoRefreshStarted = useRef(false);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    assetClass: "stock" as AssetClass,
    broker: "Stockbit",
    walletId: "",
    quantity: "",
    avgBuyPrice: "",
    currentPrice: "",
    buyFee: "",
  });

  // Sold filter & sell modal
  const [showSold, setShowSold] = useState(false);
  const [sellModal, setSellModal] = useState<{
    open: boolean;
    investment: Investment | null;
  }>({ open: false, investment: null });
  const [sellPrice, setSellPrice] = useState("");
  const [sellFee, setSellFee] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [sellWalletId, setSellWalletId] = useState("");

  const investmentPager = useServerPagination<
    Investment,
    {
      brokers: string[];
      totalValue: number;
      totalPL: number;
      totalCost: number;
      totalRealizedPL: number;
      pieData: { name: string; value: number; color: string }[];
      activeCount: number;
      soldCount: number;
    }
  >("/investments", {
    broker: activeBroker === "Semua" ? undefined : activeBroker,
    sold: showSold,
  }, { resource: "investments" });
  const {
    totalValue = 0,
    totalPL = 0,
    totalCost = 0,
    totalRealizedPL = 0,
    pieData = [],
    activeCount = 0,
    soldCount = 0,
  } = investmentPager.summary ?? {};
  const brokers = useMemo(
    () => ["Semua", ...new Set([...BROKER_OPTIONS, ...(investmentPager.summary?.brokers ?? [])])],
    [investmentPager.summary?.brokers],
  );
  const performancePager = useServerPagination<
    never,
    { series: { id: string; name: string; value: number; pl: number }[] }
  >("/investments", { view: "performance" });
  const symbolPager = useServerPagination<MarketSearchResult>("/market-search", { q: form.symbol.trim(), assetClass: form.assetClass }, {
    enabled: showModal && symbolSearchOpen && form.symbol.trim().length >= 2 && debouncedSymbol === form.symbol,
  });
  const symbolSuggestions = symbolPager.items;
  const symbolSearching = symbolPager.loading;
  const symbolSearchStatus = symbolPager.error || (symbolPager.initialized && !symbolSearching && !symbolSuggestions.length ? "Tidak ada hasil simbol." : null);

  const totalPLPct =
    totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : "0";


  const resetForm = () => {
    setEditing(null);
    setPriceStatus(null);
    setForm({
      name: "",
      symbol: "",
      assetClass: "stock",
      broker: "Stockbit",
      walletId: "",
      quantity: "",
      avgBuyPrice: "",
      currentPrice: "",
      buyFee: "",
    });
  };

  const normalizeSymbol = (symbol: string) => {
    return symbol.trim().toUpperCase().replace(/\.JK$/, "");
  };

  const displaySymbol = (symbol: string) => {
    return symbol.replace(/\.JK$/, "");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSymbol(form.symbol), 350);
    return () => window.clearTimeout(timer);
  }, [form.symbol]);

  async function fetchMarketPrice(
    symbolInput = form.symbol,
    assetClass = form.assetClass,
  ) {
    const symbol = normalizeSymbol(symbolInput);
    if (!symbol || !token) {
      setPriceStatus(
        "Login via backend diperlukan untuk ambil harga real-time.",
      );
      return null;
    }
    setPriceLoading(true);
    setPriceStatus(null);
    try {
      const result = await api.get<{
        symbol: string;
        price: number;
        currency: string;
        name: string;
      }>(
        `/market-price/${encodeURIComponent(symbol)}?assetClass=${assetClass}`,
        token,
      );
      setForm((current) => ({
        ...current,
        symbol: result.symbol,
        name: current.name || result.name,
        currentPrice: String(result.price),
      }));
      setPriceStatus(`Harga Yahoo Finance: ${formatCurrency(result.price)}`);
      return result.price;
    } catch (error) {
      setPriceStatus(
        error instanceof Error
          ? error.message
          : "Gagal ambil harga dari Yahoo Finance.",
      );
      return null;
    } finally {
      setPriceLoading(false);
    }
  }

  async function refreshInvestmentPrice(inv: Investment, reload = true) {
    if (!token) return false;
    try {
      const result = await api.get<{ price: number }>(
        `/market-price/${encodeURIComponent(inv.symbol)}?assetClass=${inv.assetClass}`,
        token,
      );
      await api.put(`/investments/${encodeURIComponent(inv.id)}`, token, { currentPrice: result.price });
      if (reload) invalidateServerLists(["/investments", "/analytics"]);
      return true;
    } catch (error) {
      console.warn("Refresh harga gagal", error);
      return false;
    }
  }

  async function refreshPortfolioPrices(scope: "visible" | "all" = "all", silent = false) {
    if (!token) return;
    if (!silent) {
      setPortfolioRefreshing(true);
      setPortfolioStatus("Mengambil harga terbaru dari Yahoo Finance...");
    }
    try {
      const openInvestments = scope === "visible"
        ? investmentPager.items.filter((investment) => investment.quantity > 0)
        : await api.all<Investment>("/investments", token, { sold: false });
      const results = await Promise.all(
        openInvestments.map((inv) => refreshInvestmentPrice(inv, false)),
      );
      const success = results.filter(Boolean).length;
      if (success > 0) invalidateServerLists(["/investments", "/analytics"]);
      if (!silent) setPortfolioStatus(
        `Harga diperbarui: ${success}/${openInvestments.length} aset.`,
      );
    } catch (error) {
      setPortfolioStatus(
        error instanceof Error ? error.message : "Gagal memuat aset investasi.",
      );
    } finally {
      if (!silent) setPortfolioRefreshing(false);
    }
  }

  useEffect(() => {
    if (autoRefreshStarted.current || activeCount === 0 || !investmentPager.items.length || !token)
      return;
    autoRefreshStarted.current = true;
    void refreshPortfolioPrices("visible", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCount, token, investmentPager.items]);

  // Fetch IHSG (Jakarta Composite Index) for the market header stat
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<{ price: number; changePercent: number }>(
        "/market-quote/%5EJKSE?assetClass=index",
        token,
      )
      .then((quote) => {
        if (!cancelled) {
          setIhsg({ price: quote.price, changePercent: quote.changePercent });
        }
      })
      .catch(() => {
        /* IHSG is a nice-to-have; ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function selectSymbolSuggestion(item: MarketSearchResult) {
    const detectedAssetClass: AssetClass =
      item.type === "CRYPTOCURRENCY"
        ? "crypto"
        : item.type === "MUTUALFUND" ||
            item.type === "MUTUALFUND_ID" ||
            item.type === "ETF"
          ? "mutual-fund"
          : item.type === "BOND"
            ? "bond"
            : item.type === "GOLD"
              ? "gold"
              : "stock";
    // Auto-set broker for gold products
    const detectedBroker =
      item.symbol === "GOLD:PEGADAIAN"
        ? "Pegadaian"
        : item.symbol === "GOLD:TREASURY"
          ? "Treasury"
          : item.symbol === "GOLD:INDOGOLD"
            ? "Indogold"
            : null;

    setSymbolSearchOpen(false);
    setForm((current) => ({
      ...current,
      symbol: displaySymbol(item.symbol),
      name: item.name,
      assetClass: detectedAssetClass,
      broker: detectedBroker ?? current.broker,
      currentPrice: "",
    }));
    void fetchMarketPrice(item.symbol, detectedAssetClass);
  }

  function openAdd() {
    resetForm();
    setShowModal(true);
  }

  function handleSymbolChange(value: string) {
    setSymbolSearchOpen(true);
    setForm((current) => ({
      ...current,
      symbol: value,
      currentPrice: current.symbol === value ? current.currentPrice : "",
    }));
    setPriceStatus(null);
  }

  function openEdit(inv: Investment) {
    setEditing(inv);
    setPriceStatus(null);
    setForm({
      name: inv.name,
      symbol: inv.symbol,
      assetClass: inv.assetClass,
      broker: inv.broker,
      walletId: inv.walletId ?? "",
      quantity: String(
        inv.assetClass === "stock" ? inv.quantity / 100 : inv.quantity,
      ),
      avgBuyPrice: String(inv.avgBuyPrice),
      currentPrice: String(inv.currentPrice),
      buyFee: String(inv.buyFee ?? ""),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.quantity || !form.avgBuyPrice) return;

    const symbolInput = form.symbol || form.name.slice(0, 4).toUpperCase();
    const marketPrice = form.currentPrice
      ? Number(form.currentPrice)
      : await fetchMarketPrice(symbolInput);
    if (!marketPrice) return;

    const symbol = normalizeSymbol(symbolInput);
    const inputQty = Number(form.quantity);
    const quantity = form.assetClass === "stock" ? inputQty * 100 : inputQty;
    const payload = {
      name: form.name,
      symbol,
      assetClass: form.assetClass,
      broker: form.broker,
      walletId: form.walletId || null,
      quantity,
      soldQuantity: 0,
      avgBuyPrice: Number(form.avgBuyPrice),
      currentPrice: marketPrice,
      currency: "IDR",
      color: ASSET_CLASS_COLORS[form.assetClass] || "#FFD147",
      sellPrice: null,
      soldAt: null,
      buyFee: form.buyFee ? Number(form.buyFee) : 0,
      sellFee: null,
    };

    if (editing) {
      const { sellPrice, soldAt, sellFee, soldQuantity, ...changes } = payload;
      updateInvestment(editing.id, changes);
    }
    else addInvestment(payload);

    resetForm();
    setShowModal(false);
  }

  const closeModal = () => {
    resetForm();
    setShowModal(false);
  };

  // ─── Sell / Undo handlers ──────────────────────────────────────────────
  const openSellModal = (inv: Investment) => {
    setSellModal({ open: true, investment: inv });
    // Default the sell price to the current live price so the
    // user just has to confirm. Default the sell quantity to
    // the entire holding (full sell) — the most common case.
    setSellPrice(String(inv.currentPrice || inv.avgBuyPrice));
    setSellFee(String(inv.sellFee ?? ""));
    setSellQuantity(String(inv.quantity));
    setSellWalletId(inv.walletId ?? "");
  };

  const confirmSell = () => {
    const inv = sellModal.investment;
    if (!inv || !sellPrice) return;
    const qty = Number(sellQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (qty > inv.quantity) return; // server will also reject, but keep UI in sync
    updateInvestment(inv.id, {
      sellPrice: Number(sellPrice),
      sellWalletId: sellWalletId || null,
      sellFee: Number(sellFee) || 0,
      soldAt: new Date().toISOString(),
      // Quantity here is the number of lots to sell. The server
      // reduces the held quantity and bumps the cumulative
      // soldQuantity; if qty === inv.quantity this is a full sell.
      sellQuantity: qty,
      // Optimistic update: mirror the server-side computation so
      // the local state reflects the new quantity immediately.
      // Without this the "Aktif" / "Terjual" tab won't refresh
      // until a manual reload.
      quantity: inv.quantity - qty,
      soldQuantity: (inv.soldQuantity ?? 0) + qty,
    });
    setSellModal({ open: false, investment: null });
    setSellPrice("");
    setSellFee("");
    setSellQuantity("");
  };

  const undo = (inv: Investment) => {
    updateInvestment(inv.id, {
      sellPrice: null,
      soldAt: null,
      sellFee: null,
      // Undo restores the held quantity from the cumulative sold counter.
      // This optimistic update mirrors the server-side logic in
      // updatePrismaResource so the item instantly moves back to "Aktif".
      quantity: inv.quantity + (inv.soldQuantity ?? 0),
      soldQuantity: 0,
    });
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const previewQuantity =
    form.assetClass === "stock"
      ? Number(form.quantity || 0) * 100
      : Number(form.quantity || 0);
  const previewCurrentPrice = Number(form.currentPrice || 0);
  const previewAvgBuyPrice = Number(form.avgBuyPrice || 0);

  return (
    <PageWrapper
      title="Investasi"
      subtitle="Pantau portofolio investasi kamu"
      actions={
        <>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            loading={portfolioRefreshing}
            onClick={() => void refreshPortfolioPrices()}
          >
            Refresh Semua Harga
          </Button>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
            Tambah Aset
          </Button>
        </>
      }
    >
      {portfolioStatus && (
        <div className="bg-bg-elevated border-border text-text-muted rounded-lg border px-4 py-2 text-xs">
          {portfolioStatus}
        </div>
      )}

      {/* ── Summary Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nilai Portfolio"
          value={formatCurrency(totalValue)}
          icon={<Wallet className="text-primary" />}
        />
        <StatCard
          title="Unrealized P/L"
          value={
            <span className={`tabular-nums ${totalPL >= 0 ? "text-success" : "text-danger"}`}>
              {totalPL >= 0 ? "+" : ""}
              {formatCurrency(totalPL)}
            </span>
          }
          subtitle={`${totalPL >= 0 ? "+" : ""}${totalPLPct}% dari modal`}
          icon={totalPL >= 0 ? <TrendingUp className="text-success" /> : <TrendingDown className="text-danger" />}
        />
        <StatCard
          title="Realized P/L"
          value={
            <span
              className={`tabular-nums ${totalRealizedPL >= 0 ? "text-success" : "text-danger"}`}
            >
              {totalRealizedPL >= 0 ? "+" : ""}
              {formatCurrency(totalRealizedPL)}
            </span>
          }
          subtitle="Dari aset terjual"
          icon={<TrendingUp className={totalRealizedPL >= 0 ? "text-success" : "text-danger"} />}
        />
        <StatCard
          title="Jumlah Aset"
          value={activeCount + soldCount}
          subtitle={`${activeCount} aktif, ${soldCount} terjual`}
          icon={<BarChart2 className="text-info" />}
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Alokasi Aset
            </span>
          </CardHeader>
          <CardBody>
            <PortfolioPieChart data={pieData} height={260} />
          </CardBody>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <span className="text-text-primary text-sm font-semibold">
              Performa Aset
            </span>
            {ihsg && (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted">IHSG</span>
                <span className="text-text-secondary font-semibold">
                  {ihsg.price.toLocaleString("id-ID", {
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={
                    ihsg.changePercent >= 0 ? "text-success" : "text-danger"
                  }
                >
                  {ihsg.changePercent >= 0 ? "+" : ""}
                  {ihsg.changePercent.toFixed(2)}%
                </span>
              </span>
            )}
          </CardHeader>
          <CardBody>
            <ServerListStatus loading={performancePager.loading} error={performancePager.error} reload={performancePager.reload} />
            <PortfolioPerformanceChart data={performancePager.summary?.series ?? []} height={260} />
          </CardBody>
        </Card>
      </div>

      {/* ── Portfolio Table ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Status filter: Aktif / Terjual */}
        <div className="flex gap-1">
          <button
            onClick={() => {
              setShowSold(false);
              setActiveBroker("Semua");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              !showSold
                ? "bg-primary text-white"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => {
              setShowSold(true);
              setActiveBroker("Semua");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showSold
                ? "bg-primary text-white"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            Terjual
          </button>
        </div>

        {/* Broker tabs (only show for active portfolio) */}
        {!showSold && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {brokers.map((b) => (
              <button
                key={b}
                onClick={() => setActiveBroker(b)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeBroker === b
                    ? "bg-primary text-white"
                    : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
        <ServerListStatus {...investmentPager} />
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b">
                  {(showSold
                    ? [
                        "Aset",
                        "Kelas",
                        "Qty",
                        "Avg Buy",
                        "Harga Jual",
                        "Total Jual",
                        "Realisasi",
                        "Realisasi%",
                      ]
                    : [
                        "Aset",
                        "Kelas",
                        "Qty",
                        "Avg Buy",
                        "Harga",
                        "Nilai",
                        "P/L",
                        "P/L%",
                      ]
                  ).map((h) => (
                    <th
                      key={h}
                      className="text-text-muted px-4 py-3 text-left text-xs font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="text-text-muted px-4 py-3 text-right text-xs font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {investmentPager.items.map((inv) => {
                  // For sold assets, use the cumulative soldQuantity (the
                  // lots the user actually sold). The held quantity is 0
                  // after a full sell, so using it would make all values Rp 0.
                  const qty = showSold
                    ? (inv.soldQuantity ?? 0) || inv.quantity
                    : inv.quantity;
                  const price = showSold
                    ? (inv.sellPrice ?? inv.currentPrice)
                    : inv.currentPrice;
                  const buyFee = inv.buyFee ?? 0;
                  const sellFee = inv.sellFee ?? 0;
                  const costBasis = qty * inv.avgBuyPrice + buyFee;
                  const proceeds = showSold
                    ? qty * inv.sellPrice! - sellFee
                    : 0;
                  const value = qty * price;
                  const pl = showSold
                    ? proceeds - costBasis
                    : value - costBasis;
                  const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0;
                  const isPositive = pl >= 0;
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-bg-elevated/50 group transition-colors ${showSold ? "opacity-80" : ""}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: inv.color }}
                          />
                          <div>
                            <p className="text-text-primary text-xs font-semibold">
                              {inv.name}
                            </p>
                            <p className="text-text-muted text-[10px]">
                              {displaySymbol(inv.symbol)}
                            </p>
                            {inv.walletId && (
                              <p className="text-text-secondary text-[10px]">
                                {walletLabels.get(inv.walletId) ?? "Dompet tidak tersedia"}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Badge variant="default" size="sm">
                            {ASSET_CLASS_LABELS[inv.assetClass] ||
                              inv.assetClass}
                          </Badge>
                          {inv.sellPrice != null && inv.quantity > 0 && (
                            <Badge
                              variant="warning"
                              size="sm"
                              className="border-warning text-warning"
                            >
                              Sebagian
                            </Badge>
                          )}
                          {inv.sellPrice != null && inv.quantity === 0 && (
                            <Badge
                              variant="danger"
                              size="sm"
                              className="border-danger text-danger"
                            >
                              Terjual
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-text-secondary px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                        {inv.assetClass === "stock"
                          ? `${(qty / 100).toLocaleString("id-ID")} lot`
                          : qty.toLocaleString("id-ID")}
                        {!showSold && inv.soldQuantity > 0 && (
                          <p className="text-text-muted text-[10px]">
                            {inv.soldQuantity.toLocaleString("id-ID")} terjual
                          </p>
                        )}
                      </td>
                      <td className="text-text-secondary px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                        {formatCurrency(inv.avgBuyPrice)}
                      </td>
                      <td className="text-text-primary px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                        {formatCurrency(price)}
                      </td>
                      <td className="text-text-primary px-4 py-3 text-xs font-medium whitespace-nowrap tabular-nums">
                        {formatCurrency(value)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold tabular-nums ${isPositive ? "text-success" : "text-danger"}`}
                        >
                          {isPositive ? "+" : ""}
                          {formatCurrency(pl)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-success" : "text-danger"}`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {Math.abs(plPct).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex justify-end gap-2">
                          {inv.quantity > 0 && (
                            <button
                              onClick={() => openSellModal(inv)}
                              className="text-text-muted hover:text-success text-xs font-medium transition-colors"
                              title="Jual aset"
                              type="button"
                            >
                              Jual
                            </button>
                          )}
                          <button
                            onClick={() => void refreshInvestmentPrice(inv)}
                            className="text-text-muted hover:text-primary transition-colors"
                            title="Refresh harga"
                            type="button"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(inv)}
                            className="text-text-muted hover:text-primary transition-colors"
                            title="Edit aset"
                            type="button"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteInvestment(inv.id)}
                            className="text-text-muted hover:text-danger transition-colors"
                            title="Hapus aset"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {inv.sellPrice != null && inv.quantity === 0 && (
                            <button
                              onClick={() => undo(inv)}
                              className="text-text-muted hover:text-warning text-xs font-medium transition-colors"
                              title="Batalkan penjualan"
                              type="button"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {investmentPager.initialized && !investmentPager.loading && !investmentPager.error && investmentPager.total === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-text-muted px-4 py-12 text-center text-sm"
                    >
                      {showSold
                        ? "Belum ada aset yang dijual"
                        : "Tidak ada aset untuk broker ini"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Pagination {...investmentPager} label="aset investasi" />
      </div>

      {/* ── Add Asset Modal ────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? "Edit Aset Investasi" : "Tambah Aset Investasi"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Aset"
              placeholder="cth. Bank Central Asia"
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              required
            />
            <div ref={symbolFieldRef} className="relative">
              <Input
                label="Simbol / Kode"
                placeholder="cth. BBCA"
                value={form.symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                hint={
                  symbolSearching
                    ? undefined
                    : "Ketik kode saham (mis. BBCA), pilih dari daftar."
                }
              />
              {symbolSearchOpen &&
                form.symbol.trim().length >= 2 &&
                (symbolSearching ||
                  symbolSearchStatus ||
                  symbolSuggestions.length > 0) && (
                  <div className="bg-bg-surface border-primary absolute top-full right-0 left-0 z-[300] mt-2 max-h-56 overflow-y-auto rounded-lg border-2 shadow-xl">
                    {symbolSearching && (
                      <div className="text-text-muted flex items-center gap-2 px-3 py-2 text-xs">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Mencari simbol...
                      </div>
                    )}
                    {!symbolSearching && symbolSearchStatus && (
                      <div className="text-text-muted px-3 py-2 text-xs">
                        {symbolSearchStatus}
                      </div>
                    )}
                    {!symbolSearching &&
                      symbolSuggestions.map((item) => (
                        <button
                          key={`${item.symbol}-${item.exchange}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSymbolSuggestion(item)}
                          className="hover:bg-bg-elevated flex w-full flex-col px-3 py-2 text-left transition-colors"
                        >
                          <span className="text-text-primary text-xs font-semibold">
                            {displaySymbol(item.symbol)} · {item.name}
                          </span>
                          <span className="text-text-muted text-[10px]">
                            {item.exchange || item.type}
                            {item.currency ? ` · ${item.currency}` : ""}
                          </span>
                        </button>
                      ))}
                    <Pagination {...symbolPager} label="hasil simbol" />
                  </div>
                )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Kelas Aset
              </label>
              <select
                value={form.assetClass}
                onChange={(e) => {
                  const assetClass = e.target.value as AssetClass;
                  setForm((current) => ({
                    ...current,
                    assetClass,
                    symbol: normalizeSymbol(current.symbol),
                  }));
                  setPriceStatus(null);
                }}
                className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              >
                {ASSET_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Broker
              </label>
              <select
                value={form.broker}
                onChange={(e) => field("broker", e.target.value)}
                className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              >
                {BROKER_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="investment-wallet" className="text-text-secondary text-sm font-medium">
              Dompet sumber dana
            </label>
            <WalletPicker
              id="investment-wallet"
              value={form.walletId}
              onChange={(value) => field("walletId", value)}
              currency="IDR"
              emptyLabel="Tanpa dompet"
            />
            <p className="text-text-secondary text-xs">
              {editing
                ? "Mengubah jumlah, harga beli, fee, atau dompet akan menyesuaikan saldo dana beli."
                : "Pilih RDN atau kantong Ajaib / Stockbit untuk memotong nilai beli dan fee. Tanpa dompet hanya mencatat investasi."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={
                form.assetClass === "stock" ? "Jumlah Lot" : "Jumlah / Qty"
              }
              type="number"
              step="any"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => field("quantity", e.target.value)}
              hint={
                form.assetClass === "stock"
                  ? "1 lot = 100 lembar saham"
                  : undefined
              }
              required
            />
            <Input
              label="Harga Beli Avg (Rp)"
              currency
              type="number"
              step="any"
              placeholder="0"
              value={form.avgBuyPrice}
              onChange={(e) => field("avgBuyPrice", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Biaya Beli (Rp)"
              currency
              type="number"
              step="any"
              placeholder="0"
              value={form.buyFee}
              onChange={(e) => field("buyFee", e.target.value)}
              hint="Fee broker saat beli"
            />
            <div className="flex flex-col gap-1.5">
              <Input
                label="Harga Sekarang (Rp)"
                currency
                type="number"
                step="any"
                placeholder="Auto dari Yahoo Finance"
                value={form.currentPrice}
                onChange={(e) => field("currentPrice", e.target.value)}
                hint="Kosongkan untuk ambil otomatis saat simpan."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={priceLoading}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() =>
                  void fetchMarketPrice(
                    form.symbol || form.name.slice(0, 4).toUpperCase(),
                  )
                }
              >
                Ambil harga
              </Button>
            </div>
          </div>
          {priceStatus && (
            <p className="text-text-muted text-xs">{priceStatus}</p>
          )}
          {form.quantity && form.avgBuyPrice && form.currentPrice && (
            <div className="bg-bg-elevated border-border rounded-lg border p-3 text-xs">
              <div className="text-text-muted mb-1 flex justify-between">
                <span>Estimasi Nilai</span>
                <span>
                  {formatCurrency(previewQuantity * previewCurrentPrice)}
                </span>
              </div>
              {form.assetClass === "stock" && (
                <div className="text-text-muted mb-1 flex justify-between">
                  <span>Lembar saham</span>
                  <span>{previewQuantity.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="text-text-muted flex justify-between">
                <span>Biaya Beli</span>
                <span>{formatCurrency(Number(form.buyFee || 0))}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1">
                <span className="text-text-muted">Estimasi P/L</span>
                <span
                  className={
                    (previewCurrentPrice - previewAvgBuyPrice) *
                      previewQuantity -
                      Number(form.buyFee || 0) >=
                    0
                      ? "text-success font-medium"
                      : "text-danger font-medium"
                  }
                >
                  {formatCurrency(
                    (previewCurrentPrice - previewAvgBuyPrice) *
                      previewQuantity -
                      Number(form.buyFee || 0),
                  )}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button type="submit" loading={priceLoading}>
              {editing ? "Update Aset" : "Simpan Aset"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Sell Asset Modal ─────────────────────────────────────────── */}
      <Modal
        open={sellModal.open}
        onClose={() => {
          setSellModal({ open: false, investment: null });
          setSellPrice("");
          setSellFee("");
          setSellQuantity("");
        }}
        title="Jual Aset"
        size="sm"
      >
        {sellModal.investment && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: sellModal.investment.color }}
              />
              <div>
                <p className="text-text-primary text-sm font-semibold">
                  {sellModal.investment.name}
                </p>
                <p className="text-text-muted text-xs">
                  {displaySymbol(sellModal.investment.symbol)} -{" "}
                  {ASSET_CLASS_LABELS[sellModal.investment.assetClass] ||
                    sellModal.investment.assetClass}
                </p>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-lg border p-3 text-xs">
              <div className="text-text-muted mb-1 flex justify-between">
                <span>Jumlah</span>
                <span>
                  {sellModal.investment.quantity.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-text-muted mb-1 flex justify-between">
                <span>Harga Beli Rata-rata</span>
                <span>{formatCurrency(sellModal.investment.avgBuyPrice)}</span>
              </div>
              <div className="text-text-muted mb-1 flex justify-between">
                <span>Biaya Beli</span>
                <span>{formatCurrency(sellModal.investment.buyFee ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Modal</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    sellModal.investment.avgBuyPrice *
                      sellModal.investment.quantity +
                      (sellModal.investment.buyFee ?? 0),
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="investment-sell-wallet" className="text-text-secondary text-sm font-medium">
                Dompet penerima hasil jual
              </label>
              <WalletPicker
                id="investment-sell-wallet"
                value={sellWalletId}
                onChange={setSellWalletId}
                currency="IDR"
                emptyLabel="Tanpa dompet"
              />
              <p className="text-text-secondary text-xs">Hasil jual setelah fee masuk ke saldo dompet ini. Tanpa dompet tidak mengubah saldo.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-text-primary text-xs font-medium">
                  {sellModal.investment.assetClass === "stock" ? "Jumlah Lembar" : "Jumlah Unit"}
                </label>
                {sellModal.investment.quantity > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSellQuantity(String(sellModal.investment!.quantity))
                    }
                    className="text-primary text-[11px] font-medium hover:underline"
                  >
                    Jual semua ({sellModal.investment.quantity})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min={0}
                  max={sellModal.investment.quantity}
                  placeholder="0"
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
              {Number(sellQuantity) > sellModal.investment.quantity && (
                <p className="text-danger text-[11px]">
                  Maksimal {sellModal.investment.quantity} {sellModal.investment.assetClass === "stock" ? "lembar" : "unit"} (jumlah dimiliki)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-text-primary text-xs font-medium">
                  Harga Jual (Rp)
                </label>
                <div className="relative">
                  <AmountInput
                    type="number"
                    step="any"
                    placeholder="0"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-text-primary text-xs font-medium">
                  Biaya Jual (Rp)
                </label>
                <div className="relative">
                  <AmountInput
                    type="number"
                    step="any"
                    placeholder="0"
                    value={sellFee}
                    onChange={(e) => setSellFee(e.target.value)}
                    className="bg-bg-surface border-border text-text-primary focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {sellPrice && Number(sellPrice) > 0 && Number(sellQuantity) > 0 && (
              <div className="bg-bg-elevated rounded-lg border p-3 text-xs">
                <div className="text-text-muted mb-1 flex justify-between">
                  <span>
                    Nilai Jual ({Number(sellQuantity).toLocaleString("id-ID")}{" "}
                    {sellModal.investment.assetClass === "stock" ? "lembar" : "unit"})
                  </span>
                  <span>
                    {formatCurrency(Number(sellPrice) * Number(sellQuantity))}
                  </span>
                </div>
                <div className="text-text-muted mb-1 flex justify-between">
                  <span>Biaya Jual</span>
                  <span>{formatCurrency(Number(sellFee || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">
                    Estimasi Realisasi P/L
                  </span>
                  <span
                    className={
                      (Number(sellPrice) - sellModal.investment.avgBuyPrice) *
                        Number(sellQuantity) -
                        (sellModal.investment.buyFee ?? 0) *
                          (Number(sellQuantity) /
                            Math.max(sellModal.investment.quantity, 1)) -
                        Number(sellFee || 0) >=
                      0
                        ? "text-success font-medium"
                        : "text-danger font-medium"
                    }
                  >
                    {formatCurrency(
                      (Number(sellPrice) - sellModal.investment.avgBuyPrice) *
                        Number(sellQuantity) -
                        (sellModal.investment.buyFee ?? 0) *
                          (Number(sellQuantity) /
                            Math.max(sellModal.investment.quantity, 1)) -
                        Number(sellFee || 0),
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSellModal({ open: false, investment: null });
                  setSellPrice("");
                  setSellFee("");
                  setSellQuantity("");
                }}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={confirmSell}
                disabled={
                  !sellPrice ||
                  Number(sellPrice) <= 0 ||
                  !sellQuantity ||
                  Number(sellQuantity) <= 0 ||
                  Number(sellQuantity) > sellModal.investment.quantity
                }
              >
                Konfirmasi Jual
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
