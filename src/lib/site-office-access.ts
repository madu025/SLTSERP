import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/**
 * The petty cash box, the floats and the IOUs belong to a SITE OFFICE (an inventory store), not to an OPMC (RTOM): one site office can cover several RTOMs.
 * The finance data scope decides who sees which site offices: a role with company-wide finance scope sees every site office, anyone else sees the site offices
 * they manage or are assigned to, and those that cover an OPMC in their scope.
 */
export async function siteOfficeScope(userId: string | null | undefined): Promise<string[] | undefined> {
    if (!userId) return [];
    const opmcScope = await resolveOpmcScope(userId, 'finance');
    if (opmcScope === undefined) return undefined;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { assignedStoreId: true } });
    const stores = await prisma.inventoryStore.findMany({
        where: { OR: [{ managerId: userId }, ...(user?.assignedStoreId ? [{ id: user.assignedStoreId }] : []), { opmcs: { some: { id: { in: opmcScope } } } }] },
        select: { id: true },
    });
    return stores.map((s) => s.id);
}

export async function assertSiteOfficeAccess(userId: string | null | undefined, siteOfficeId: string | null | undefined): Promise<void> {
    const scope = await siteOfficeScope(userId);
    if (scope === undefined) return;
    if (!siteOfficeId || !scope.includes(siteOfficeId)) throw AppError.forbidden('SITE_OFFICE_SCOPE_VIOLATION: this site office is outside your area');
}

/** A short, readable code of a site office for document numbers: "Kaduwela Store" -> "KADUWELA". */
export function siteOfficeCode(name: string): string {
    const code = name.replace(/\s+store$/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    return code || 'SITE';
}

/** The site offices a person can keep a petty cash box for (transit and closed stores are not site offices). */
export async function listSiteOffices(userId: string | null | undefined) {
    const scope = await siteOfficeScope(userId);
    return prisma.inventoryStore.findMany({
        where: { type: { in: ['MAIN', 'SUB'] }, ...(scope === undefined ? {} : { id: { in: scope } }) },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
    });
}
