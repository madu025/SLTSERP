-- Project material demand, store reservation, and batch-level allocation.
-- Project/BOQ approval creates requirements only; reservation is a separate
-- Stores action and does not deduct physical stock.

CREATE TABLE IF NOT EXISTS "ProjectMaterialRequirement" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "boqItemId" UUID NOT NULL,
  "taskId" UUID,
  "contractorAssignmentId" UUID,
  "itemId" UUID,
  "requiredQty" DECIMAL(14,4) NOT NULL,
  "reservedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "issuedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "returnedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "shortageQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "procurementStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMaterialRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMaterialRequirement_boqItemId_key"
  ON "ProjectMaterialRequirement"("boqItemId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialRequirement_projectId_status_idx"
  ON "ProjectMaterialRequirement"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMaterialRequirement_itemId_idx"
  ON "ProjectMaterialRequirement"("itemId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialRequirement_taskId_idx"
  ON "ProjectMaterialRequirement"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialRequirement_contractorAssignmentId_idx"
  ON "ProjectMaterialRequirement"("contractorAssignmentId");

CREATE TABLE IF NOT EXISTS "ProjectMaterialReservation" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "reservationNumber" TEXT NOT NULL,
  "projectId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "createdById" UUID NOT NULL,
  "releasedById" UUID,
  "releasedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMaterialReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMaterialReservation_reservationNumber_key"
  ON "ProjectMaterialReservation"("reservationNumber");
CREATE INDEX IF NOT EXISTS "ProjectMaterialReservation_projectId_status_idx"
  ON "ProjectMaterialReservation"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMaterialReservation_storeId_status_idx"
  ON "ProjectMaterialReservation"("storeId", "status");
CREATE INDEX IF NOT EXISTS "ProjectMaterialReservation_createdById_idx"
  ON "ProjectMaterialReservation"("createdById");

CREATE TABLE IF NOT EXISTS "ProjectMaterialReservationLine" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "reservationId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "batchId" UUID,
  "batchStockId" UUID,
  "quantity" DECIMAL(14,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMaterialReservationLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectMaterialReservationLine_reservationId_idx"
  ON "ProjectMaterialReservationLine"("reservationId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialReservationLine_requirementId_idx"
  ON "ProjectMaterialReservationLine"("requirementId");
CREATE INDEX IF NOT EXISTS "ProjectMaterialReservationLine_itemId_batchId_idx"
  ON "ProjectMaterialReservationLine"("itemId", "batchId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialRequirement_projectId_fkey') THEN
    ALTER TABLE "ProjectMaterialRequirement" ADD CONSTRAINT "ProjectMaterialRequirement_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialRequirement_boqItemId_fkey') THEN
    ALTER TABLE "ProjectMaterialRequirement" ADD CONSTRAINT "ProjectMaterialRequirement_boqItemId_fkey"
      FOREIGN KEY ("boqItemId") REFERENCES "ProjectBOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialRequirement_taskId_fkey') THEN
    ALTER TABLE "ProjectMaterialRequirement" ADD CONSTRAINT "ProjectMaterialRequirement_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialRequirement_contractorAssignmentId_fkey') THEN
    ALTER TABLE "ProjectMaterialRequirement" ADD CONSTRAINT "ProjectMaterialRequirement_contractorAssignmentId_fkey"
      FOREIGN KEY ("contractorAssignmentId") REFERENCES "ProjectContractorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialRequirement_itemId_fkey') THEN
    ALTER TABLE "ProjectMaterialRequirement" ADD CONSTRAINT "ProjectMaterialRequirement_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservation_projectId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservation" ADD CONSTRAINT "ProjectMaterialReservation_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservation_storeId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservation" ADD CONSTRAINT "ProjectMaterialReservation_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservation_createdById_fkey') THEN
    ALTER TABLE "ProjectMaterialReservation" ADD CONSTRAINT "ProjectMaterialReservation_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservation_releasedById_fkey') THEN
    ALTER TABLE "ProjectMaterialReservation" ADD CONSTRAINT "ProjectMaterialReservation_releasedById_fkey"
      FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservationLine_reservationId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservationLine" ADD CONSTRAINT "ProjectMaterialReservationLine_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "ProjectMaterialReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservationLine_requirementId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservationLine" ADD CONSTRAINT "ProjectMaterialReservationLine_requirementId_fkey"
      FOREIGN KEY ("requirementId") REFERENCES "ProjectMaterialRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservationLine_itemId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservationLine" ADD CONSTRAINT "ProjectMaterialReservationLine_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservationLine_batchId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservationLine" ADD CONSTRAINT "ProjectMaterialReservationLine_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMaterialReservationLine_batchStockId_fkey') THEN
    ALTER TABLE "ProjectMaterialReservationLine" ADD CONSTRAINT "ProjectMaterialReservationLine_batchStockId_fkey"
      FOREIGN KEY ("batchStockId") REFERENCES "InventoryBatchStock"("id") ON UPDATE CASCADE;
  END IF;
END $$;
