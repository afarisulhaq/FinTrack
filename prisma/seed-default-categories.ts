import { PrismaClient } from "@prisma/client";
import { ensureCategoryDefaults } from "../server/services/default-categories.js";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.user.findMany({ select: { id: true } });
  for (const account of accounts)
    await ensureCategoryDefaults(prisma, account.id);
  console.log(`Kategori default diperiksa untuk ${accounts.length} akun.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
