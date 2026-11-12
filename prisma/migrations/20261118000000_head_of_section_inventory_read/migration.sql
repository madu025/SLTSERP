-- Head of Section now approves material requests (inventory.approve, previous migration). To open the request it has to
-- sign off it also needs read access to inventory. Insert-if-missing; nothing else about the roles changes.
INSERT INTO "RolePermission" ("roleId", "permission", "permissionDefinitionId")
SELECT r."id", 'inventory.read', pd."id"
FROM "SystemRole" AS r
JOIN "PermissionDefinition" AS pd ON pd."code" = 'inventory.read'
WHERE r."code" IN ('HEAD_OF_SECTION', 'HEAD_OF_SECTION_GLOBAL')
   OR r."code" LIKE '%\_HEAD\_OF\_SECTION'
ON CONFLICT ("roleId", "permission") DO NOTHING;
