BEGIN;
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT,
    "plan" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "plan" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL CHECK ("baseAmount" > 0),
    "amount" INTEGER NOT NULL UNIQUE CHECK ("amount" > "baseAmount"),
    "durationDays" INTEGER NOT NULL CHECK ("durationDays" > 0),
    "status" TEXT NOT NULL DEFAULT 'creating',
    "qrisCode" TEXT,
    "gatewayReference" TEXT,
    "gatewayAccount" TEXT NOT NULL,
    "providerTransactionId" TEXT UNIQUE,
    "paidAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_userId_createdAt_idx"
    ON "SubscriptionInvoice"("userId", "createdAt");
COMMIT;
