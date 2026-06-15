import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === "production";

  // ── App-level settings (always, regardless of env) ────────────────
  // AppSetting is a singleton row used by the admin Pengaturan App page.
  const settingCount = await prisma.appSetting.count();
  if (settingCount === 0) {
    await prisma.appSetting.create({ data: {} });
  }

  // Bot connection rows are also singletons (one per channel). The bot
  // service reads/writes these to surface its status in the UI.
  await prisma.botConnection.upsert({
    where: { channel: "whatsapp" },
    update: {},
    create: { channel: "whatsapp", enabled: false, status: "disconnected" },
  });
  await prisma.botConnection.upsert({
    where: { channel: "telegram" },
    update: {},
    create: { channel: "telegram", enabled: false, status: "disconnected" },
  });

  // ── Bootstrap an admin user ───────────────────────────────────────
  //
  // Production: an admin is created only when ADMIN_EMAIL and
  //   ADMIN_PASSWORD are set in the environment. This prevents the
  //   insecure `admin@fintrack.app / admin123` default from being
  //   installed on a public deployment.
  //
  // Development: the default admin + demo user are always seeded so
  //   you can log in immediately and explore the app.
  let primaryUser: { id: string; email: string } | null = null;

  if (isProduction) {
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const admin = await prisma.user.upsert({
        where: { email: process.env.ADMIN_EMAIL },
        update: {},
        create: {
          name: process.env.ADMIN_NAME ?? "Admin",
          email: process.env.ADMIN_EMAIL,
          password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
          role: "admin",
          status: "active",
        },
      });
      primaryUser = admin;
      console.log(`✅ Admin user ensured: ${admin.email}`);
    } else {
      console.warn(
        "⚠️  ADMIN_EMAIL and ADMIN_PASSWORD are not set. " +
          "No admin user was created. Set them in .env.production and " +
          "re-run the seed (or register the first user via /register " +
          "and promote them to admin with `prisma studio`).",
      );
    }
    // Production: skip the demo data block below entirely. The new
    // admin starts with an empty workspace and builds their own data.
  } else {
    // Dev: default admin + demo user with the familiar credentials.
    const admin = await prisma.user.upsert({
      where: { email: "admin@fintrack.app" },
      update: {},
      create: {
        name: "Admin FinTrack",
        email: "admin@fintrack.app",
        password: await bcrypt.hash("admin123", 10),
        role: "admin",
        status: "active",
      },
    });
    const demo = await prisma.user.upsert({
      where: { email: "demo@fintrack.app" },
      update: {},
      create: {
        name: "Andi Pratama",
        email: "demo@fintrack.app",
        password: await bcrypt.hash("demo123", 10),
        role: "owner",
        status: "active",
      },
    });
    primaryUser = demo;
    console.log(
      `Dev seed complete. Admin: ${admin.email} / admin123 — Demo: ${demo.email} / demo123`,
    );
  }

  // If there's no user to attach sample data to (e.g. production
  // without env-var admin), bail before we try to seed categories /
  // wallets / etc. under a non-existent userId.
  if (!primaryUser) {
    console.log("No primary user — skipping sample data seed.");
    return;
  }
  const userId = primaryUser.id;

  // ── Master + sub categories ───────────────────────────────────────
  // Seeded with `isSystem: true` so they survive a "reset data" sweep.
  // The Category↔SubCategory link uses the `id` we set so re-running
  // the seed (idempotent) just no-ops the sub-categories.
  await prisma.category.upsert({
    where: { id: "cat-inc-gaji" },
    update: {},
    create: {
      id: "cat-inc-gaji",
      type: "income",
      name: "Gaji",
      icon: "💼",
      color: "#22c55e",
      sortOrder: 0,
      isSystem: true,
      userId,
    },
  });
  await prisma.subCategory.upsert({
    where: { id: "sub-inc-gaji-pokok" },
    update: {},
    create: {
      id: "sub-inc-gaji-pokok",
      name: "Gaji Pokok",
      icon: "💵",
      color: "#22c55e",
      sortOrder: 0,
      isSystem: true,
      userId,
      categoryId: "cat-inc-gaji",
    },
  });
  await prisma.subCategory.upsert({
    where: { id: "sub-inc-gaji-bonus" },
    update: {},
    create: {
      id: "sub-inc-gaji-bonus",
      name: "Bonus",
      icon: "🎁",
      color: "#16a34a",
      sortOrder: 1,
      isSystem: true,
      userId,
      categoryId: "cat-inc-gaji",
    },
  });
  await prisma.subCategory.upsert({
    where: { id: "sub-inc-gaji-tunjangan" },
    update: {},
    create: {
      id: "sub-inc-gaji-tunjangan",
      name: "Tunjangan",
      icon: "🏆",
      color: "#15803d",
      sortOrder: 2,
      isSystem: true,
      userId,
      categoryId: "cat-inc-gaji",
    },
  });
  const incomeSeed = [
    {
      id: "cat-inc-freelance",
      name: "Freelance",
      icon: "💻",
      color: "#06b6d4",
    },
    {
      id: "cat-inc-investasi",
      name: "Investasi",
      icon: "📈",
      color: "#a855f7",
    },
    { id: "cat-inc-hadiah", name: "Hadiah", icon: "🎁", color: "#f59e0b" },
  ];
  for (const [i, c] of incomeSeed.entries()) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        type: "income",
        name: c.name,
        icon: c.icon,
        color: c.color,
        sortOrder: i + 1,
        isSystem: true,
        userId,
      },
    });
  }
  const expenseSeed = [
    { id: "cat-exp-makan", name: "Makan", icon: "🍔", color: "#f97316" },
    {
      id: "cat-exp-transport",
      name: "Transport",
      icon: "🚗",
      color: "#3b82f6",
    },
    { id: "cat-exp-belanja", name: "Belanja", icon: "🛍️", color: "#a855f7" },
    { id: "cat-exp-hiburan", name: "Hiburan", icon: "🎬", color: "#ec4899" },
    {
      id: "cat-exp-kesehatan",
      name: "Kesehatan",
      icon: "🏥",
      color: "#22c55e",
    },
    { id: "cat-exp-tagihan", name: "Tagihan", icon: "💡", color: "#6366f1" },
  ];
  for (const [i, c] of expenseSeed.entries()) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        type: "expense",
        name: c.name,
        icon: c.icon,
        color: c.color,
        sortOrder: i,
        isSystem: true,
        userId,
      },
    });
  }

  await prisma.wallet.upsert({
    where: { id: "w-bca" },
    update: {},
    create: {
      id: "w-bca",
      name: "BCA",
      type: "bank",
      balance: 15000000,
      currency: "IDR",
      color: "#1e40af",
      icon: "🏦",
      userId,
    },
  });
  await prisma.wallet.upsert({
    where: { id: "w-bca-jajan" },
    update: {},
    create: {
      id: "w-bca-jajan",
      name: "Kantong Jajan",
      type: "bank",
      balance: 500000,
      currency: "IDR",
      color: "#3b82f6",
      icon: "🍔",
      parentId: "w-bca",
      userId,
    },
  });
  await prisma.wallet.upsert({
    where: { id: "w-bca-tabungan" },
    update: {},
    create: {
      id: "w-bca-tabungan",
      name: "Kantong Tabungan",
      type: "savings",
      balance: 3000000,
      currency: "IDR",
      color: "#0ea5e9",
      icon: "💰",
      parentId: "w-bca",
      userId,
    },
  });
  await prisma.wallet.upsert({
    where: { id: "w-mandiri" },
    update: {},
    create: {
      id: "w-mandiri",
      name: "Mandiri",
      type: "bank",
      balance: 8000000,
      currency: "IDR",
      color: "#d97706",
      icon: "🏛️",
      userId,
    },
  });
  await prisma.wallet.upsert({
    where: { id: "w-gopay" },
    update: {},
    create: {
      id: "w-gopay",
      name: "GoPay",
      type: "e-wallet",
      balance: 250000,
      currency: "IDR",
      color: "#22c55e",
      icon: "📱",
      userId,
    },
  });
  await prisma.wallet.upsert({
    where: { id: "w-cash" },
    update: {},
    create: {
      id: "w-cash",
      name: "Cash",
      type: "cash",
      balance: 500000,
      currency: "IDR",
      color: "#64748b",
      icon: "💵",
      userId,
    },
  });

  await prisma.transaction.upsert({
    where: { id: "tx-1" },
    update: {},
    create: {
      id: "tx-1",
      type: "expense",
      amount: 25000,
      category: "Kopi",
      categoryIcon: "☕",
      walletId: "w-bca-jajan",
      walletName: "Kantong Jajan",
      description: "Beli kopi",
      date: new Date(),
      userId,
    },
  });
  await prisma.transaction.upsert({
    where: { id: "tx-2" },
    update: {},
    create: {
      id: "tx-2",
      type: "income",
      amount: 8000000,
      category: "Gaji",
      categoryIcon: "💼",
      walletId: "w-bca",
      walletName: "BCA",
      description: "Gaji bulanan",
      date: new Date(),
      userId,
    },
  });

  await prisma.budget.upsert({
    where: { id: "bdg-1" },
    update: {},
    create: {
      id: "bdg-1",
      category: "Makan",
      categoryIcon: "🍔",
      limit: 1500000,
      spent: 820000,
      period: "monthly",
      color: "#f97316",
      userId,
    },
  });
  await prisma.budget.upsert({
    where: { id: "bdg-2" },
    update: {},
    create: {
      id: "bdg-2",
      category: "Transport",
      categoryIcon: "🚗",
      limit: 700000,
      spent: 520000,
      period: "monthly",
      color: "#3b82f6",
      userId,
    },
  });

  await prisma.investment.upsert({
    where: { id: "inv-bbca" },
    update: {},
    create: {
      id: "inv-bbca",
      name: "Bank Central Asia",
      symbol: "BBCA.JK",
      assetClass: "stock",
      broker: "Stockbit",
      quantity: 100,
      avgBuyPrice: 9000,
      currentPrice: 9500,
      currency: "IDR",
      color: "#6366f1",
      userId,
    },
  });
  await prisma.investment.upsert({
    where: { id: "inv-antm" },
    update: {},
    create: {
      id: "inv-antm",
      name: "Aneka Tambang",
      symbol: "ANTM.JK",
      assetClass: "stock",
      broker: "Ajaib",
      quantity: 200,
      avgBuyPrice: 1800,
      currentPrice: 1700,
      currency: "IDR",
      color: "#6366f1",
      userId,
    },
  });

  await prisma.bill.upsert({
    where: { id: "bill-1" },
    update: {},
    create: {
      id: "bill-1",
      name: "Internet Rumah",
      amount: 350000,
      dueDate: new Date(Date.now() + 86400000 * 5),
      status: "unpaid",
      category: "Utilitas",
      icon: "🌐",
      isRecurring: true,
      recurringPeriod: "monthly",
      userId,
    },
  });

  await prisma.savingGoal.upsert({
    where: { id: "goal-1" },
    update: {},
    create: {
      id: "goal-1",
      name: "Dana Darurat",
      icon: "🛡️",
      targetAmount: 30000000,
      currentAmount: 8500000,
      deadline: new Date(Date.now() + 86400000 * 180),
      color: "#22c55e",
      userId,
    },
  });

  await prisma.note.upsert({
    where: { id: "note-1" },
    update: {},
    create: {
      id: "note-1",
      title: "Ide hemat bulan ini",
      content: "Kurangi beli kopi di luar, masak dari rumah.",
      tags: ["hemat"],
      color: "#1a1d27",
      userId,
    },
  });

  await prisma.recurringTransaction.upsert({
    where: { id: "rec-1" },
    update: {},
    create: {
      id: "rec-1",
      name: "Netflix",
      amount: 65000,
      type: "expense",
      category: "Hiburan",
      categoryIcon: "🎬",
      walletId: "w-bca",
      period: "monthly",
      nextDate: new Date(Date.now() + 86400000 * 10),
      isActive: true,
      userId,
    },
  });

  console.log("Sample data seeded for", primaryUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
