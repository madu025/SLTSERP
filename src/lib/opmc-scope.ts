import { prisma } from '@/lib/prisma';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/** Nil UUID literal — safe deny-all sentinel for @db.Uuid columns. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Tri-state OPMC scope resolution (single source of truth for regional isolation):
 *
 *  - `undefined`  → a user with the database-backed global RBAC capability — global access, no filter.
 *  - `[]`         → non-admin with no OPMC assignments — DENY ALL.
 *  - `[ids...]`   → non-admin restricted to exactly these OPMC IDs.
 *
 * Fail-closed: a missing identity or unknown user resolves to `[]` (deny all),
 * never to global access.
 */
export type ScopeDomain = 'sod' | 'finance' | 'project' | 'inventory' | 'reports' | 'procurement' | 'contractor' | 'company';

/** Pure rule: which OPMCs a user's rows may come from, given what they hold. undefined = every OPMC. */
export function scopeFromPermissions(permissions: readonly string[], opmcIds: string[], domain?: ScopeDomain): string[] | undefined {
    if (permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) return undefined;
    // a data-scope capability opens one domain only; a call that names no domain stays strict (assigned OPMCs), so nothing widens by accident
    if (domain) {
        const code = `scope.${domain}.all`;
        if (permissions.includes(code) || permissions.includes(RBAC_PERMISSIONS.SCOPE_COMPANY_ALL)) return undefined;
    }
    return opmcIds;
}

export async function resolveOpmcScope(userId: string | null | undefined, domain?: ScopeDomain): Promise<string[] | undefined> {
    if (!userId) return [];

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            permissions: true,
            accessibleOpmcs: { select: { id: true } },
            systemRole: {
                select: {
                    isActive: true,
                    permissions: true,
                    rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } }
                }
            },
            sectionAssignments: {
                select: {
                    role: {
                        select: {
                            isActive: true,
                            permissions: true,
                            rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } }
                        }
                    }
                }
            }
        }
    });

    if (!user) return [];
    return scopeFromPermissions(deriveEffectivePermissions(user), user.accessibleOpmcs.map(o => o.id), domain);
}
