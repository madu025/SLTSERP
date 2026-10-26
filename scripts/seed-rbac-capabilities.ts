import { PrismaClient, PermissionScope, Role } from '@prisma/client';
import { RBAC_PERMISSION_DEFINITIONS } from '../src/config/rbac-permissions';
import { ROLE_GROUPS } from '../src/config/roles';

const prisma = new PrismaClient();

/**
 * One-time/bootstrap DB migration for the capability model.
 *
 * This is the only place where legacy enum-role defaults are translated into
 * capabilities. Runtime authorization reads RolePermission rows, not
 * ROLE_GROUPS. After this is deployed, administrators can change grants in
 * the database without a code deployment.
 */
const bootstrapGrants: Record<string, readonly string[]> = {
    'dashboard.read': Object.values(Role),
    'sod.read': ROLE_GROUPS.SOD_MODULE_USERS,
    'sod.write': [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.INVOICE_GENERATORS])],
    'sod.invoice': ROLE_GROUPS.INVOICE_GENERATORS,
    'project.read': ROLE_GROUPS.PROJECT_READERS,
    'project.write': ROLE_GROUPS.PROJECT_MANAGERS,
    'project.approve': ROLE_GROUPS.PROJECT_WORKFLOW_APPROVERS,
    'finance.read': [...new Set([...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.INVOICE, ...ROLE_GROUPS.SF_AUDITING])],
    'finance.write': ROLE_GROUPS.FINANCE,
    'finance.approve': ROLE_GROUPS.FINANCE_APPROVERS,
    'finance.audit': ROLE_GROUPS.SF_AUDITORS,
    'inventory.read': [...new Set([...ROLE_GROUPS.STORES, ...ROLE_GROUPS.OPS, 'MANAGER'])],
    'inventory.write': ROLE_GROUPS.STORES_ALL,
    'inventory.approve': ROLE_GROUPS.STORES_MANAGERS,
    'procurement.read': ROLE_GROUPS.PROCUREMENT,
    'procurement.write': ROLE_GROUPS.PROCUREMENT,
    'contractor.read': ROLE_GROUPS.CONTRACTOR_READERS,
    'contractor.write': ROLE_GROUPS.CONTRACTORS,
    'admin.rbac': ROLE_GROUPS.CORE_ADMINS,
};

function roleCodeFromSystemRole(code: string): string | null {
    const normalized = code.endsWith('_GLOBAL') ? code.slice(0, -'_GLOBAL'.length) : code;
    const match = [...Object.values(Role)]
        .sort((a, b) => b.length - a.length)
        .find((role) => normalized === role || normalized.endsWith(`_${role}`));
    return match ?? null;
}

async function main() {
    let definitions = 0;
    let grants = 0;
    for (const role of Object.values(Role)) {
        const matchingRoles = await prisma.systemRole.findMany({ select: { id: true, code: true } });
        const existing = matchingRoles.find((systemRole) => roleCodeFromSystemRole(systemRole.code) === role);
        const systemRole = existing ?? await prisma.systemRole.create({
            data: {
                name: role.replace(/_/g, ' '),
                code: `${role}_GLOBAL`,
                description: `Database capability role for ${role}`,
                level: role.includes('ADMIN') || role.includes('MANAGER') || role.includes('HEAD') ? 4 : 2,
            },
            select: { id: true },
        });

        await prisma.user.updateMany({
            where: { role, roleId: null },
            data: { roleId: systemRole.id },
        });
    }

    const systemRoles = await prisma.systemRole.findMany({ select: { id: true, code: true } });

    for (const definition of RBAC_PERMISSION_DEFINITIONS) {
        const permission = await prisma.permissionDefinition.upsert({
            where: { code: definition.code },
            update: {
                module: definition.module,
                action: definition.action,
                scope: definition.scope as PermissionScope,
                description: definition.description,
                isActive: true,
            },
            create: {
                code: definition.code,
                module: definition.module,
                action: definition.action,
                scope: definition.scope as PermissionScope,
                description: definition.description,
            },
        });
        definitions++;

        const allowedRoles = new Set(bootstrapGrants[definition.code] ?? []);
        const desiredRoleIds = systemRoles
            .filter((systemRole) => {
                const roleCode = roleCodeFromSystemRole(systemRole.code);
                return !!roleCode && allowedRoles.has(roleCode);
            })
            .map((systemRole) => systemRole.id);

        // Reconcile only the new canonical capability code. Legacy page keys
        // and unrelated administrator-created permissions are untouched.
        await prisma.rolePermission.deleteMany({
            where: {
                permission: definition.code,
                ...(desiredRoleIds.length > 0 ? { roleId: { notIn: desiredRoleIds } } : {}),
            },
        });

        for (const systemRole of systemRoles) {
            const roleCode = roleCodeFromSystemRole(systemRole.code);
            if (!roleCode || !allowedRoles.has(roleCode)) continue;

            await prisma.rolePermission.upsert({
                where: { roleId_permission: { roleId: systemRole.id, permission: definition.code } },
                update: { permissionDefinitionId: permission.id },
                create: {
                    roleId: systemRole.id,
                    permission: definition.code,
                    permissionDefinitionId: permission.id,
                },
            });
            grants++;
        }
    }

    console.log(`RBAC capability seed complete: ${definitions} definitions, ${grants} grants ensured.`);
}

main()
    .catch((error) => {
        console.error('RBAC capability seed failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
