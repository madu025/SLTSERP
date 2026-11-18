-- The contractor reviews a new invoice before it reaches OSP Quality (SF Audit): AWAITING -> CONFIRMED, or DISPUTED with a reason.
-- Every invoice that exists today is already past this step, so the default is CONFIRMED. Additive only.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contractorConfirmStatus" TEXT NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contractorConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contractorConfirmedById" UUID;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contractorNote" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_contractorConfirmStatus_idx" ON "Invoice"("contractorConfirmStatus");
