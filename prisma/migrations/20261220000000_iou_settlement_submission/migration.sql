-- The custodian's settlement of an IOU waits for the Area Manager's verification. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "OspIouSettlementSubmission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "iouId" UUID NOT NULL,
    "billsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "receiptUrl" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" UUID,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OspIouSettlementSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OspIouSettlementSubmission_iouId_idx" ON "OspIouSettlementSubmission"("iouId");
CREATE INDEX IF NOT EXISTS "OspIouSettlementSubmission_status_idx" ON "OspIouSettlementSubmission"("status");
