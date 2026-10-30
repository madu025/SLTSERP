import { PrismaClient, PermissionScope, Role } from '@prisma/client';
import { RBAC_PERMISSION_DEFINITIONS } from '../src/config/rbac-permissions';
import { ROLE_GROUPS } from '../src/config/roles';

const prisma = new PrismaClient();

function parseStoredPermissions(value: string | null): string[] {
    if (!value) return [];

    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.filter((permission): permission is string => typeof permission === 'string')
            : [];
    } catch {
        return [];
    }
}

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
    'project.plan.read': ROLE_GROUPS.PROJECT_READERS,
    'project.plan.write': [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, 'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER'])],
    'project.plan.approve': ROLE_GROUPS.PROJECT_WORKFLOW_APPROVERS,
    'finance.read': [...new Set([...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.INVOICE, ...ROLE_GROUPS.SF_AUDITING])],
    'finance.write': ROLE_GROUPS.FINANCE,
    'finance.approve': ROLE_GROUPS.FINANCE_APPROVERS,
    'finance.audit': ROLE_GROUPS.SF_AUDITORS,
    'project.finance.read': [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.INVOICE, ...ROLE_GROUPS.SF_AUDITING])],
    'project.finance.write': ROLE_GROUPS.FINANCE,
    'project.finance.approve': ROLE_GROUPS.FINANCE_APPROVERS,
    'project.finance.assign': [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE_APPROVERS])],
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
    let userIdentityRepairs = 0;
    const roleTargets = new Map<Role, string>();
    const matchingRoles = await prisma.systemRole.findMany({ select: { id: true, code: true } });
    for (const role of Object.values(Role)) {
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

        if (!existing) {
            matchingRoles.push({ id: systemRole.id, code: `${role}_GLOBAL` });
        }

        roleTargets.set(role, systemRole.id);

    }

    // Repair stale legacy links left by the old role/permission bootstrap.
    // A user's enum role is the identity source for the canonical SystemRole
    // link; section-specific roles remain valid when they resolve to the same
    // enum role through roleCodeFromSystemRole().  Only a stale link paired
    // with a legacy-only direct override is cleared, because that override
    // cannot express the canonical capability catalog and would otherwise
    // shadow the repaired role grants at runtime.
    const users = await prisma.user.findMany({
        select: {
            id: true,
            role: true,
            roleId: true,
            permissions: true,
            systemRole: { select: { code: true } },
        },
    });
    const canonicalCodes = new Set(RBAC_PERMISSION_DEFINITIONS.map((definition) => definition.code));

    for (const user of users) {
        const targetRoleId = roleTargets.get(user.role);
        if (!targetRoleId) continue;

        const linkedRole = user.systemRole ? roleCodeFromSystemRole(user.systemRole.code) : null;
        const staleLink = !user.roleId || linkedRole !== user.role;
        if (!staleLink) continue;

        const storedPermissions = parseStoredPermissions(user.permissions);
        const legacyOnlyOverride = storedPermissions.length > 0
            && !storedPermissions.some((permission) => canonicalCodes.has(permission));

        await prisma.user.update({
            where: { id: user.id },
            data: {
                roleId: targetRoleId,
                ...(legacyOnlyOverride ? { permissions: null } : {}),
                tokenVersion: { increment: 1 },
            },
        });
        userIdentityRepairs++;
    }

    const systemRoles = await prisma.systemRole.findMany({ select: { id: true, code: true } });

    const permissionIds = new Map<string, string>();
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
        permissionIds.set(definition.code, permission.id);
    }

    const desiredGrants = RBAC_PERMISSION_DEFINITIONS.flatMap((definition) => {
        const allowedRoles = new Set(bootstrapGrants[definition.code] ?? []);
        const permissionDefinitionId = permissionIds.get(definition.code);
        if (!permissionDefinitionId) return [];

        return systemRoles.flatMap((systemRole) => {
            const roleCode = roleCodeFromSystemRole(systemRole.code);
            if (!roleCode || !allowedRoles.has(roleCode)) return [];

            return [{
                roleId: systemRole.id,
                permission: definition.code,
                permissionDefinitionId,
            }];
        });
    });

    // Reconcile canonical grants in two set-based writes. Legacy page keys
    // and unrelated administrator-created permissions remain untouched.
    await prisma.rolePermission.deleteMany({
        where: { permission: { in: RBAC_PERMISSION_DEFINITIONS.map((definition) => definition.code) } },
    });
    if (desiredGrants.length > 0) {
        await prisma.rolePermission.createMany({ data: desiredGrants, skipDuplicates: true });
    }
    grants = desiredGrants.length;

    console.log(
        `RBAC capability seed complete: ${definitions} definitions, ${grants} grants ensured, `
        + `${userIdentityRepairs} stale user role link(s) repaired.`
    );
}

main()
    .catch((error) => {
        console.error('RBAC capability seed failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
