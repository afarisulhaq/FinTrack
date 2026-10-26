-- Per-user QRIS Gateway settings and Split Bills invoice records.
BEGIN;

CREATE TABLE IF NOT EXISTS "QrisGatewaySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "provider" TEXT,
    "connectionId" TEXT,
    "apiKeyCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QrisGatewaySetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QrisGatewaySetting_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "QrisGatewaySetting_userId_key"
    ON "QrisGatewaySetting"("userId");
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'QrisGatewaySetting_environment_check'
          AND conrelid = '"QrisGatewaySetting"'::regclass
    ) THEN
        ALTER TABLE "QrisGatewaySetting"
            ADD CONSTRAINT "QrisGatewaySetting_environment_check"
            CHECK ("environment" IN ('sandbox', 'production'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'QrisGatewaySetting_provider_check'
          AND conrelid = '"QrisGatewaySetting"'::regclass
    ) THEN
        ALTER TABLE "QrisGatewaySetting"
            ADD CONSTRAINT "QrisGatewaySetting_provider_check"
            CHECK ("provider" IS NULL OR "provider" IN ('gopay', 'shopeepay'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "QrisSplitInvoice" (
    "id" TEXT NOT NULL,
    "splitBillId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "baseAmount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "qrisCode" TEXT,
    "checkoutUrl" TEXT,
    "gatewayReference" TEXT,
    "gatewayAccount" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QrisSplitInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QrisSplitInvoice_splitBillId_fkey"
        FOREIGN KEY ("splitBillId") REFERENCES "SplitBill"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrisSplitInvoice_amount_check"
        CHECK ("baseAmount" > 0 AND "amount" >= "baseAmount")
);
CREATE INDEX IF NOT EXISTS "QrisSplitInvoice_ownerId_participantId_createdAt_idx"
    ON "QrisSplitInvoice"("ownerId", "participantId", "createdAt");
CREATE INDEX IF NOT EXISTS "QrisSplitInvoice_splitBillId_participantId_status_expiresAt_idx"
    ON "QrisSplitInvoice"("splitBillId", "participantId", "status", "expiresAt");

COMMIT;
