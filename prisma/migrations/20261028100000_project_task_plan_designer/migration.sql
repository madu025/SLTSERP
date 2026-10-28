-- Supervisor-configured, versioned task plan and generated WBS traceability.

ALTER TABLE "ProjectTask"
  ADD COLUMN "assignedUserId" UUID,
  ADD COLUMN "planItemId" UUID;

ALTER TABLE "ProjectTaskInstance"
  ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sourceTemplateId" UUID;

ALTER TABLE "WorkflowTaskTemplate"
  ADD COLUMN "defaultDurationDays" INTEGER,
  ADD COLUMN "executionType" TEXT NOT NULL DEFAULT 'CONTROL',
  ADD COLUMN "isSupervisorSelectable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ProjectTaskPlan" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "configuredById" UUID,
  "approvedById" UUID,
  "configuredAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTaskPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTaskPlanItem" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "planId" UUID NOT NULL,
  "sourceTemplateId" UUID,
  "sourceBoqItemId" UUID,
  "parentId" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'TEMPLATE',
  "taskType" TEXT NOT NULL DEFAULT 'TASK',
  "requiredJobRole" TEXT,
  "assignmentTeamKey" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "plannedStart" TIMESTAMP(3),
  "plannedFinish" TIMESTAMP(3),
  "plannedDurationDays" INTEGER,
  "assignedUserId" UUID,
  "assignedContractorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTaskPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectTaskPlan_projectId_key" ON "ProjectTaskPlan"("projectId");
CREATE INDEX "ProjectTaskPlan_status_idx" ON "ProjectTaskPlan"("status");
CREATE INDEX "ProjectTaskPlan_configuredById_idx" ON "ProjectTaskPlan"("configuredById");
CREATE INDEX "ProjectTaskPlan_approvedById_idx" ON "ProjectTaskPlan"("approvedById");

CREATE UNIQUE INDEX "ProjectTaskPlanItem_planId_code_key" ON "ProjectTaskPlanItem"("planId", "code");
CREATE UNIQUE INDEX "ProjectTaskPlanItem_planId_sourceBoqItemId_key" ON "ProjectTaskPlanItem"("planId", "sourceBoqItemId");
CREATE INDEX "ProjectTaskPlanItem_planId_enabled_sortOrder_idx" ON "ProjectTaskPlanItem"("planId", "enabled", "sortOrder");
CREATE INDEX "ProjectTaskPlanItem_sourceTemplateId_idx" ON "ProjectTaskPlanItem"("sourceTemplateId");
CREATE INDEX "ProjectTaskPlanItem_sourceBoqItemId_idx" ON "ProjectTaskPlanItem"("sourceBoqItemId");
CREATE INDEX "ProjectTaskPlanItem_assignedUserId_idx" ON "ProjectTaskPlanItem"("assignedUserId");
CREATE INDEX "ProjectTaskPlanItem_assignedContractorId_idx" ON "ProjectTaskPlanItem"("assignedContractorId");

CREATE UNIQUE INDEX "ProjectTask_planItemId_key" ON "ProjectTask"("planItemId");
CREATE INDEX "ProjectTask_assignedUserId_idx" ON "ProjectTask"("assignedUserId");
CREATE INDEX "ProjectTaskInstance_sourceTemplateId_idx" ON "ProjectTaskInstance"("sourceTemplateId");

ALTER TABLE "ProjectTaskPlan"
  ADD CONSTRAINT "ProjectTaskPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlan_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectTaskPlanItem"
  ADD CONSTRAINT "ProjectTaskPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectTaskPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlanItem_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkflowTaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlanItem_sourceBoqItemId_fkey" FOREIGN KEY ("sourceBoqItemId") REFERENCES "ProjectBOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlanItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectTaskPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlanItem_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTaskPlanItem_assignedContractorId_fkey" FOREIGN KEY ("assignedContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectTask"
  ADD CONSTRAINT "ProjectTask_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "ProjectTaskPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectTaskInstance"
  ADD CONSTRAINT "ProjectTaskInstance_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkflowTaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
