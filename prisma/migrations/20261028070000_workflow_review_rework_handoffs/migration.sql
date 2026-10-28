-- Production workflow controls: role-aware semi-tasks, review/rework history,
-- and explicit stage handoffs. All additions are idempotent for existing VPS/Coolify databases.

ALTER TABLE "WorkflowStageTemplate"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "workstream" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentRole" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentTeamKey" TEXT;

ALTER TABLE "WorkflowTaskTemplate"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "taskType" TEXT NOT NULL DEFAULT 'SEMI_TASK',
  ADD COLUMN IF NOT EXISTS "assignmentRole" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentTeamKey" TEXT,
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "autoProgressWeight" DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS "dependsOnCode" TEXT;

ALTER TABLE "ProjectStageInstance"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "workstream" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedRole" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedTeamKey" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedUserId" UUID,
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "reworkCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProjectTaskInstance"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "taskType" TEXT NOT NULL DEFAULT 'SEMI_TASK',
  ADD COLUMN IF NOT EXISTS "assignmentRole" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentTeamKey" TEXT,
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS "WorkflowReviewCycle" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "stageId" UUID NOT NULL,
  "deliverableType" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedById" UUID,
  "reviewerRole" TEXT,
  "reviewerUserId" UUID,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowReviewCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowReviewComment" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "reviewId" UUID NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'REQUIRED',
  "comment" TEXT NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "resolvedById" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowHandoff" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "fromStageId" UUID NOT NULL,
  "toStageId" UUID NOT NULL,
  "deliverableType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "acceptedById" UUID,
  "acceptedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowReviewCycle_stageId_revision_key"
  ON "WorkflowReviewCycle"("stageId", "revision");
CREATE INDEX IF NOT EXISTS "WorkflowReviewCycle_projectId_status_idx"
  ON "WorkflowReviewCycle"("projectId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowReviewCycle_stageId_status_idx"
  ON "WorkflowReviewCycle"("stageId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowReviewCycle_reviewerUserId_idx"
  ON "WorkflowReviewCycle"("reviewerUserId");
CREATE INDEX IF NOT EXISTS "WorkflowReviewComment_reviewId_isResolved_idx"
  ON "WorkflowReviewComment"("reviewId", "isResolved");
CREATE INDEX IF NOT EXISTS "WorkflowHandoff_projectId_status_idx"
  ON "WorkflowHandoff"("projectId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowHandoff_fromStageId_idx"
  ON "WorkflowHandoff"("fromStageId");
CREATE INDEX IF NOT EXISTS "WorkflowHandoff_toStageId_idx"
  ON "WorkflowHandoff"("toStageId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowReviewCycle_projectId_fkey') THEN
    ALTER TABLE "WorkflowReviewCycle" ADD CONSTRAINT "WorkflowReviewCycle_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowReviewCycle_stageId_fkey') THEN
    ALTER TABLE "WorkflowReviewCycle" ADD CONSTRAINT "WorkflowReviewCycle_stageId_fkey"
      FOREIGN KEY ("stageId") REFERENCES "ProjectStageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowReviewComment_reviewId_fkey') THEN
    ALTER TABLE "WorkflowReviewComment" ADD CONSTRAINT "WorkflowReviewComment_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "WorkflowReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowHandoff_projectId_fkey') THEN
    ALTER TABLE "WorkflowHandoff" ADD CONSTRAINT "WorkflowHandoff_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowHandoff_fromStageId_fkey') THEN
    ALTER TABLE "WorkflowHandoff" ADD CONSTRAINT "WorkflowHandoff_fromStageId_fkey"
      FOREIGN KEY ("fromStageId") REFERENCES "ProjectStageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowHandoff_toStageId_fkey') THEN
    ALTER TABLE "WorkflowHandoff" ADD CONSTRAINT "WorkflowHandoff_toStageId_fkey"
      FOREIGN KEY ("toStageId") REFERENCES "ProjectStageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
