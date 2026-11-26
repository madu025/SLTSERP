-- Material request chain (external purchase), found by the browser pass of 26 Nov 2026: a new request skipped its first gate (the DRAFT gate is
-- only used to choose where the request starts), so the OSP Manager never reviewed it, the Head of Section approved at the stage the screens call
-- "Awaiting OSP Manager", and the Procurement Officer at "Awaiting Head of Section". The Stores Manager level added on 25 Dec 2026 was never reached.
-- From now on the stage names say who the request waits for, as the screens already show them:
--   created -> STORES_MANAGER_APPROVAL (Stores Manager) -> OSP_MANAGER_APPROVAL (OSP Manager) -> HOS_APPROVAL (Head of Section) -> PROCUREMENT.
-- Requests already waiting at OSP_MANAGER_APPROVAL now wait for the OSP Manager; at HOS_APPROVAL for the Head of Section.

-- 1. A new request starts with the Stores Manager, who is notified
UPDATE "ProcessGatePolicy"
SET "toStatus" = 'STORES_MANAGER_APPROVAL', "label" = '1. MRN Submission (to the Stores Manager)', "notificationAudience" = 'STORES_MANAGERS', "updatedAt" = CURRENT_TIMESTAMP
WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'DRAFT' AND "toStatus" = 'OSP_MANAGER_APPROVAL';

-- the submission gate is not signed by anyone: keep one level (the Stores Manager) instead of the two added on 25 Dec
DELETE FROM "ProcessApprovalLevel" l USING "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'DRAFT' AND p."toStatus" = 'STORES_MANAGER_APPROVAL' AND l."requiredRole" <> 'STORES_MANAGER';
UPDATE "ProcessApprovalLevel" l SET "level" = 1
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'DRAFT' AND p."toStatus" = 'STORES_MANAGER_APPROVAL';

-- 2. The Stores Manager reviews; the OSP Manager is told next
INSERT INTO "ProcessGatePolicy" ("entityType", "fromStatus", "toStatus", "label", "isEnabled", "notificationAudience", "domainAction", "conditions", "updatedAt")
SELECT 'MATERIAL_REQUEST', 'STORES_MANAGER_APPROVAL', 'OSP_MANAGER_APPROVAL', '2. Stores Manager Review', true, 'PROCESS_GATE_OSP_MANAGER', NULL, NULL, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ProcessGatePolicy" WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'STORES_MANAGER_APPROVAL' AND "toStatus" = 'OSP_MANAGER_APPROVAL');
INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "requiredRole", "policyVariant", "requiredPermission", "eligibleRoles", "description", "slaHours")
SELECT p."id", 1, 'STORES_MANAGER', 'DEFAULT', 'inventory.approve', '["STORES_MANAGER"]'::jsonb, 'Stores Manager reviews the material request', 24
FROM "ProcessGatePolicy" p
WHERE p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'STORES_MANAGER_APPROVAL' AND p."toStatus" = 'OSP_MANAGER_APPROVAL'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- 3. At "Awaiting OSP Manager" the OSP Manager signs (the Head of Section is told next)
UPDATE "ProcessApprovalLevel" l SET "requiredRole" = 'OSP_MANAGER', "eligibleRoles" = '["OSP_MANAGER"]'::jsonb, "description" = 'OSP Manager reviews the material request'
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'OSP_MANAGER_APPROVAL' AND p."toStatus" = 'HOS_APPROVAL';
UPDATE "ProcessGatePolicy" SET "label" = '3. OSP Manager Review', "updatedAt" = CURRENT_TIMESTAMP
WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'OSP_MANAGER_APPROVAL' AND "toStatus" = 'HOS_APPROVAL';

-- 4. At "Awaiting Head of Section" the Head of Section signs (the Procurement Officer is told next)
UPDATE "ProcessApprovalLevel" l SET "requiredRole" = 'HEAD_OF_SECTION', "eligibleRoles" = '["HEAD_OF_SECTION"]'::jsonb, "description" = 'Head of Section signs off the material request'
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'MATERIAL_REQUEST' AND p."fromStatus" = 'HOS_APPROVAL' AND p."toStatus" = 'PROCUREMENT';
UPDATE "ProcessGatePolicy" SET "label" = '4. Head of Section Signoff', "updatedAt" = CURRENT_TIMESTAMP
WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'HOS_APPROVAL' AND "toStatus" = 'PROCUREMENT';
