ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "destinationWalletId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "destinationWalletName" TEXT;
