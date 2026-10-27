-- Project delivery workflow: child projects, contractor allocation, traceable task/BOQ ownership,
-- and contractor-specific invoice lifecycle fields.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "parentId" UUID;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "planningSource" TEXT NOT NULL DEFAULT 'GIS';
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "contractorId" UUID;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "contractorAssignmentId" UUID;
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "taskId" UUID;
ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "contractorId" UUID;
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "contractorId" UUID;
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "followUpNotes" TEXT;
ALTER TABLE "ProjectInvoice" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProjectContractorAssignment" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "contractorId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'IMPLEMENTATION',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "allocationPercent" DECIMAL(8,4),
  "contractValue" DECIMAL(14,2),
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectContractorAssignment_projectId_contractorId_key"
  ON "ProjectContractorAssignment"("projectId", "contractorId");
CREATE INDEX IF NOT EXISTS "ProjectContractorAssignment_projectId_idx" ON "ProjectContractorAssignment"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectContractorAssignment_contractorId_idx" ON "ProjectContractorAssignment"("contractorId");
CREATE INDEX IF NOT EXISTS "ProjectContractorAssignment_status_idx" ON "ProjectContractorAssignment"("status");
CREATE INDEX IF NOT EXISTS "Project_parentId_idx" ON "Project"("parentId");
CREATE INDEX IF NOT EXISTS "Project_planningSource_idx" ON "Project"("planningSource");
CREATE INDEX IF NOT EXISTS "ProjectTask_contractorId_idx" ON "ProjectTask"("contractorId");
CREATE INDEX IF NOT EXISTS "ProjectTask_contractorAssignmentId_idx" ON "ProjectTask"("contractorAssignmentId");
CREATE INDEX IF NOT EXISTS "ProjectBOQItem_taskId_idx" ON "ProjectBOQItem"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectBOQItem_contractorId_idx" ON "ProjectBOQItem"("contractorId");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_contractorId_idx" ON "ProjectInvoice"("contractorId");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_projectId_contractorId_status_idx" ON "ProjectInvoice"("projectId", "contractorId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_parentId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContractorAssignment_projectId_fkey') THEN
    ALTER TABLE "ProjectContractorAssignment" ADD CONSTRAINT "ProjectContractorAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContractorAssignment_contractorId_fkey') THEN
    ALTER TABLE "ProjectContractorAssignment" ADD CONSTRAINT "ProjectContractorAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_contractorId_fkey') THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_contractorAssignmentId_fkey') THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ProjectContractorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectBOQItem_taskId_fkey') THEN
    ALTER TABLE "ProjectBOQItem" ADD CONSTRAINT "ProjectBOQItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectBOQItem_contractorId_fkey') THEN
    ALTER TABLE "ProjectBOQItem" ADD CONSTRAINT "ProjectBOQItem_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectInvoice_contractorId_fkey') THEN
    ALTER TABLE "ProjectInvoice" ADD CONSTRAINT "ProjectInvoice_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "ProjectContractorAssignment" ("projectId", "contractorId", "role", "status")
SELECT p."id", p."contractorId", 'PRIMARY', 'ACTIVE'
FROM "Project" p
WHERE p."contractorId" IS NOT NULL
ON CONFLICT ("projectId", "contractorId") DO NOTHING;

UPDATE "ProjectTask" t
SET "contractorId" = t."assigneeId"
WHERE t."assigneeType" = 'CONTRACTOR'
  AND t."assigneeId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Contractor" c WHERE c."id" = t."assigneeId");

UPDATE "ProjectTask" t
SET "contractorAssignmentId" = a."id"
FROM "ProjectContractorAssignment" a
WHERE a."projectId" = t."projectId" AND a."contractorId" = t."contractorId";
