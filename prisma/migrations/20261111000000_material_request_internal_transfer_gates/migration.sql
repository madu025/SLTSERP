-- Internal stock transfers (sub store -> main store) had no process gate, so a request fell into the external
-- purchase chain and could never be released or received. Add the two gates of the internal route and keep the
-- purchase chain for external procurement only.
--   DRAFT        -> ARM_APPROVAL        (internal)  Area Manager reviews the sub-store request
--   ARM_APPROVAL -> MAIN_STORE_RELEASE  stock is reserved at the main store, then the stores release / receive
-- Idempotent: safe to run again.

-- 1. The existing purchase-chain entry applies to external procurement only
UPDATE "ProcessGatePolicy"
SET "conditions" = '{"field":"isExternalProcurement","operator":"==","value":true}'::jsonb,
    "updatedAt" = now()
WHERE "entityType" = 'MATERIAL_REQUEST'
  AND "fromStatus" = 'DRAFT'
  AND "toStatus" = 'OSP_MANAGER_APPROVAL'
  AND "conditions" IS NULL;

-- 2. Internal route gates
INSERT INTO "ProcessGatePolicy" ("entityType", "fromStatus", "toStatus", "label", "isEnabled", "notificationAudience", "domainAction", "conditions", "updatedAt")
VALUES
  ('MATERIAL_REQUEST', 'DRAFT', 'ARM_APPROVAL', '1. Sub-store Request & Area Manager Review', true, NULL, NULL,
   '{"field":"isExternalProcurement","operator":"==","value":false}'::jsonb, now()),
  ('MATERIAL_REQUEST', 'ARM_APPROVAL', 'MAIN_STORE_RELEASE', '2. Area Manager Approval & Stock Reservation', true, 'PROCESS_GATE_STORES', '/api/inventory/reserve-stock',
   NULL, now())
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

-- 3. Approval levels (permission is the authority; the role is the display snapshot, as in the purchase chain)
INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "requiredRole", "policyVariant", "requiredPermission", "eligibleRoles", "description", "slaHours")
SELECT p."id", 1, 'AREA_MANAGER', 'DEFAULT', 'inventory.approve', '["AREA_MANAGER"]'::jsonb, 'Area Manager approves the sub-store request', 24
FROM "ProcessGatePolicy" p
WHERE p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'DRAFT' AND p."toStatus" = 'ARM_APPROVAL'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "requiredRole", "policyVariant", "requiredPermission", "eligibleRoles", "description", "slaHours")
SELECT p."id", 1, 'STORES_MANAGER', 'DEFAULT', 'inventory.approve', '["STORES_MANAGER"]'::jsonb, 'Main store releases the reserved stock to the sub store', 24
FROM "ProcessGatePolicy" p
WHERE p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'ARM_APPROVAL' AND p."toStatus" = 'MAIN_STORE_RELEASE'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;
