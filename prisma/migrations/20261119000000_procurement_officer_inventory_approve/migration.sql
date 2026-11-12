-- The HOS_APPROVAL -> PROCUREMENT material request gate names the Procurement Officer role and requires
-- inventory.approve, but that role did not carry it, so its holders were refused (only an RBAC admin could action it).
-- Insert-if-missing; nothing else about the role changes.
INSERT INTO "RolePermission" ("roleId", "permission", "permissionDefinitionId")
SELECT r."id", 'inventory.approve', pd."id"
FROM "SystemRole" AS r
JOIN "PermissionDefinition" AS pd ON pd."code" = 'inventory.approve'
WHERE r."code" IN ('PROCUREMENT_OFFICER', 'PROCUREMENT_OFFICER_GLOBAL')
   OR r."code" LIKE '%\_PROCUREMENT\_OFFICER'
ON CONFLICT ("roleId", "permission") DO NOTHING;
