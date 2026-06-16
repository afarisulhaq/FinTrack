// prisma/clean-sample-data.ts
//
// One-off cleanup for the demo data that an older release of the
// production seed accidentally created (BCA / Mandiri / GoPay / Cash
// wallets, sample transactions, budgets, investments, an Internet
// bill, a Dana Darurat goal, etc., all tied to the env-var admin).
//
// Run with:
//   npx tsx prisma/clean-sample-data.ts
// or:
//   npm run db:clean-sample
//
// Safe to re-run: a second invocation is a no-op.
//
// What it does:
//   1. Looks up the admin user by ADMIN_EMAIL.
//   2. Deletes every row in the user-data tables that references that
//      user via `userId`.
//   3. Leaves the User row itself, the AppSetting singleton, and the
//      BotConnection rows untouched — those are infrastructure, not
//      sample data.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clean() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) {
    console.error(
      "ADMIN_EMAIL is not set. Set it in .env.production (or pass it inline) and re-run.",
    );
    process.exit(1);
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.log(
      `No user with email ${adminEmail} found — nothing to clean.`,
    );
    return;
  }
  const userId = admin.id;
  console.log(
    `🧹 Cleaning sample data for admin: ${admin.email} (${userId})`,
  );

  // SubCategory first: Category has a Cascade relation to it, so deleting
  // the parent rows would otherwise sweep the children in an order that
  // is harder to audit. Doing it explicitly keeps the counts clean.
  const subCategories = await prisma.subCategory.deleteMany({
    where: { userId },
  });
  const categories = await prisma.category.deleteMany({ where: { userId } });
  const transactions = await prisma.transaction.deleteMany({
    where: { userId },
  });
  const wallets = await prisma.wallet.deleteMany({ where: { userId } });
  const budgets = await prisma.budget.deleteMany({ where: { userId } });
  const investments = await prisma.investment.deleteMany({
    where: { userId },
  });
  const bills = await prisma.bill.deleteMany({ where: { userId } });
  const goals = await prisma.savingGoal.deleteMany({ where: { userId } });
  const notes = await prisma.note.deleteMany({ where: { userId } });
  const recurring = await prisma.recurringTransaction.deleteMany({
    where: { userId },
  });

  const counts = {
    SubCategory: subCategories.count,
    Category: categories.count,
    Transaction: transactions.count,
    Wallet: wallets.count,
    Budget: budgets.count,
    Investment: investments.count,
    Bill: bills.count,
    SavingGoal: goals.count,
    Note: notes.count,
    RecurringTransaction: recurring.count,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log("Deleted rows:");
  for (const [model, n] of Object.entries(counts)) {
    console.log(`  ${model.padEnd(22)} ${n}`);
  }
  console.log(`  ${"─".repeat(30)}`);
  console.log(`  ${"Total".padEnd(22)} ${total}`);
  console.log(
    `\nAdmin user, AppSetting, and BotConnection rows left intact.`,
  );
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
