import { Elysia, t } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { db, isDatabaseConfigured } from "../prisma-client.js";
import { ok, fail } from "../utils.js";

const temporaryLists = new Map<string, string[]>();
const symbolsSchema = t.Array(
  t.String({ minLength: 1, maxLength: 32, pattern: "^[A-Za-z0-9^=:.\\-]+$" }),
  { maxItems: 100 },
);
const normalize = (symbols: string[]) => [
  ...new Set(
    symbols.map((symbol) => symbol.trim().toUpperCase().replace(/\.JK$/, "")),
  ),
];

export const marketWatchlistRoutes = new Elysia({
  prefix: "/api/market-watchlist",
})
  .derive(({ request }) => {
    const token = extractToken(
      request.headers.get("authorization") ?? undefined,
    );
    return { account: token ? verifyToken(token) : null };
  })
  .onBeforeHandle(({ account, set }) => {
    if (!account) {
      set.status = 401;
      return fail("Unauthorized");
    }
  })
  .onError(({ code, set }) => {
    if (code === "VALIDATION") return;
    set.status = 503;
    return fail("Watchlist gagal disimpan atau dimuat. Coba lagi.");
  })
  .get("/", async ({ account }) => {
    const userId = account!.sub;
    const storage = isDatabaseConfigured() ? "database" : "memory";
    const symbols =
      storage === "database"
        ? ((await db.marketWatchlist.findUnique({ where: { userId } }))
            ?.symbols ?? null)
        : (temporaryLists.get(userId) ?? null);
    return ok({ symbols, storage });
  })
  .post(
    "/",
    async ({ account, body }) => {
      const userId = account!.sub;
      const symbols = normalize(body.symbols);
      const storage = isDatabaseConfigured() ? "database" : "memory";
      if (storage === "database") {
        const list = await db.marketWatchlist.upsert({
          where: { userId },
          create: { userId, symbols },
          update: {},
        });
        return ok({ symbols: list.symbols, storage });
      }
      if (!temporaryLists.has(userId)) temporaryLists.set(userId, symbols);
      return ok({ symbols: temporaryLists.get(userId), storage });
    },
    { body: t.Object({ symbols: symbolsSchema }) },
  )
  .put(
    "/",
    async ({ account, body }) => {
      const userId = account!.sub;
      const symbol = normalize([body.symbol])[0]!;
      const update = (symbols: string[]) =>
        body.action === "add"
          ? normalize([...symbols, symbol])
          : symbols.filter((item) => item !== symbol);
      const storage = isDatabaseConfigured() ? "database" : "memory";
      if (storage === "database") {
        const list = await db.$transaction(async (client) => {
          await client.$queryRaw`SELECT "userId" FROM "MarketWatchlist" WHERE "userId" = ${userId} FOR UPDATE`;
          const previous = await client.marketWatchlist.findUniqueOrThrow({
            where: { userId },
          });
          return client.marketWatchlist.update({
            where: { userId },
            data: { symbols: update(previous.symbols) },
          });
        });
        return ok({ symbols: list.symbols, storage });
      }
      const symbols = update(temporaryLists.get(userId) ?? []);
      temporaryLists.set(userId, symbols);
      return ok({ symbols, storage });
    },
    {
      body: t.Object({
        symbol: t.String({
          minLength: 1,
          maxLength: 32,
          pattern: "^[A-Za-z0-9^=:.\\-]+$",
        }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    },
  );
