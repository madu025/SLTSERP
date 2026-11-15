-- Month-end reconciliation of the Head Office current account. Additive only.
CREATE TABLE IF NOT EXISTS "HoReconciliation" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "month" TEXT NOT NULL,
  "ledgerBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "hoBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DIFFERENCE',
  "note" TEXT,
  "recordedById" UUID,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HoReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HoReconciliation_month_key" ON "HoReconciliation"("month");
CREATE INDEX IF NOT EXISTS "HoReconciliation_status_idx" ON "HoReconciliation"("status");
