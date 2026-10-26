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
export async function resolveOpmcScope(userId: string | null | undefined): Promise<string[] | undefined> {
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
    const permissions = deriveEffectivePermissions(user);
    if (permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) return undefined;
    return user.accessibleOpmcs.map(o => o.id);
}
