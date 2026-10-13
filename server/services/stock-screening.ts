export type DailyBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
export function analyzeStock(
  symbol: string,
  name: string,
  bars: DailyBar[],
  now = Date.now(),
) {
  if (bars.length < 51) throw new Error("Riwayat kurang dari 51 sesi lengkap");
  const latest = bars.at(-1)!;
  const previous20 = bars.slice(-21, -1);
  const recent20 = bars.slice(-20);
  const sma20 = mean(recent20.map((bar) => bar.close));
  const sma50 = mean(bars.slice(-50).map((bar) => bar.close));
  const averageVolume = mean(previous20.map((bar) => bar.volume));
  const relativeVolume = averageVolume > 0 ? latest.volume / averageVolume : 0;
  const turnover = mean(recent20.map((bar) => bar.close * bar.volume));
  const support = Math.min(...previous20.map((bar) => bar.low));
  const resistance = Math.max(...previous20.map((bar) => bar.high));
  const volumeSum = recent20.reduce((sum, bar) => sum + bar.volume, 0);
  const cmf =
    volumeSum > 0
      ? recent20.reduce(
          (sum, bar) =>
            sum +
            (bar.high === bar.low
              ? 0
              : ((2 * bar.close - bar.high - bar.low) / (bar.high - bar.low)) *
                bar.volume),
          0,
        ) / volumeSum
      : 0;
  let obvChange = 0;
  for (let i = bars.length - 5; i < bars.length; i++)
    obvChange += Math.sign(bars[i].close - bars[i - 1].close) * bars[i].volume;
  const deltas = bars
    .slice(-15)
    .slice(1)
    .map((bar, index) => bar.close - bars[bars.length - 15 + index].close);
  const gains = mean(deltas.map((delta) => Math.max(0, delta)));
  const losses = mean(deltas.map((delta) => Math.max(0, -delta)));
  const rsi =
    !gains && !losses ? 50 : !losses ? 100 : 100 - 100 / (1 + gains / losses);
  const ranges = bars
    .slice(-14)
    .map((bar, index) =>
      Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - bars[bars.length - 15 + index].close),
        Math.abs(bar.low - bars[bars.length - 15 + index].close),
      ),
    );
  const atrPercent = (mean(ranges) / latest.close) * 100;
  const recentVolumeRatio =
    mean(bars.slice(-5).map((bar) => bar.volume)) /
    (mean(bars.slice(-25, -5).map((bar) => bar.volume)) || Infinity);
  const stale = now - latest.time * 1000 > 7 * 86400000;
  const risks: string[] = [];
  if (stale) risks.push("Data lebih dari 7 hari; sinyal tidak aktif");
  if (turnover < 1_000_000_000)
    risks.push("Rata-rata nilai transaksi di bawah Rp1 miliar/hari");
  if (atrPercent > 5) risks.push("Rentang pergerakan harian tinggi (ATR > 5%)");
  if (rsi > 70) risks.push("RSI di atas 70; harga sudah menguat tajam");
  if (
    bars
      .slice(-20)
      .some(
        (bar, index) =>
          Math.abs(bar.close / bars[bars.length - 21 + index].close - 1) > 0.25,
      )
  )
    risks.push("Lonjakan harga > 25%; periksa aksi korporasi atau data");
  const signals: string[] = [];
  const reasons: string[] = [];
  const eligible =
    !stale &&
    turnover >= 1_000_000_000 &&
    !risks.some((risk) => risk.startsWith("Lonjakan"));
  if (eligible && latest.close > resistance && relativeVolume >= 1.5) {
    signals.push("Breakout bervolume");
    reasons.push(
      `Penutupan melewati high 20 sesi sebelumnya; volume ${relativeVolume.toFixed(2)}× rata-rata 20 sesi.`,
    );
  }
  if (
    eligible &&
    cmf > 0.1 &&
    obvChange > 0 &&
    recentVolumeRatio >= 1.2 &&
    (resistance - support) / support <= 0.15
  ) {
    signals.push("Indikasi akumulasi");
    reasons.push(
      `CMF20 ${cmf.toFixed(2)}, OBV 5 sesi meningkat, volume 5 sesi ${recentVolumeRatio.toFixed(2)}× periode sebelumnya dalam rentang harga terbatas.`,
    );
  }
  if (
    eligible &&
    latest.close >= sma20 &&
    sma20 > sma50 &&
    latest.close / sma20 <= 1.03 &&
    rsi >= 45 &&
    rsi <= 70
  ) {
    signals.push("Dekat MA20 dalam tren naik");
    reasons.push(
      "Harga berada maksimal 3% di atas MA20; MA20 di atas MA50 dan RSI14 antara 45–70.",
    );
  }
  if (cmf < -0.1 && obvChange < 0)
    risks.push("CMF negatif dan OBV menurun; indikasi tekanan jual");
  return {
    symbol: symbol.replace(/\.JK$/, ""),
    name,
    price: latest.close,
    asOf: new Date(latest.time * 1000).toISOString(),
    signals,
    reasons,
    risks,
    support,
    resistance,
    invalidation: signals.includes("Breakout bervolume") ? resistance : support,
    relativeVolume,
    cmf,
    obvChange,
    rsi,
    atrPercent,
    turnover,
    sma20,
    sma50,
    stale,
  };
}

export function parseDailyBars(
  result: {
    timestamp?: number[];
    indicators?: {
      quote?: Array<{
        open?: (number | null)[];
        high?: (number | null)[];
        low?: (number | null)[];
        close?: (number | null)[];
        volume?: (number | null)[];
      }>;
    };
  },
  now = Date.now(),
): DailyBar[] {
  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];
  const today = new Date(now + 7 * 3600000).toISOString();
  const beforeClose = today.slice(11, 16) < "16:30";
  const byTime = new Map<number, DailyBar>();
  result.timestamp?.forEach((time, index) => {
    if (!Number.isFinite(time) || time * 1000 > now) return;
    const date = new Date(time * 1000 + 7 * 3600000).toISOString().slice(0, 10);
    if (date === today.slice(0, 10) && beforeClose) return;
    const open = quote.open?.[index],
      high = quote.high?.[index],
      low = quote.low?.[index],
      close = quote.close?.[index],
      volume = quote.volume?.[index];
    if (
      ![open, high, low, close, volume].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    )
      return;
    if (
      open! <= 0 ||
      low! <= 0 ||
      close! <= 0 ||
      high! < Math.max(open!, close!) ||
      low! > Math.min(open!, close!) ||
      volume! < 0
    )
      return;
    byTime.set(time, {
      time,
      open: open!,
      high: high!,
      low: low!,
      close: close!,
      volume: volume!,
    });
  });
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
