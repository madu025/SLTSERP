-- Head Office collection side: client invoices are sent to Head Office as records and Head Office collects from SLT. Additive only.
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "hoCollectionStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "hoBillingBatchId" UUID;
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "sentToHoAt" TIMESTAMP(3);
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "sentToHoById" UUID;
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "hoReturnReason" TEXT;
CREATE INDEX IF NOT EXISTS "ProjectInvoice_hoBillingBatchId_idx" ON "ProjectInvoice"("hoBillingBatchId");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_hoCollectionStatus_idx" ON "ProjectInvoice"("hoCollectionStatus");

CREATE TABLE IF NOT EXISTS "HoBillingBatch" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "batchNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "invoiceCount" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" UUID,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HoBillingBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HoBillingBatch_batchNumber_key" ON "HoBillingBatch"("batchNumber");
CREATE INDEX IF NOT EXISTS "HoBillingBatch_status_idx" ON "HoBillingBatch"("status");
CREATE INDEX IF NOT EXISTS "HoBillingBatch_createdById_idx" ON "HoBillingBatch"("createdById");
