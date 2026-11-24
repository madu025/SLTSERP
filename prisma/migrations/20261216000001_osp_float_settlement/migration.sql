-- OSP floats and the settlement of IOUs. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "OspFloat" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "opmcId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limitAmount" DECIMAL(14,2) NOT NULL,
    "maxDaysOutstanding" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OspFloat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OspFloat_opmcId_type_key" ON "OspFloat"("opmcId", "type");
CREATE INDEX IF NOT EXISTS "OspFloat_status_idx" ON "OspFloat"("status");

CREATE TABLE IF NOT EXISTS "OspIouSettlement" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "iouId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "settleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OspIouSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OspIouSettlement_iouId_idx" ON "OspIouSettlement"("iouId");

ALTER TABLE "OspPettyCashIou"
    ADD COLUMN IF NOT EXISTS "floatId" UUID,
    ADD COLUMN IF NOT EXISTS "settledAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "settlementStatus" TEXT NOT NULL DEFAULT 'OPEN',
    ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
