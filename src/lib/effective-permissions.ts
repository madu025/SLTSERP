/**
 * Single permission resolver used by login, refresh, and API authorization.
 *
 * User.permissions is an explicit Super Admin override. When it is null,
 * permissions are composed from the user's assigned SystemRole records and
 * the normalized RolePermission rows attached to those records.
 */
export interface PermissionRoleSource {
    isActive?: boolean;
    permissions?: string | null;
    rolePermissions?: ReadonlyArray<{
        permission: string;
        permissionDefinition?: { code: string } | null;
    }>;
}

export interface EffectivePermissionSource {
    permissions?: string | null;
    systemRole?: PermissionRoleSource | null;
    sectionAssignments?: ReadonlyArray<{ role?: PermissionRoleSource | null }>;
}

export function parsePermissionList(value: string | null | undefined): string[] {
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

function collectRolePermissions(role: PermissionRoleSource | null | undefined): string[] {
    if (!role || role.isActive === false) return [];

    return [
        ...parsePermissionList(role.permissions),
        ...(role.rolePermissions ?? []).flatMap((entry) => [
            entry.permissionDefinition?.code,
            entry.permission,
        ].filter((permission): permission is string => Boolean(permission))),
    ];
}

export function deriveEffectivePermissions(source: EffectivePermissionSource): string[] {
    // A direct user override is authoritative, including an explicit []
    // which intentionally removes inherited permissions.
    if (source.permissions !== null && source.permissions !== undefined) {
        return [...new Set(parsePermissionList(source.permissions))];
    }

    const inherited = [
        ...collectRolePermissions(source.systemRole),
        ...(source.sectionAssignments ?? []).flatMap((assignment) =>
            collectRolePermissions(assignment.role)
        ),
    ];

    return [...new Set(inherited)];
}
