-- QRIS Gateway /v1 integration (docs/subscriptions-qris.md).
--
-- The gateway now owns the unique payable code (Rp0..99) and receipt claims,
-- so FinTrack no longer reserves a local unique amount and no longer records
-- a provider transaction id. Existing rows keep their amounts and paid
-- status; only the constraints and the claim column change.
--
-- Apply in every environment that ran 20261008-subscriptions.sql, including
-- development databases: the old CHECK (amount > baseAmount) would reject a
-- payable total that equals the plan price.
BEGIN;
ALTER TABLE "SubscriptionInvoice"
    DROP CONSTRAINT IF EXISTS "SubscriptionInvoice_providerTransactionId_key";
ALTER TABLE "SubscriptionInvoice"
    DROP COLUMN IF EXISTS "providerTransactionId";
ALTER TABLE "SubscriptionInvoice"
    DROP CONSTRAINT IF EXISTS "SubscriptionInvoice_amount_key";
ALTER TABLE "SubscriptionInvoice"
    DROP CONSTRAINT IF EXISTS "SubscriptionInvoice_amount_baseAmount_check";
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SubscriptionInvoice_amount_check'
          AND conrelid = '"SubscriptionInvoice"'::regclass
    ) THEN
        ALTER TABLE "SubscriptionInvoice"
            ADD CONSTRAINT "SubscriptionInvoice_amount_check"
            CHECK ("amount" >= "baseAmount");
    END IF;
END $$;
ALTER TABLE "SubscriptionInvoice"
    ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;
COMMIT;
