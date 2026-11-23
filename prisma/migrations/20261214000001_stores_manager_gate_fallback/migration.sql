-- The Stores Manager approval of an internal material request (ARM_APPROVAL -> MAIN_STORE_RELEASE) may also be done by the Procurement Officer when there is no
-- Stores Manager. The gate checks the eligible-role list besides the capability, so the Procurement Officer is added to it. Idempotent.
UPDATE "ProcessApprovalLevel" l
SET "eligibleRoles" = l."eligibleRoles" || '["PROCUREMENT_OFFICER"]'::jsonb
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id"
  AND p."entityType" = 'MATERIAL_REQUEST'
  AND p."fromStatus" = 'ARM_APPROVAL'
  AND p."toStatus" = 'MAIN_STORE_RELEASE'
  AND l."requiredRole" = 'STORES_MANAGER'
  AND l."eligibleRoles" IS NOT NULL
  AND NOT (l."eligibleRoles" @> '"PROCUREMENT_OFFICER"'::jsonb);
