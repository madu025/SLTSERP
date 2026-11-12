-- The "Head of Section Signoff" material request gate requires inventory.approve, but the Head of Section role only
-- carried dashboard, reports and notification grants, so its holders were refused when they tried to approve.
-- Grant the Head of Section roles (global role and any section-scoped copy) inventory.approve. Insert-if-missing:
-- an existing grant is left alone and nothing else about the roles changes.
INSERT INTO "RolePermission" ("roleId", "permission", "permissionDefinitionId")
SELECT r."id", 'inventory.approve', pd."id"
FROM "SystemRole" AS r
JOIN "PermissionDefinition" AS pd ON pd."code" = 'inventory.approve'
WHERE r."code" IN ('HEAD_OF_SECTION', 'HEAD_OF_SECTION_GLOBAL')
   OR r."code" LIKE '%\_HEAD\_OF\_SECTION'
ON CONFLICT ("roleId", "permission") DO NOTHING;
