import { Elysia } from "elysia";
import {
  GOLD_PRODUCTS,
  getBareksaGoldPrices,
} from "../services/market-price.js";
import { ok } from "../utils.js";

export const publicMarketRoutes = new Elysia({ prefix: "/api/public" })
  .get("/market-prices", async () => {
    // Try to get updated prices from Bareksa, fallback to hardcoded
    const products = await getBareksaGoldPrices().catch(() => []);

    const goldPrices = Object.entries(GOLD_PRODUCTS).map(
      ([symbol, info]) => {
        const live = products.find(
          (p) =>
            p.product_code ===
            {
              "GOLD:PEGADAIAN": "EMASPEGADAIAN",
              "GOLD:TREASURY": "EMASTREASURY",
              "GOLD:INDOGOLD": "EMASINDOGOLD",
            }[symbol],
        );
        return {
          symbol,
          name: info.name,
          exchange: info.exchange,
          buyPrice: live
            ? Number(live.buy.replace(/\./g, ""))
            : info.buyPrice,
          sellPrice: live
            ? Number(live.sell.replace(/\./g, ""))
            : info.sellPrice,
          currency: info.currency,
          updatedAt: live?.price_date ?? null,
        };
      },
    );

    return ok({
      source: "Bareksa Emas + FinTrack",
      updatedAt: new Date().toISOString(),
      gold: goldPrices,
    });
  });
