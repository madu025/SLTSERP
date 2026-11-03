-- Project approval-role migration.
--
-- ProcessGatePolicy/ProcessApprovalLevel become the source of truth for the
-- project BOQ and change-request approval routes. The existing application
-- role-group behavior is copied into data below so the first deployment is
-- behavior-preserving; runtime code must fail closed if this policy data is
-- missing.

ALTER TABLE "ProcessApprovalLevel"
  ADD COLUMN IF NOT EXISTS "policyVariant" TEXT NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleRoles" JSONB;

ALTER TABLE "ProcessGatePolicy"
  ADD COLUMN IF NOT EXISTS "notificationAudience" TEXT;

ALTER TABLE "UniversalApprovalInstance"
  ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleRoles" JSONB,
  ADD COLUMN IF NOT EXISTS "policyVariant" TEXT NOT NULL DEFAULT 'DEFAULT';

ALTER TABLE "WorkflowApprovalTemplate"
  ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleRoles" JSONB;

ALTER TABLE "ProjectApprovalInstance"
  ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleRoles" JSONB;

DROP INDEX IF EXISTS "ProcessApprovalLevel_gatePolicyId_level_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessApprovalLevel_gatePolicyId_policyVariant_level_key"
  ON "ProcessApprovalLevel" ("gatePolicyId", "policyVariant", "level");
CREATE INDEX IF NOT EXISTS "ProcessApprovalLevel_gatePolicyId_policyVariant_level_idx"
  ON "ProcessApprovalLevel" ("gatePolicyId", "policyVariant", "level");

ALTER TABLE "BOQApproval"
  ADD COLUMN IF NOT EXISTS "policyId" UUID,
  ADD COLUMN IF NOT EXISTS "policyVariant" TEXT NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "ChangeApproval"
  ADD COLUMN IF NOT EXISTS "policyId" UUID,
  ADD COLUMN IF NOT EXISTS "policyVariant" TEXT NOT NULL DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS "BOQApproval_policyId_idx" ON "BOQApproval" ("policyId");
