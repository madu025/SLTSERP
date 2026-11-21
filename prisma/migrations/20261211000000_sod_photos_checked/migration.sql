-- The check that makes a finished order ready for invoicing is done on the Completed SOD page: connection complete (with its PAT), material entered,
-- photos received and checked. The photos check is recorded on the order itself (who, when). Additive; safe to run twice.
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "photosCheckedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "photosCheckedById" UUID;
