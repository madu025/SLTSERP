-- Supply chain phase 2, release B: RFQ and quotation award, maker on project purchase orders.
-- Additive only.
ALTER TABLE "ProjectPurchaseOrder" ADD COLUMN IF NOT EXISTS "quotationId" UUID;
ALTER TABLE "ProjectPurchaseOrder" ADD COLUMN IF NOT EXISTS "createdById" UUID;
CREATE INDEX IF NOT EXISTS "ProjectPurchaseOrder_quotationId_idx" ON "ProjectPurchaseOrder"("quotationId");
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3);