CREATE INDEX IF NOT EXISTS "ChangeApproval_policyId_idx" ON "ChangeApproval" ("policyId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BOQApproval_policyId_fkey') THEN
    ALTER TABLE "BOQApproval" ADD CONSTRAINT "BOQApproval_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "ProcessGatePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangeApproval_policyId_fkey') THEN
    ALTER TABLE "ChangeApproval" ADD CONSTRAINT "ChangeApproval_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "ProcessGatePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- BOQ approval: preserve the existing three named steps and eligible DB role
-- identities. ADMIN_RBAC remains the explicit administrative override in code.
INSERT INTO "ProcessGatePolicy" (
  "entityType", "fromStatus", "toStatus", "label", "isEnabled",
  "approvalStrategy", "updatedAt"
)
VALUES (
  'PROJECT_BOQ_APPROVAL', 'PENDING', 'APPROVED',
  'Project BOQ approval (DB-backed role policy)', true,
  'ALL_MUST_APPROVE', NOW()
)
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

WITH policy AS (
  SELECT "id" FROM "ProcessGatePolicy"
  WHERE "entityType" = 'PROJECT_BOQ_APPROVAL'
    AND "fromStatus" = 'PENDING'
    AND "toStatus" = 'APPROVED'
)
INSERT INTO "ProcessApprovalLevel" (
  "gatePolicyId", "level", "requiredRole", "policyVariant",
  "requiredPermission", "eligibleRoles", "description"
)
SELECT policy."id", config.level, config.required_role, 'DEFAULT',
  'project.approve', config.eligible_roles::jsonb, config.description
FROM policy
CROSS JOIN (VALUES
  (1, 'BOQ_SUPERVISOR', '["SUPER_ADMIN","ADMIN","CEO","HEAD_OF_OSP","OSP_MANAGER","AREA_MANAGER","ENGINEER","ASSISTANT_ENGINEER","QC_OFFICER","OSP_ENGINEER","CIVIL_SUPERVISOR"]', 'Technical/project BOQ supervisor step'),
  (2, 'BOQ_PROJECT_MANAGER', '["SUPER_ADMIN","ADMIN","CEO","HEAD_OF_OSP","MANAGER","OSP_MANAGER","AREA_MANAGER"]', 'Project manager BOQ step'),
  (3, 'BOQ_FINANCE', '["SUPER_ADMIN","ADMIN","CEO","FINANCE_MANAGER","STORES_MANAGER"]', 'Finance BOQ step')
) AS config(level, required_role, eligible_roles, description)
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- Change-request approval: one policy with three DB-defined amount branches.
-- The level rows intentionally preserve the previous role-list expansion:
-- under 100K used ADMINS; 100K+ used PROJECT_MANAGERS.
INSERT INTO "ProcessGatePolicy" (
  "entityType", "fromStatus", "toStatus", "label", "isEnabled",
  "approvalStrategy", "updatedAt"
)
VALUES (
  'PROJECT_CHANGE_REQUEST', 'DRAFT', 'SUBMITTED',
  'Project change-request approval (DB-backed amount policy)', true,
  'ALL_MUST_APPROVE', NOW()
)
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

WITH policy AS (
  SELECT "id" FROM "ProcessGatePolicy"
  WHERE "entityType" = 'PROJECT_CHANGE_REQUEST'
    AND "fromStatus" = 'DRAFT'
    AND "toStatus" = 'SUBMITTED'
)
INSERT INTO "ProcessApprovalLevel" (
  "gatePolicyId", "level", "requiredRole", "policyVariant",
  "requiredPermission", "eligibleRoles", "description"
)
SELECT policy."id", config.level, config.role, config.variant,
  'project.approve', jsonb_build_array(config.role), config.description
FROM policy
CROSS JOIN (VALUES
  (1, 'SUPER_ADMIN', 'UNDER_100K', 'Section-manager chain (legacy default)'),
  (2, 'ADMIN', 'UNDER_100K', 'Section-manager chain (legacy default)'),
  (3, 'CEO', 'UNDER_100K', 'Section-manager chain (legacy default)'),
  (4, 'HEAD_OF_OSP', 'UNDER_100K', 'Section-manager chain (legacy default)'),
  (1, 'SUPER_ADMIN', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (2, 'ADMIN', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (3, 'CEO', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (4, 'MANAGER', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (5, 'OSP_MANAGER', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (6, 'AREA_MANAGER', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (7, 'ENGINEER', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (8, 'ASSISTANT_ENGINEER', 'FROM_100K_TO_500K', 'Project-manager chain (legacy default)'),
  (1, 'SUPER_ADMIN', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (2, 'ADMIN', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (3, 'CEO', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (4, 'MANAGER', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (5, 'OSP_MANAGER', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (6, 'AREA_MANAGER', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (7, 'ENGINEER', 'OVER_500K', 'Project-manager chain (legacy default)'),
  (8, 'ASSISTANT_ENGINEER', 'OVER_500K', 'Project-manager chain (legacy default)')
) AS config(level, role, variant, description)
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- Enrich only rows that are still incomplete. Existing configured values are
-- never overwritten; unknown/custom legacy policies intentionally remain
-- incomplete and are rejected by the runtime until configured by an admin.
UPDATE "ProcessApprovalLevel" level
SET "requiredPermission" = CASE
  WHEN level."requiredPermission" IS NOT NULL THEN level."requiredPermission"
  WHEN policy."entityType" IN ('MATERIAL_REQUEST', 'STOCK_TRANSFER', 'MRN', 'GRN') THEN 'inventory.approve'
  WHEN policy."entityType" = 'PURCHASE_ORDER' THEN 'procurement.write'
  WHEN policy."entityType" = 'SERVICE_ORDER' AND level."requiredRole" = 'CONTRACTOR' THEN 'contractor.write'
  WHEN policy."entityType" = 'SERVICE_ORDER' THEN 'sod.write'
  WHEN policy."entityType" = 'INVOICE' THEN 'finance.approve'
  ELSE NULL
END,
"eligibleRoles" = CASE
  WHEN level."eligibleRoles" IS NOT NULL THEN level."eligibleRoles"
  WHEN NULLIF(BTRIM(level."requiredRole"), '') IS NOT NULL
    THEN jsonb_build_array(regexp_replace(level."requiredRole", '_GLOBAL$', ''))
  ELSE NULL
END
FROM "ProcessGatePolicy" policy
WHERE level."gatePolicyId" = policy."id"
  AND (level."requiredPermission" IS NULL OR level."eligibleRoles" IS NULL);

-- Canonical notification audiences are filled only when no audience exists.
-- Unknown/custom legacy role snapshots remain NULL and therefore fail closed.
UPDATE "ProcessGatePolicy"
SET "notificationAudience" = CASE
  WHEN "notificationAudience" IS NOT NULL THEN "notificationAudience"
  WHEN "rolesToNotify" = '["OSP_MANAGER"]'::jsonb THEN 'PROCESS_GATE_OSP_MANAGER'
  WHEN "rolesToNotify" = '["HEAD_OF_SECTION"]'::jsonb THEN 'PROCESS_GATE_HEAD_OF_SECTION'
  WHEN "rolesToNotify" = '["PROCUREMENT_OFFICER"]'::jsonb THEN 'PROCESS_GATE_PROCUREMENT'
  WHEN "rolesToNotify" = '["STORES_MANAGER"]'::jsonb THEN 'PROCESS_GATE_STORES'
  ELSE NULL
END
WHERE "notificationAudience" IS NULL;

-- Backfill only missing canonical snapshots for existing workflow rows. The
-- legacy role remains untouched as an audit/display snapshot.
UPDATE "WorkflowApprovalTemplate"
SET "requiredPermission" = 'project.approve',
    "eligibleRoles" = jsonb_build_array(regexp_replace("role", '_GLOBAL$', ''))
WHERE "requiredPermission" IS NULL
  AND NULLIF(BTRIM("role"), '') IS NOT NULL;

UPDATE "ProjectApprovalInstance"
SET "requiredPermission" = 'project.approve',
    "eligibleRoles" = jsonb_build_array(regexp_replace("role", '_GLOBAL$', ''))
WHERE "requiredPermission" IS NULL
  AND NULLIF(BTRIM("role"), '') IS NOT NULL;
