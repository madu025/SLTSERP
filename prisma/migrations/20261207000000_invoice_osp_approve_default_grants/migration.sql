-- The RBAC seed is not part of the deploy, so the new capability invoice.osp.approve had no holder. Give it to its intended default
-- roles (the same list as CANONICAL_BOOTSTRAP_ROLE_GRANTS in src/config/rbac-bootstrap.ts). Additive; administrators can change it
-- afterwards in the admin permission UI, and a re-run does nothing.
INSERT INTO "RolePermission" ("roleId", "permission", "permissionDefinitionId")
SELECT r."id", 'invoice.osp.approve', d."id"
FROM "SystemRole" r
CROSS JOIN "PermissionDefinition" d
WHERE d."code" = 'invoice.osp.approve'
  AND r."code" IN ('SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'HEAD_OF_OSP')
ON CONFLICT ("roleId", "permission") DO NOTHING;
