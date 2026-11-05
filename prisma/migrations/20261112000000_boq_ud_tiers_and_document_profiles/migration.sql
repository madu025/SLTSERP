-- SLT unit-designator BOQ lines (P0/P1/P2 tiers), SLT rate catalogue, PO references on the project and the
-- document layout (profile) per project type. Idempotent.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "poNumber" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "poDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractRef" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sltRef" TEXT;

ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "udNo" INTEGER;
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "unitDesignator" TEXT;
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "supplyTier" TEXT NOT NULL DEFAULT 'P0';
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "rateP0" DECIMAL(14,2);
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "rateP1" DECIMAL(14,2);
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "rateP2" DECIMAL(14,2);
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "boqPart" TEXT;
CREATE INDEX IF NOT EXISTS "ProjectBOQItem_unitDesignator_idx" ON "ProjectBOQItem"("unitDesignator");

ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "invoiceKind" TEXT NOT NULL DEFAULT 'FINAL';

ALTER TABLE "ProjectType" ADD COLUMN IF NOT EXISTS "documentProfile" TEXT;

CREATE TABLE IF NOT EXISTS "SltRateItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "unitDesignator" TEXT NOT NULL,
    "udNo" INTEGER,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "rateP0" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rateP1" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rateP2" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SltRateItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SltRateItem_unitDesignator_key" ON "SltRateItem"("unitDesignator");
CREATE INDEX IF NOT EXISTS "SltRateItem_udNo_idx" ON "SltRateItem"("udNo");

-- Document layout per project type (existing types)
UPDATE "ProjectType" SET "documentProfile" = 'CLUSTER'
WHERE "name" IN ('CLUSTER_DEVELOPMENT', 'BUILDING_FIBER') AND "documentProfile" IS NULL;

-- Types that only exist as folders of sample documents so far
INSERT INTO "ProjectType" ("name", "description", "documentProfile", "updatedAt")
VALUES
  ('CUSTOMER_REQUEST', 'Customer request (CR) works', 'STANDARD', now()),
  ('REHABILITATION_SHIFTING', 'Rehabilitation, shifting and relocation', 'STANDARD', now()),
  ('MARKETING', 'Marketing (customer fibre connections)', 'MARKETING', now())
ON CONFLICT ("name") DO NOTHING;
