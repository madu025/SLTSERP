import { prisma } from '@/lib/prisma';
import { isDatabaseRole } from '@/lib/role-validation';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';

export interface SessionValidity {
    valid: boolean;
    role?: string;
    status?: string;
    permissions?: string[];
    /** Account must rotate its password before doing anything else. */
    mustChangePassword?: boolean;
}

/**
 * Fail-closed session freshness check.
 * Verifies the presented tokenVersion matches the DB so that a role/status
 * change immediately invalidates all previously issued tokens.
 *
 * Cost: single indexed lookup on User primary key. Skipped when the request
 * carries no authenticated user (public routes).
 */
export async function validateSession(
    userId: string | null,
    tokenVersion: number | null
): Promise<SessionValidity> {
    if (!userId) return { valid: true }; // public/unauthenticated path handled elsewhere

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            tokenVersion: true,
            role: true,
            status: true,
            mustChangePassword: true,
            permissions: true,
            systemRole: {
                select: {
                    isActive: true,
                    permissions: true,
                    rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
                },
            },
            sectionAssignments: {
                select: {
                    role: {
                        select: {
                            isActive: true,
                            permissions: true,
                            rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
                        },
                    },
                },
            },
        },
    });

    if (!user) return { valid: false };
    // Prisma enforces the enum at the database layer, but keep the session
    // boundary fail-closed if a legacy/import path ever returns an unknown
    // role value.
    if (!isDatabaseRole(user.role)) return { valid: false };
    if ((user.status || 'active').toLowerCase() !== 'active') return { valid: false, role: user.role, status: user.status };
    // Legacy tokens (signed before tokenVersion existed) present null -> treated
    // as version 0, which matches the DB default until an admin bumps it.
    const presented = tokenVersion ?? 0;
    if (presented !== user.tokenVersion) return { valid: false, role: user.role, status: user.status };

    return {
        valid: true,
        role: user.role,
        status: user.status,
        permissions: deriveEffectivePermissions(user),
        mustChangePassword: user.mustChangePassword,
    };
}
