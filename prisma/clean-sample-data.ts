// prisma/clean-sample-data.ts
//
// One-off cleanup for the demo data that an older release of the
// production seed accidentally created (BCA / Mandiri / GoPay / Cash
// wallets, sample transactions, budgets, investments, an Internet
// bill, a Dana Darurat goal, plus a swarm of sample User rows, etc.,
// all tied to demo email addresses).
//
// Run with:
//   npx tsx prisma/clean-sample-data.ts
// or:
//   npm run db:clean-sample
//
// Pass `--dry-run` (or set DRY_RUN=1) to print the plan without
// deleting anything — useful the first time you run this on a
// production DB so you can see exactly which rows go away.
//
// Safe to re-run: a second invocation is a no-op (all the
// targeted rows are already gone).
//
// What it does:
//   1. Looks up the admin user by ADMIN_EMAIL.
//   2. Deletes every other User row (and the data that cascades
//      off them — the schema's onDelete: Cascade handles this).
//   3. Deletes every row in the user-data tables that references
//      the admin via `userId` (so the admin also starts fresh).
//   4. Leaves the Admin User row itself, the AppSetting singleton,
//      and the BotConnection rows untouched — those are
//      infrastructure, not sample data.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const isDryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

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
    `🧹 ${isDryRun ? "Planning" : "Cleaning"} sample data — admin: ${admin.email} (${userId})`,
  );

  // ── 1. Drop every other User row (cascades to their wallets, etc.) ────
  // The schema declares onDelete: Cascade on the userId FK in every
  // user-data table, so deleting the users wipes their data too.
  const extraUsers = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true, email: true, role: true, status: true },
  });
  if (extraUsers.length > 0) {
    console.log(
      `\n  Extra User rows to delete: ${extraUsers.length}` +
        (isDryRun ? "" : ""),
    );
    if (!isDryRun) {
      for (const u of extraUsers.slice(0, 10)) {
        console.log(`    - ${u.email} (${u.role}, ${u.status})`);
      }
      if (extraUsers.length > 10) {
        console.log(`    - …and ${extraUsers.length - 10} more`);
      }
    }
  } else {
    console.log("\n  No extra User rows to delete.");
  }

  // Actually drop the extra users (and their cascaded data).
  const deletedUsers = isDryRun
    ? { count: 0 }
    : await prisma.user.deleteMany({ where: { id: { not: userId } } });

  // ── 2. Wipe the admin's per-user data so they start with an empty ─────
  // workspace. Same explicit order as before: SubCategory first so
  // we can audit the cascade, then the rest.
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
    User: deletedUsers.count,
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

  if (isDryRun) {
    console.log("\nDry run — no rows were deleted. Plan:");
    for (const [model, n] of Object.entries(counts)) {
      console.log(`  ${model.padEnd(22)} ${n}`);
    }
    console.log(`  ${"─".repeat(30)}`);
    console.log(`  ${"Total".padEnd(22)} ${total}`);
    console.log(
      "\nRe-run without --dry-run (or unset DRY_RUN) to actually delete.",
    );
    return;
  }

  console.log("\nDeleted rows:");
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
