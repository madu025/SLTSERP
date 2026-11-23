-- The Stores Executive is the Stores Manager's deputy: when there is no Manager the Executive approves the main store gates (not the Procurement Officer, who was added
-- by an earlier migration). The gate checks the eligible-role list besides the capability. Idempotent.
UPDATE "ProcessApprovalLevel" l
SET "eligibleRoles" = ((l."eligibleRoles" - 'PROCUREMENT_OFFICER') - 'STORES_EXECUTIVE') || '["STORES_EXECUTIVE"]'::jsonb
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id"
  AND p."entityType" = 'MATERIAL_REQUEST'
  AND l."requiredRole" = 'STORES_MANAGER'
  AND l."eligibleRoles" IS NOT NULL
  AND ((p."fromStatus" = 'ARM_APPROVAL' AND p."toStatus" = 'MAIN_STORE_RELEASE') OR (p."fromStatus" = 'PROCUREMENT' AND p."toStatus" = 'ISSUED'));
