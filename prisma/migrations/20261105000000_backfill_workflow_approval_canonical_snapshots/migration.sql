-- WorkflowApprovalTemplate rows can be created by workflow seed/upsert code
-- after the original RBAC migration has already run. Backfill those rows before
-- the application seed starts so a restart never fails on an old template.
-- The legacy role is retained for display/audit; runtime approval checks use
-- project.approve plus the canonical eligible-role snapshot.
UPDATE "WorkflowApprovalTemplate"
SET
  "requiredPermission" = COALESCE("requiredPermission", 'project.approve'),
  "eligibleRoles" = CASE
    WHEN "eligibleRoles" IS NOT NULL
      AND jsonb_typeof("eligibleRoles") = 'array'
      AND jsonb_array_length("eligibleRoles") > 0
      THEN "eligibleRoles"
    ELSE jsonb_build_array(regexp_replace(BTRIM("role"), '_GLOBAL$', ''))
  END
WHERE NULLIF(BTRIM("role"), '') IS NOT NULL
  AND (
    "requiredPermission" IS NULL
    OR "eligibleRoles" IS NULL
    OR COALESCE(jsonb_typeof("eligibleRoles"), 'null') <> 'array'
    OR (jsonb_typeof("eligibleRoles") = 'array' AND jsonb_array_length("eligibleRoles") = 0)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WorkflowApprovalTemplate"
    WHERE NULLIF(BTRIM("role"), '') IS NULL
       OR "requiredPermission" IS NULL
       OR COALESCE(jsonb_typeof("eligibleRoles"), 'null') <> 'array'
       OR jsonb_array_length("eligibleRoles") = 0
  ) THEN
    RAISE EXCEPTION 'Workflow approval templates contain incomplete canonical snapshots';
  END IF;
END $$;
