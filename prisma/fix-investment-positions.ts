// prisma/fix-investment-positions.ts
//
// One-off data fixup for the new Investment model where
// `quantity` represents lots currently held (not the original
// buy amount) and `soldQuantity` tracks cumulative sells.
//
// The previous code stored the original buy amount in `quantity`
// and set `sellPrice` to mark a position as fully sold. After
// the schema change, any row with `sellPrice != null` and
// `quantity > 0` is in the old format -- the user actually sold
// all of it but we left the buy amount sitting in `quantity`.
//
// Run with:
//   npx tsx prisma/fix-investment-positions.ts
// or:
//   npm run db:fix-investments
//
// Safe to re-run: a second invocation is a no-op (all matching
// rows already have quantity = 0 after the first run).
//
// What it does:
//   1. Finds every Investment where sellPrice IS NOT NULL and
//      quantity > 0 (old-format full sells).
//   2. Sets quantity = 0 (position is now closed).
//   3. Sets soldQuantity = <old quantity> (so the cumulative-sold
//      counter equals the buy amount, which is what "fully sold"
//      means).
//   4. Leaves sellPrice / soldAt / sellFee / avgBuyPrice untouched
//      -- those are still meaningful for the "Terjual" tab.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fix() {
  const targets = await prisma.investment.findMany({
    where: {
      sellPrice: { not: null },
      quantity: { gt: 0 },
    },
    select: { id: true, name: true, quantity: true, soldQuantity: true },
  });

  if (targets.length === 0) {
    console.log("No old-format positions found. Nothing to fix.");
    return;
  }

  console.log(
    `Found ${targets.length} position(s) in old format. Migrating...`,
  );

  let updated = 0;
  for (const t of targets) {
    const oldQty = Number(t.quantity);
    await prisma.investment.update({
      where: { id: t.id },
      data: {
        quantity: 0,
        soldQuantity: oldQty,
      },
    });
    updated += 1;
    console.log(
      `  - ${t.name} (${t.id.slice(0, 8)}...): qty ${oldQty} -> 0, soldQty -> ${oldQty}`,
    );
  }

  console.log(`\nMigrated ${updated} position(s).`);
}

fix()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
