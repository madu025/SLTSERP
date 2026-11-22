-- After the Completed SOD check the contractor verifies each order before the engineer invoices it; a problem sends the order back to the check with a note.
-- Additive; safe to run twice.
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "contractorVerifiedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "contractorVerifiedById" UUID;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "sodReturnNote" TEXT;
