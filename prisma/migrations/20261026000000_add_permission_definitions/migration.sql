-- Canonical DB-backed capability catalog. Existing RolePermission.permission
-- values remain valid for backwards compatibility and are linked by the seed
-- script through permissionDefinitionId.

CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'OPMC', 'AREA', 'SELF');

CREATE TABLE "PermissionDefinition" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'GLOBAL',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PermissionDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PermissionDefinition_code_key" ON "PermissionDefinition"("code");
CREATE INDEX "PermissionDefinition_module_action_idx" ON "PermissionDefinition"("module", "action");
CREATE INDEX "PermissionDefinition_isActive_idx" ON "PermissionDefinition"("isActive");

ALTER TABLE "RolePermission" ADD COLUMN "permissionDefinitionId" UUID;
CREATE INDEX "RolePermission_permissionDefinitionId_idx" ON "RolePermission"("permissionDefinitionId");
ALTER TABLE "RolePermission"
    ADD CONSTRAINT "RolePermission_permissionDefinitionId_fkey"
    FOREIGN KEY ("permissionDefinitionId") REFERENCES "PermissionDefinition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
