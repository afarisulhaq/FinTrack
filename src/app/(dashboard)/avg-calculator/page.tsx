"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { formatCurrency } from "~/lib/utils";

interface Broker {
  label: string;
  buyFee: number; // percentage
  sellFee: number; // percentage
}

const BROKERS: Record<string, Broker> = {
  STOCKBIT: { label: "Stockbit (XL)", buyFee: 0.1, sellFee: 0.2 },
  MIRAE: { label: "Mirae Asset (YP)", buyFee: 0.15, sellFee: 0.25 },
  AJAIB: { label: "Ajaib Sekuritas (XC)", buyFee: 0.15, sellFee: 0.25 },
  IPOT: { label: "Indo Premier (PD)", buyFee: 0.19, sellFee: 0.29 },
  MANDIRI: { label: "Mandiri Sekuritas (CC)", buyFee: 0.18, sellFee: 0.28 },
  BCA: { label: "BCA Sekuritas (SQ)", buyFee: 0.18, sellFee: 0.28 },
  BNI: { label: "BNI Sekuritas (NI)", buyFee: 0.17, sellFee: 0.27 },
  PHILLIP: { label: "Phillip Sekuritas (KK)", buyFee: 0.15, sellFee: 0.25 },
  CGS: { label: "CGS International (YU)", buyFee: 0.18, sellFee: 0.28 },
  CUSTOM: { label: "Custom", buyFee: 0.15, sellFee: 0.25 },
};

const SHARES_PER_LOT = 100;

const SIM_TARGETS = [
  { label: "CL -10%", pct: -10 },
  { label: "CL -7%", pct: -7 },
  { label: "CL -5%", pct: -5 },
  { label: "CL -3%", pct: -3 },
  { label: "TP +2%", pct: 2 },
  { label: "TP +5%", pct: 5 },
  { label: "TP +8%", pct: 8 },
  { label: "TP +10%", pct: 10 },
];

