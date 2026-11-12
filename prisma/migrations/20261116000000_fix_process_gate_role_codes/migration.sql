-- The deployed MATERIAL_REQUEST OSP_MANAGER_APPROVAL -> HOS_APPROVAL gate ("Head of Section Signoff") named the
-- approver role HOS, which does not exist as a system role, so nobody but an RBAC admin could ever approve it and
-- ten material requests have been waiting at this level since August.
-- The runtime matches eligibleRoles against the user's role code after stripping a _GLOBAL suffix (and accepts
-- "<anything>_<eligible>"), so HEAD_OF_SECTION matches HEAD_OF_SECTION_GLOBAL.

UPDATE "ProcessApprovalLevel"
SET "requiredRole" = 'HEAD_OF_SECTION',
    "eligibleRoles" = '["HEAD_OF_SECTION"]'::jsonb
WHERE "requiredRole" = 'HOS'
  AND "eligibleRoles" = '["HOS"]'::jsonb;

-- Approval instances freeze the eligible roles when they are created, so the ones still waiting must be repaired too.
UPDATE "UniversalApprovalInstance"
SET "requiredRole" = 'HEAD_OF_SECTION',
    "eligibleRoles" = '["HEAD_OF_SECTION"]'::jsonb
WHERE "requiredRole" = 'HOS'
  AND "status" = 'PENDING';

-- The seeded gates move requests through statuses that the status catalogue used by the gate wizard did not list
-- (HOS_APPROVAL, MAIN_STORE_RELEASE, ISSUED, INPROGRESS), so the wizard showed the wrong "To status" when such a
-- gate was opened and new gates could not target them. The catalogue is the same list as
-- src/config/process-gate-statuses.ts; existing rows are left alone.
INSERT INTO "WorkflowStatus" ("entityType", "value", "label")
VALUES
  ('MATERIAL_REQUEST', 'HOS_APPROVAL', 'HOS_APPROVAL (Head of Section Signoff)'),
  ('MATERIAL_REQUEST', 'MAIN_STORE_RELEASE', 'MAIN_STORE_RELEASE (Main Store Releases Reserved Stock)'),
  ('MATERIAL_REQUEST', 'ISSUED', 'ISSUED (Material Issue Note Released)'),
  ('SERVICE_ORDER', 'INPROGRESS', 'INPROGRESS (Field Survey & Civil Execution)')
ON CONFLICT ("entityType", "value") DO NOTHING;
