-- Canonicalize change-request approval snapshots, then remove the obsolete
-- process-gate notification role snapshot.
--
-- This migration is intentionally fail-closed. It never deletes workflow rows.
-- If an existing row cannot be represented by canonical fields, deployment
-- stops before the legacy notification column is removed so an administrator
-- can repair the data safely.

ALTER TABLE "ChangeApproval"
  ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleRoles" JSONB;

-- Link historical change approvals to the DB policy branch when possible.
-- Existing explicit links are preserved; only missing links are filled.
WITH policy_targets AS (
  SELECT
    ca."id" AS approval_id,
    p."id" AS policy_id,
    CASE
      WHEN COALESCE(cr."costImpact", 0) < 100000 THEN 'UNDER_100K'
      WHEN COALESCE(cr."costImpact", 0) < 500000 THEN 'FROM_100K_TO_500K'
      ELSE 'OVER_500K'
    END AS policy_variant
  FROM "ChangeApproval" ca
  JOIN "ProjectChangeRequest" cr ON cr."id" = ca."changeRequestId"
  JOIN "ProcessGatePolicy" p
    ON p."entityType" = 'PROJECT_CHANGE_REQUEST'
   AND p."fromStatus" = 'DRAFT'
   AND p."toStatus" = 'SUBMITTED'
)
UPDATE "ChangeApproval" ca
SET
  "policyId" = target.policy_id,
  "policyVariant" = target.policy_variant
FROM policy_targets target
WHERE ca."id" = target.approval_id
  AND ca."policyId" IS NULL;

-- Prefer the exact policy-level canonical snapshot. The role column remains a
-- display/audit snapshot and is not used by runtime authorization anymore.
UPDATE "ChangeApproval" ca
SET
  "requiredPermission" = COALESCE(ca."requiredPermission", level."requiredPermission"),
  "eligibleRoles" = COALESCE(ca."eligibleRoles", level."eligibleRoles")
FROM "ProcessApprovalLevel" level
WHERE ca."policyId" = level."gatePolicyId"
  AND ca."policyVariant" = level."policyVariant"
  AND (level."requiredRole" = ca."role"
    OR regexp_replace(level."requiredRole", '_GLOBAL$', '') = regexp_replace(ca."role", '_GLOBAL$', ''))
  AND (ca."requiredPermission" IS NULL OR ca."eligibleRoles" IS NULL);

-- Some historical rows predate policy links. Preserve their approval behavior
-- with a canonical project approval snapshot derived from the immutable role
-- snapshot; this is data migration only, not a runtime role-group fallback.
UPDATE "ChangeApproval"
SET
  "requiredPermission" = COALESCE("requiredPermission", 'project.approve'),
  "eligibleRoles" = COALESCE(
    "eligibleRoles",
    CASE WHEN NULLIF(BTRIM("role"), '') IS NOT NULL
      THEN jsonb_build_array(regexp_replace("role", '_GLOBAL$', ''))
      ELSE NULL
    END
  )
WHERE "requiredPermission" IS NULL OR "eligibleRoles" IS NULL;

DO $$
DECLARE
  incomplete_change_approvals INTEGER;
BEGIN
  SELECT COUNT(*) INTO incomplete_change_approvals
  FROM "ChangeApproval"
  WHERE "requiredPermission" IS NULL
     OR COALESCE(jsonb_typeof("eligibleRoles"), 'null') <> 'array'
     OR CASE
          WHEN jsonb_typeof("eligibleRoles") = 'array' THEN jsonb_array_length("eligibleRoles")
          ELSE 0
        END = 0;

  IF incomplete_change_approvals > 0 THEN
    RAISE EXCEPTION
      'Canonical change approval migration stopped: % approval rows are incomplete',
      incomplete_change_approvals;
  END IF;
END $$;

-- One deployed pre-canonical seed used the short HOS label for the same
-- Head-of-Section audience. Normalize that known alias before the guard.
UPDATE "ProcessGatePolicy"
SET "notificationAudience" = 'PROCESS_GATE_HEAD_OF_SECTION'
WHERE "notificationAudience" IS NULL
  AND "rolesToNotify" = '["HOS"]'::jsonb;

-- The first migration translated all known legacy notification snapshots. Do
-- not drop the old column if any non-empty legacy value is still unmapped.
DO $$
DECLARE
  unmapped_notification_snapshots INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped_notification_snapshots
  FROM "ProcessGatePolicy"
  WHERE "rolesToNotify" IS NOT NULL
    AND NOT (
      jsonb_typeof("rolesToNotify") = 'array'
      AND jsonb_array_length("rolesToNotify") = 0
    )
    AND "notificationAudience" IS NULL;

  IF unmapped_notification_snapshots > 0 THEN
    RAISE EXCEPTION
      'Legacy notification cleanup stopped: % process-gate policies still need a canonical notification audience',
      unmapped_notification_snapshots;
  END IF;
END $$;

ALTER TABLE "ProcessGatePolicy"
  DROP COLUMN IF EXISTS "rolesToNotify";
