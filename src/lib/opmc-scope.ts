import { ROLE_GROUPS } from '@/config/roles';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

/** Nil UUID literal — safe deny-all sentinel for @db.Uuid columns. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Tri-state OPMC scope resolution (single source of truth for regional isolation):
 *
 *  - `undefined`  → admin tier (ROLE_GROUPS.ADMINS) — global access, no filter.
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
        select: { role: true, accessibleOpmcs: { select: { id: true } } }
    });

    if (!user) return [];
    if (ROLE_GROUPS.ADMINS.includes(user.role as Role)) return undefined;
    return user.accessibleOpmcs.map(o => o.id);
}
