-- The area approval chain of a completed service order becomes a normal, editable process gate (SERVICE_ORDER COMPLETED -> INVOICABLE):
-- Area Coordinator -> QC Officer -> Contractor -> Engineer (skipped in an area without one) -> Area Manager. An administrator can
-- reorder or change the steps on the gate screen. Additive only; every statement is safe to run twice.

ALTER TABLE "ProcessGatePolicy" ADD COLUMN IF NOT EXISTS "queueMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProcessApprovalLevel" ADD COLUMN IF NOT EXISTS "assignee" TEXT NOT NULL DEFAULT 'ROLE';
ALTER TABLE "ProcessApprovalLevel" ADD COLUMN IF NOT EXISTS "skipIfNoApprover" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "ProcessGatePolicy" ("entityType", "fromStatus", "toStatus", "label", "isEnabled", "rejectionBehavior", "approvalStrategy", "domainAction", "queueMode", "updatedAt")
VALUES ('SERVICE_ORDER', 'COMPLETED', 'INVOICABLE', 'SOD invoicing approval (area chain)', true, 'REWORK_TO_CREATOR', 'ANY_CAN_APPROVE', 'MARK_SOD_INVOICABLE', true, NOW())
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "policyVariant", "requiredRole", "requiredPermission", "eligibleRoles", "description", "assignee", "skipIfNoApprover")
SELECT p."id", v."level", 'DEFAULT', v."role", v."perm", v."roles"::jsonb, v."descr", v."assignee", v."skip"
FROM "ProcessGatePolicy" p
CROSS JOIN (VALUES
  (1, 'AREA_COORDINATOR', 'invoice.confirm.coordinator', '["AREA_COORDINATOR"]', 'Area Coordinator checks the completed order',                'ROLE',             false),
  (2, 'QC_OFFICER',       'invoice.confirm.qc',          '["QC_OFFICER"]',       'QC Officer checks quality',                                 'ROLE',             false),
  (3, 'CONTRACTOR',       'contractor.write',            '["CONTRACTOR"]',       'The order''s own contractor confirms the completed work',   'ORDER_CONTRACTOR', false),
  (4, 'ENGINEER',         'invoice.confirm.engineer',    '["ENGINEER","ASSISTANT_ENGINEER"]', 'Area Engineer / Officer (skipped when the area has none)', 'ROLE',    true),
  (5, 'AREA_MANAGER',     'invoice.confirm.manager',     '["AREA_MANAGER"]',     'Area Manager final approval, then the order can be invoiced', 'ROLE',           false)
) AS v("level", "role", "perm", "roles", "descr", "assignee", "skip")
WHERE p."entityType" = 'SERVICE_ORDER' AND p."fromStatus" = 'COMPLETED' AND p."toStatus" = 'INVOICABLE'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- Orders that were already waiting in the old hard-coded chain continue inside the gate. The Contractor step now comes before the
-- Engineer, so an order that had passed the Coordinator and QC (and possibly the Engineer) re-enters at the Contractor step.
-- Their earlier approvals stay in "SodApproval" and still count for the separation-of-duties rule.
INSERT INTO "UniversalApprovalInstance" ("entityType", "entityId", "policyId", "levelIndex", "level", "requiredRole", "requiredPermission", "eligibleRoles", "policyVariant", "status", "comments")
SELECT 'SERVICE_ORDER', o."id"::text, l."gatePolicyId", l."level" - 1, l."level", l."requiredRole", l."requiredPermission", l."eligibleRoles", 'DEFAULT', 'PENDING', 'Continued from the earlier approval chain'
FROM "ServiceOrder" o
JOIN "ProcessGatePolicy" p ON p."entityType" = 'SERVICE_ORDER' AND p."fromStatus" = 'COMPLETED' AND p."toStatus" = 'INVOICABLE'
JOIN "ProcessApprovalLevel" l ON l."gatePolicyId" = p."id" AND l."policyVariant" = 'DEFAULT'
 AND l."level" = CASE o."sodApprovalStage" WHEN 'AREA_COORDINATOR' THEN 1 WHEN 'QC_OFFICER' THEN 2 ELSE 3 END
WHERE o."sodApprovalStage" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'AREA_ENGINEER', 'AREA_MANAGER')
  AND NOT EXISTS (SELECT 1 FROM "UniversalApprovalInstance" i WHERE i."entityType" = 'SERVICE_ORDER' AND i."entityId" = o."id"::text AND i."policyId" = p."id" AND i."status" = 'PENDING');

UPDATE "ServiceOrder" SET "sodApprovalStage" = 'CONTRACTOR' WHERE "sodApprovalStage" IN ('AREA_ENGINEER', 'AREA_MANAGER');
