import assert from "node:assert/strict";
import { Elysia } from "elysia";
import { db } from "../server/prisma-client.js";
import { signToken } from "../server/auth.js";
import { businessRoutes } from "../server/routes/business.js";
import type {
  BusinessDashboard,
  BusinessDashboardTotals,
} from "../src/lib/business-dashboard.js";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Use the disposable test database on localhost:55432");
}
const app = new Elysia().use(businessRoutes);
const owner = `business-dashboard-${Date.now()}`;
const foreign = `${owner}-foreign`;
const empty = `${owner}-empty`;
const tokenFor = (sub: string, role: "owner" | "admin" = "owner") =>
  signToken({
    sub,
    email: `${sub}@example.invalid`,
    role,
  });
const token = tokenFor(owner);
async function request(
  query = "",
  auth: string | null = token,
  path = "/dashboard",
) {
  const response = await app.handle(
    new Request(`http://localhost/api/businesses${path}${query}`, {
      headers: auth === null ? {} : { Authorization: `Bearer ${auth}` },
    }),
  );
  return { status: response.status, json: await response.json() };
}
async function dashboard(query = "", auth = token): Promise<BusinessDashboard> {
  const response = await request(query, auth);
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.success, true);
  return response.json.data;
}
function assertTotals(
  actual: BusinessDashboardTotals,
  income: number,
  expense: number,
  difference: number,
  count: number,
) {
  assert.deepEqual(actual, {
    income,
    expense,
    difference,
    transactionCount: count,
    marginPercent: income === 0 ? null : (difference / income) * 100,
  });
}
function assertAgreement(data: BusinessDashboard) {
  for (const rows of [data.monthly, data.contributions]) {
    for (const key of ["income", "expense", "difference"] as const) {
      assert.equal(
        rows.reduce((sum, row) => sum + Math.round(row[key] * 100), 0),
        Math.round(data.totals[key] * 100),
      );
    }
    assert.equal(
      rows.reduce((sum, row) => sum + row.transactionCount, 0),
      data.totals.transactionCount,
    );
  }
}