export default function AvgCalculatorPage() {
  const [brokerKey, setBrokerKey] = useState<keyof typeof BROKERS>("STOCKBIT");
  const [customBuyFee, setCustomBuyFee] = useState("0.15");
  const [customSellFee, setCustomSellFee] = useState("0.25");

  // Posisi saat ini
  const [curPrice, setCurPrice] = useState("");
  const [curLot, setCurLot] = useState("");

  // Pembelian baru
  const [newPrice, setNewPrice] = useState("");
  const [newLot, setNewLot] = useState("");

  const broker = BROKERS[brokerKey];
  const buyFeePct =
    brokerKey === "CUSTOM" ? Number(customBuyFee) || 0 : broker.buyFee;
  const sellFeePct =
    brokerKey === "CUSTOM" ? Number(customSellFee) || 0 : broker.sellFee;

  const result = useMemo(() => {
    const cp = Number(curPrice) || 0;
    const cl = Number(curLot) || 0;
    const np = Number(newPrice) || 0;
    const nl = Number(newLot) || 0;

    const curShares = cl * SHARES_PER_LOT;
    const newShares = nl * SHARES_PER_LOT;

    // Modal lama (asumsikan fee beli sudah include di posisi lama via avg)
    const curModal = cp * curShares;
    const newModalGross = np * newShares;
    const newBuyFee = (newModalGross * buyFeePct) / 100;
    const newTotalOut = newModalGross + newBuyFee;

    const totalShares = curShares + newShares;
    const totalLot = cl + nl;

    // Total modal net = modal lama + modal baru + fee beli baru
    const totalModalNet = curModal + newModalGross + newBuyFee;

    const newAvg = totalShares > 0 ? totalModalNet / totalShares : 0;

    // BEP = harga jual agar net profit = 0 (potong fee jual)
    // totalShares * bep * (1 - sellFee/100) = totalModalNet
    const bep =
      totalShares > 0
        ? totalModalNet / (totalShares * (1 - sellFeePct / 100))
        : 0;

    const simulations = SIM_TARGETS.map((target) => {
      const sellPrice = newAvg * (1 + target.pct / 100);
      const gross = sellPrice * totalShares;
      const sellFee = (gross * sellFeePct) / 100;
      const netProceeds = gross - sellFee;
      const netPL = netProceeds - totalModalNet;
      return {
        ...target,
        sellPrice,
        netPL,
      };
    });

    return {
      curShares,
      newShares,
      totalShares,
      totalLot,
      newModalGross,
      newBuyFee,
      newTotalOut,
      totalModalNet,
      newAvg,
      bep,
      simulations,
      hasData: totalShares > 0 && newAvg > 0,
    };
  }, [curPrice, curLot, newPrice, newLot, buyFeePct, sellFeePct]);

  return (
    <PageWrapper
      title="Avg Down Calculator"
      subtitle="Hitung harga rata-rata baru, BEP, dan simulasi profit/loss setelah fee broker"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Input column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Broker selection */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Calculator className="text-primary h-5 w-5" />
              <h3 className="text-text-primary font-semibold">Pilih Broker</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(BROKERS).map(([key, b]) => (
                <button
                  key={key}
                  onClick={() => setBrokerKey(key as keyof typeof BROKERS)}
                  className={
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-colors " +
                    (brokerKey === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-muted hover:bg-bg-elevated")
                  }
                >
                  {b.label}
                </button>
              ))}
            </div>
            {brokerKey === "CUSTOM" ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Input
                  label="Fee Beli (%)"
                  type="number"
                  step="any"
                  value={customBuyFee}
                  onChange={(e) => setCustomBuyFee(e.target.value)}
                />
                <Input
                  label="Fee Jual (%)"
                  type="number"
                  step="any"
                  value={customSellFee}
                  onChange={(e) => setCustomSellFee(e.target.value)}
                />
              </div>
            ) : (
              <div className="text-text-muted mt-3 flex gap-4 text-xs">
                <span>
                  Fee Beli:{" "}
                  <span className="text-text-primary font-semibold">
                    {buyFeePct}%
                  </span>
                </span>
                <span>
                  Fee Jual:{" "}
                  <span className="text-text-primary font-semibold">
                    {sellFeePct}%
                  </span>
                </span>
              </div>
            )}
          </Card>

          {/* Posisi saat ini */}
          <Card>
            <h3 className="text-text-primary mb-1 font-semibold">
              1. Posisi Saat Ini
            </h3>
            <p className="text-text-muted mb-4 text-xs">
              Harga rata-rata dan jumlah lot yang sudah kamu pegang.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Avg Price (Rp)"
                type="number"
                step="any"
                placeholder="0"
                value={curPrice}
                onChange={(e) => setCurPrice(e.target.value)}
              />
              <Input
                label="Jumlah Lot"
                type="number"
                step="any"
                placeholder="0"
                value={curLot}
                onChange={(e) => setCurLot(e.target.value)}
                hint={`${result.curShares.toLocaleString("id-ID")} lembar`}
              />
            </div>
          </Card>

          {/* Pembelian baru */}
          <Card>
            <h3 className="text-text-primary mb-1 font-semibold">
              2. Pembelian Baru
            </h3>
            <p className="text-text-muted mb-4 text-xs">
              Harga dan lot yang ingin kamu beli untuk average down/up.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Harga Beli (Rp)"
                type="number"
                step="any"
                placeholder="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
              <Input
                label="Jumlah Lot"
                type="number"
                step="any"
                placeholder="0"
                value={newLot}
                onChange={(e) => setNewLot(e.target.value)}
                hint={`${result.newShares.toLocaleString("id-ID")} lembar`}
              />
            </div>
          </Card>
        </div>

        {/* Result column */}
        <div className="space-y-6">
          {/* Average baru */}
          <Card className="bg-primary/5 border-primary/30">
            <p className="text-text-muted text-xs">Average Baru</p>
            <p className="text-primary mt-1 text-3xl font-bold">
              {formatCurrency(result.newAvg)}
            </p>
            <p className="text-text-muted mt-1 text-xs">
              Total: {result.totalLot.toLocaleString("id-ID")} Lot ·{" "}
              {result.totalShares.toLocaleString("id-ID")} lembar
            </p>
            <div className="border-border mt-4 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Total Modal Net</span>
                <span className="text-text-primary font-semibold">
                  {formatCurrency(result.totalModalNet)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">BEP (Break Even)</span>
                <span className="text-text-primary font-semibold">
                  {formatCurrency(result.bep)}
                </span>
              </div>
            </div>
          </Card>

          {/* Rincian transaksi baru */}
          <Card>
            <h4 className="text-text-primary mb-3 text-sm font-semibold">
              Rincian Pembelian Baru
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Modal Pembelian</span>
                <span className="text-text-primary">
                  {formatCurrency(result.newModalGross)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Fee Broker</span>
                <span className="text-warning">
                  + {formatCurrency(result.newBuyFee)}
                </span>
              </div>
              <div className="border-border flex justify-between border-t pt-2">
                <span className="text-text-muted">Total Keluar</span>
                <span className="text-text-primary font-semibold">
                  {formatCurrency(result.newTotalOut)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Simulasi */}
      {result.hasData && (
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-text-primary font-semibold">
              Simulasi Net Profit / Loss
            </h3>
          </div>
          <p className="text-text-muted mb-4 text-xs">
            Estimasi sudah dipotong fee jual {sellFeePct}%. Target dihitung dari
            average baru {formatCurrency(result.newAvg)}.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.simulations.map((sim) => {
              const positive = sim.netPL >= 0;
              return (
                <div
                  key={sim.label}
                  className={
                    "rounded-lg border p-3 " +
                    (positive
                      ? "border-success/30 bg-success/5"
                      : "border-danger/30 bg-danger/5")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    {positive ? (
                      <TrendingUp className="text-success h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="text-danger h-3.5 w-3.5" />
                    )}
                    <span className="text-text-secondary text-xs font-medium">
                      {sim.label}
                    </span>
                  </div>
                  <p className="text-text-primary mt-2 text-sm font-semibold">
                    {formatCurrency(sim.sellPrice)}
                  </p>
                  <p
                    className={
                      "mt-0.5 text-xs font-medium " +
                      (positive ? "text-success" : "text-danger")
                    }
                  >
                    {positive ? "+" : ""}
                    {formatCurrency(sim.netPL)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </PageWrapper>
  );
}
