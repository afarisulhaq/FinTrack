import { Elysia } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { fetchYahooChart } from "../services/market-price.js";
import { analyzeStock, parseDailyBars } from "../services/stock-screening.js";
import { fail, ok } from "../utils.js";
import { PaginationError, readPage, pageArray } from "../services/pagination.js";
const universe = [
    "BBCA",
    "BBRI",
    "BMRI",
    "BBNI",
    "BRIS",
    "TLKM",
    "ISAT",
    "ICBP",
    "INDF",
    "ASII",
    "ANTM",
    "INCO",
    "MDKA",
    "ADRO",
    "PTBA",
    "ITMG",
    "UNTR",
    "BSDE",
    "PWON",
    "GOTO",
];
let cached;
let pending;
async function scan() {
    const candidates = [];
    const unavailable = [];
    let index = 0;
    const deadline = AbortSignal.timeout(45_000);
    let throttled = false;
    await Promise.all(Array.from({ length: 3 }, async () => {
        while (index < universe.length) {
            const symbol = universe[index++];
            try {
                if (deadline.aborted)
                    throw new Error("Batas waktu analisis tercapai; coba lagi");
                if (throttled)
                    throw new Error("Yahoo membatasi permintaan; coba lagi nanti");
                const response = await fetchYahooChart(`${symbol}.JK`, "6mo", deadline);
                if (response?.response.status === 429)
                    throttled = true;
                if (!response?.response.ok)
                    throw new Error("Riwayat Yahoo tidak tersedia");
                const json = await response.response.json();
                const result = json.chart?.result?.[0];
                if (!result || result.meta?.currency !== "IDR")
                    throw new Error("Riwayat Rupiah tidak tersedia");
                candidates.push(analyzeStock(symbol, result.meta.longName ?? result.meta.shortName ?? symbol, parseDailyBars(result)));
            }
            catch (error) {
                unavailable.push({
                    symbol,
                    reason: error instanceof Error ? error.message : "Data gagal dimuat",
                });
            }
        }
    }));
    candidates.sort((a, b) => b.signals.length - a.signals.length ||
        b.relativeVolume - a.relativeVolume);
    return {
        candidates,
        unavailable,
        scanned: universe.length,
        generatedAt: new Date().toISOString(),
        methodology: "price-volume-v1",
    };
}
function scanPage(data, query) {
    const input = readPage(query);
    const search = (query.search ?? "").trim().toLowerCase();
    const summary = {
        scanned: data.scanned,
        analyzedCount: data.candidates.length,
        generatedAt: data.generatedAt,
        signalCount: data.candidates.filter((item) => item.signals.length > 0).length,
        unavailableCount: data.unavailable.length,
    };
    if (query.view === "unavailable")
        return pageArray(data.unavailable, input, summary);
    const rows = data.candidates.filter((item) => (query.showAll === "true" || item.signals.length > 0) &&
        (!search || `${item.symbol} ${item.name}`.toLowerCase().includes(search)));
    return pageArray(rows, input, summary);
}
export const stockScreeningRoutes = new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
    if (error instanceof PaginationError) {
        set.status = error.status;
        return fail(error.message);
    }
})
    .onBeforeHandle(({ request, set }) => {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    if (!token || !verifyToken(token)) {
        set.status = 401;
        return fail("Unauthorized");
    }
})
    .get("/stock-screening", async ({ set, query }) => {
    readPage(query);
    if (cached && cached.expires > Date.now()) {
        if (cached.data.candidates.length)
            return ok(scanPage(cached.data, query));
        set.status = 503;
        return fail("Riwayat harga dan volume belum tersedia. Coba lagi setelah koneksi Yahoo pulih.");
    }
    pending ??= scan()
        .then((data) => {
        cached = {
            data,
            expires: Date.now() + (data.candidates.length ? 15 * 60000 : 30_000),
        };
        return data;
    })
        .finally(() => {
        pending = undefined;
    });
    const data = await pending;
    if (!data.candidates.length) {
        set.status = 503;
        return fail("Riwayat harga dan volume belum tersedia. Coba lagi setelah koneksi Yahoo pulih.");
    }
    return ok(scanPage(data, query));
});
