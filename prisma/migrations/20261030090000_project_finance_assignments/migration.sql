-- Project-level finance accountability, independent from global User.role.
-- Existing ProjectInvoice/PaymentVoucher/ProjectExpense records continue to
-- use Project.id as their financial integration key.

CREATE TABLE IF NOT EXISTS "ProjectFinanceAssignment" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "assignmentRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "assignedById" UUID NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectFinanceAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectFinanceAssignment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectFinanceAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectFinanceAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectFinanceAssignment_role_check"
    CHECK ("assignmentRole" IN ('LEAD_CONTROLLER', 'PREPARER', 'REVIEWER', 'APPROVER')),
  CONSTRAINT "ProjectFinanceAssignment_status_check"
    CHECK ("status" IN ('ACTIVE', 'ENDED')),
  CONSTRAINT "ProjectFinanceAssignment_dates_check"
    CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFinanceAssignment_projectId_userId_assignmentRole_key"
  ON "ProjectFinanceAssignment" ("projectId", "userId", "assignmentRole");
CREATE INDEX IF NOT EXISTS "ProjectFinanceAssignment_projectId_status_idx"
  ON "ProjectFinanceAssignment" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectFinanceAssignment_projectId_assignmentRole_status_idx"
  ON "ProjectFinanceAssignment" ("projectId", "assignmentRole", "status");
CREATE INDEX IF NOT EXISTS "ProjectFinanceAssignment_userId_status_idx"
  ON "ProjectFinanceAssignment" ("userId", "status");
CREATE INDEX IF NOT EXISTS "ProjectFinanceAssignment_assignedById_idx"
  ON "ProjectFinanceAssignment" ("assignedById");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFinanceAssignment_one_active_primary_idx"
  ON "ProjectFinanceAssignment" ("projectId")
  WHERE "status" = 'ACTIVE' AND "isPrimary" = true;
