-- Petty cash: the IOU draws cash from the site office box; a bill records the IOU it belongs to; a cancelled bill keeps its reason. Additive and idempotent.
ALTER TABLE "PettyCashVoucher"
    ADD COLUMN IF NOT EXISTS "iouId" UUID,
    ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT,
    ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "carriedToNumber" TEXT;
CREATE INDEX IF NOT EXISTS "PettyCashVoucher_iouId_idx" ON "PettyCashVoucher"("iouId");
ALTER TABLE "OspPettyCashIou" ADD COLUMN IF NOT EXISTS "pettyCashAccountId" UUID;