try {
  await db.user.create({
    data: {
      id: owner,
      name: "Dashboard test",
      email: `${owner}@example.invalid`,
      password: "not-a-login",
      timezone: "America/New_York",
    },
  });
  const primary = await db.business.create({
    data: { userId: owner, name: "Pulsa" },
  });
  const loss = await db.business.create({
    data: { userId: owner, name: "Tanpa pemasukan" },
  });
  const oldest = await db.business.create({
    data: {
      userId: owner,
      name: "Bisnis halaman berikutnya",
      createdAt: new Date("2000-01-01T00:00:00Z"),
    },
  });
  await db.business.createMany({
    data: Array.from({ length: 11 }, (_, index) => ({
      userId: owner,
      name: `Kosong ${index}`,
    })),
  });
  const other = await db.business.create({
    data: { userId: foreign, name: "Rahasia pemilik lain" },
  });
  const wallet = await db.wallet.create({
    data: { userId: owner, name: "Kas bisnis", type: "cash", balance: 0 },
  });
  const entry = (
    businessId: string,
    type: string,
    amount: string,
    date: string,
    description: string,
    walletId: string | null = null,
  ) => ({
    businessId,
    type,
    amount,
    date: new Date(date),
    description,
    walletId,
  });
  await db.businessTransaction.createMany({
    data: [
      entry(
        primary.id,
        "income",
        "999.99",
        "2026-01-01T04:59:59.999Z",
        "Masih tahun sebelumnya",
      ),
      entry(
        primary.id,
        "income",
        "100.10",
        "2026-01-01T05:00:00.000Z",
        "Awal tahun lokal",
        wallet.id,
      ),
      entry(
        primary.id,
        "income",
        "0.20",
        "2026-04-01T03:59:59.999Z",
        "Masih Maret setelah DST",
      ),
      entry(
        primary.id,
        "income",
        "0.10",
        "2026-04-01T04:00:00.000Z",
        "Awal April setelah DST",
      ),
      entry(
        primary.id,
        "expense",
        "150.25",
        "2026-04-02T04:00:00.000Z",
        "Pengeluaran April",
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        entry(
          primary.id,
          "income",
          "1.01",
          `2026-06-0${index + 1}T12:00:00.000Z`,
          `Terbaru ${index}`,
        ),
      ),
      entry(
        loss.id,
        "expense",
        "3.33",
        "2026-02-01T05:00:00.000Z",
        "Hanya pengeluaran",
      ),
      entry(
        oldest.id,
        "income",
        "20.00",
        "2026-12-31T23:00:00.000Z",
        "Pemasukan bisnis lama",
      ),
      entry(
        primary.id,
        "expense",
        "0.01",
        "2027-01-01T04:59:59.999Z",
        "Akhir tahun lokal",
      ),
      entry(
        primary.id,
        "income",
        "888.88",
        "2027-01-01T05:00:00.000Z",
        "Sudah tahun berikutnya",
      ),
      entry(
        other.id,
        "income",
        "900000.00",
        "2026-12-31T23:59:59.000Z",
        "Tidak boleh terlihat",
      ),
      entry(
        other.id,
        "income",
        "900000.00",
        "2040-01-01T00:00:00.000Z",
        "Tahun pemilik lain",
      ),
    ],
  });

  assert.equal((await request("", null)).status, 401);
  assert.equal((await request("", "invalid")).status, 401);
  for (const year of [
    "",
    "0",
    "9999",
    "-1",
    "2026.5",
    "NaN",
    "Infinity",
    "2e3",
    "2026x",
  ]) {
    assert.equal((await request(`?year=${year}`)).status, 400, year);
  }
  for (const businessId of ["", "missing", other.id]) {
    assert.equal(
      (await request(`?year=2026&businessId=${businessId}`)).status,
      404,
    );
  }
  assert.equal(
    (await request(`?businessId=${other.id}`, tokenFor(owner, "admin"))).status,
    404,
  );

  const all = await dashboard("?year=2026");
  assert.equal(all.year, 2026);
  assert.equal(all.businessId, null);
  assert.equal(all.timezone, "America/New_York");
  assert.equal(all.businesses.length, 14);
  assert.equal(
    all.businesses.some((row) => row.id === other.id),
    false,
  );
  assert.equal(all.monthly.length, 12);
  assert.deepEqual(
    all.monthly.map((row) => [row.month, row.label]),
    [
      [1, "Jan"],
      [2, "Feb"],
      [3, "Mar"],
      [4, "Apr"],
      [5, "Mei"],
      [6, "Jun"],
      [7, "Jul"],
      [8, "Agu"],
      [9, "Sep"],
      [10, "Okt"],
      [11, "Nov"],
      [12, "Des"],
    ],
  );
  assertTotals(all.totals, 126.46, 153.59, -27.13, 13);
  assertAgreement(all);
  const { month: janMonth, label: janLabel, ...jan } = all.monthly[0]!;
  assert.equal(janMonth, 1);
  assert.equal(janLabel, "Jan");
  assertTotals(jan, 100.1, 0, 100.1, 1);
  assert.equal(all.monthly[2]!.income, 0.2);
  assert.equal(all.monthly[3]!.income, 0.1);
  assert.equal(all.monthly[3]!.difference, -150.15);
  assert.equal(all.monthly[11]!.expense, 0.01);
  const { month: zeroMonth, label: zeroLabel, ...zero } = all.monthly[4]!;
  assert.equal(zeroMonth, 5);
  assert.equal(zeroLabel, "Mei");
  assertTotals(zero, 0, 0, 0, 0);
  assert.deepEqual(
    all.contributions.slice(0, 2).map((row) => row.id),
    [primary.id, oldest.id],
  );
  assert.equal(all.contributions.length, 14);
  assert.equal(all.recent.length, 6);
  assert.deepEqual(
    all.recent.map((row) => row.description),
    [
      "Akhir tahun lokal",
      "Pemasukan bisnis lama",
      "Terbaru 5",
      "Terbaru 4",
      "Terbaru 3",
      "Terbaru 2",
    ],
  );
  for (const recent of all.recent) {
    assert.equal(recent.date, new Date(recent.date).toISOString());
    assert.notEqual(recent.businessId, other.id);
    assert.equal(recent.walletName, null);
  }
  const currentYear = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: all.timezone,
      year: "numeric",
    }).format(new Date()),
  );
  assert.deepEqual(
    all.years,
    [...new Set([currentYear, 2025, 2026, 2027])].sort((a, b) => b - a),
  );
  assert.equal((await dashboard()).year, currentYear);
  assert.deepEqual(
    (await dashboard("?year=2026", tokenFor(owner, "admin"))).totals,
    all.totals,
  );

  const firstPage = await request("", token, "/");
  assert.equal(firstPage.status, 200);
  assert.equal(
    firstPage.json.data.items.some(
      (row: { id: string }) => row.id === oldest.id,
    ),
    false,
  );
  const filtered = await dashboard(`?year=2026&businessId=${oldest.id}`);
  assert.equal(filtered.businessId, oldest.id);
  assert.deepEqual(filtered.businesses, all.businesses);
  assert.deepEqual(filtered.years, all.years);
  assertTotals(filtered.totals, 20, 0, 20, 1);
  assert.deepEqual(
    filtered.contributions.map((row) => row.id),
    [oldest.id],
  );
  assert.equal(filtered.recent.length, 1);
  assert.equal(filtered.recent[0]!.businessName, oldest.name);
  assertAgreement(filtered);

  const lossOnly = await dashboard(`?year=2026&businessId=${loss.id}`);
  assertTotals(lossOnly.totals, 0, 3.33, -3.33, 1);
  assert.equal(lossOnly.contributions[0]!.marginPercent, null);
  assert.equal(lossOnly.monthly[1]!.marginPercent, null);
  assertAgreement(lossOnly);
  const previous = await dashboard(`?year=2025&businessId=${primary.id}`);
  assertTotals(previous.totals, 999.99, 0, 999.99, 1);
  const january = await dashboard(`?year=2026&businessId=${primary.id}`);
  assertTotals(january.totals, 106.46, 150.26, -43.8, 11);
  assertAgreement(january);
  const next = await dashboard(`?year=2027&businessId=${primary.id}`);
  assertTotals(next.totals, 888.88, 0, 888.88, 1);
  const withWallet = await dashboard(`?year=2026&businessId=${primary.id}`);
  await db.businessTransaction.deleteMany({
    where: { businessId: primary.id, description: { startsWith: "Terbaru" } },
  });
  const walletRecent = await dashboard(`?year=2026&businessId=${primary.id}`);
  assert.equal(withWallet.recent.length, 6);
  assert.equal(
    walletRecent.recent.find((row) => row.description === "Awal tahun lokal")!
      .walletName,
    wallet.name,
  );

  const emptyYear = await dashboard("?year=2099");
  assertTotals(emptyYear.totals, 0, 0, 0, 0);
  assert.equal(emptyYear.contributions.length, 14);
  assert.deepEqual(emptyYear.recent, []);
  assert.equal(emptyYear.years[0], 2099);
  assertAgreement(emptyYear);
  const emptyOwner = await dashboard("?year=2026", tokenFor(empty));
  assert.equal(emptyOwner.timezone, "Asia/Jakarta");
  assert.deepEqual(emptyOwner.businesses, []);
  assert.deepEqual(emptyOwner.contributions, []);
  assert.deepEqual(emptyOwner.recent, []);
  assert.equal(emptyOwner.monthly.length, 12);
  assertTotals(emptyOwner.totals, 0, 0, 0, 0);
  assertAgreement(emptyOwner);
  assert.equal((await dashboard("?year=1")).year, 1);
  assert.equal((await dashboard("?year=9998")).year, 9998);

  const vacant = all.businesses.find((row) => row.name === "Kosong 0")!;
  const emptyBusiness = await dashboard(`?year=2026&businessId=${vacant.id}`);
  assertTotals(emptyBusiness.totals, 0, 0, 0, 0);
  assert.equal(emptyBusiness.contributions.length, 1);
  assert.deepEqual(emptyBusiness.recent, []);

  const tieDate = new Date("2028-06-01T12:00:00.000Z");
  await db.businessTransaction.createMany({
    data: [
      {
        id: `${owner}-tie-a`,
        businessId: primary.id,
        type: "income",
        amount: "0.01",
        date: tieDate,
        description: "A",
        createdAt: new Date("2028-06-02T00:00:00Z"),
      },
      {
        id: `${owner}-tie-b`,
        businessId: primary.id,
        type: "income",
        amount: "0.01",
        date: tieDate,
        description: "B",
        createdAt: new Date("2028-06-02T00:00:00Z"),
      },
      {
        id: `${owner}-tie-c`,
        businessId: primary.id,
        type: "income",
        amount: "0.01",
        date: tieDate,
        description: "C",
        createdAt: new Date("2028-06-01T00:00:00Z"),
      },
    ],
  });
  const tied = await dashboard(`?year=2028&businessId=${primary.id}`);
  assert.deepEqual(
    tied.recent.map((row) => row.description),
    ["B", "A", "C"],
  );
  assertTotals(tied.totals, 0.03, 0, 0.03, 3);

  const fallbackBusiness = await db.business.create({
    data: { userId: empty, name: "Zona waktu bawaan" },
  });
  await db.businessTransaction.create({
    data: entry(
      fallbackBusiness.id,
      "income",
      "0.01",
      "2025-12-31T18:00:00.000Z",
      "Januari Jakarta",
    ),
  });
  const fallback = await dashboard("?year=2026", tokenFor(empty));
  assert.equal(fallback.monthly[0]!.income, 0.01);
  assertTotals(fallback.totals, 0.01, 0, 0.01, 1);

  const databaseUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.equal((await request("?year=2026")).status, 503);
    assert.equal((await request("?year=2026", null)).status, 401);
  } finally {
    process.env.DATABASE_URL = databaseUrl;
  }
  console.log("business dashboard integration: passed");
} finally {
  const businesses = await db.business.findMany({
    where: { userId: { in: [owner, foreign, empty] } },
    select: { id: true },
  });
  await db.businessTransaction.deleteMany({
    where: { businessId: { in: businesses.map((row) => row.id) } },
  });
  await db.business.deleteMany({
    where: { userId: { in: [owner, foreign, empty] } },
  });
  await db.wallet.deleteMany({ where: { userId: owner } });
  await db.user.deleteMany({ where: { id: owner } });
  await db.$disconnect();
}
