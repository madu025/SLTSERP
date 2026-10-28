-- Inventory-side supply routing for approved project material demand.
-- This migration does not alter Project.status or the Project workflow.

CREATE TABLE IF NOT EXISTS "ProjectMaterialSupplyAllocation" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "requirementId" UUID NOT NULL,
  "sourceType" TEXT NOT NULL,
  "storeId" UUID,
  "stockRequestId" UUID,
  "requestedQty" DECIMAL(14,4) NOT NULL,
  "approvedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "receivedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "reservedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "issuedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "requiredDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMaterialSupplyAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMaterialSupplyAllocation_requirementId_sourceType_key"
  ON "ProjectMaterialSupplyAllocation"("requirementId", "sourceType");
CREATE INDEX IF NOT EXISTS "ProjectMaterialSupplyAllocation_requirementId_status_idx"
  ON "ProjectMaterialSupplyAllocation"("requirementId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMaterialSupplyAllocation_stockRequestId_idx"
  ON "ProjectMaterialSupplyAllocation"("stockRequestId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialSupplyAllocation_storeId_status_idx"
  ON "ProjectMaterialSupplyAllocation"("storeId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMaterialSupplyAllocation_sourceType_status_idx"
  ON "ProjectMaterialSupplyAllocation"("sourceType", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialSupplyAllocation_requirementId_fkey') THEN
    ALTER TABLE "ProjectMaterialSupplyAllocation" ADD CONSTRAINT "ProjectMaterialSupplyAllocation_requirementId_fkey"
      FOREIGN KEY ("requirementId") REFERENCES "ProjectMaterialRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialSupplyAllocation_storeId_fkey') THEN
    ALTER TABLE "ProjectMaterialSupplyAllocation" ADD CONSTRAINT "ProjectMaterialSupplyAllocation_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialSupplyAllocation_stockRequestId_fkey') THEN
    ALTER TABLE "ProjectMaterialSupplyAllocation" ADD CONSTRAINT "ProjectMaterialSupplyAllocation_stockRequestId_fkey"
      FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialSupplyAllocation_createdById_fkey') THEN
    ALTER TABLE "ProjectMaterialSupplyAllocation" ADD CONSTRAINT "ProjectMaterialSupplyAllocation_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
  END IF;
END $$;
