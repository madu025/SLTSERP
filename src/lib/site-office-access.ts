import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { checkReleaseApprover } from '@/lib/petty-cash-rules';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/**
 * The petty cash box, the floats and the IOUs belong to a SITE OFFICE (an inventory store), not to an OPMC (RTOM): one site office can cover several RTOMs.
 * The finance data scope decides who sees which site offices: a role with company-wide finance scope sees every site office, anyone else sees the site offices
 * they manage or are assigned to, those that cover an OPMC in their scope, the ones whose petty cash they look after (custodian) and the ones they are the
 * Area Manager of.
 */
export async function siteOfficeScope(userId: string | null | undefined): Promise<string[] | undefined> {
    if (!userId) return [];
    const opmcScope = await resolveOpmcScope(userId, 'finance');
    if (opmcScope === undefined) return undefined;
    // people without a finance reading capability (a custodian, an Area Manager) see only the site offices they look after or are the Area Manager of: the RTOMs they work in do not open every box
    const reads = await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_READ);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { assignedStoreId: true } });
    const custody = await prisma.pettyCashCustodian.findMany({ where: { userId }, select: { accountId: true } });
    const boxes = custody.length ? await prisma.pettyCashAccount.findMany({ where: { id: { in: custody.map((c) => c.accountId) } }, select: { siteOfficeId: true } }) : [];
    const stores = await prisma.inventoryStore.findMany({
        where: {
            OR: [
                { areaManagerId: userId },
                ...(boxes.some((b) => b.siteOfficeId) ? [{ id: { in: boxes.map((b) => b.siteOfficeId).filter((x): x is string => !!x) } }] : []),
                ...(reads ? [{ managerId: userId }, ...(user?.assignedStoreId ? [{ id: user.assignedStoreId }] : []), { opmcs: { some: { id: { in: opmcScope } } } }] : []),
            ],
        },
        select: { id: true },
    });
    return stores.map((s) => s.id);
}

export async function assertSiteOfficeAccess(userId: string | null | undefined, siteOfficeId: string | null | undefined): Promise<void> {
    const scope = await siteOfficeScope(userId);
    if (scope === undefined) return;
    if (!siteOfficeId || !scope.includes(siteOfficeId)) throw AppError.forbidden('SITE_OFFICE_SCOPE_VIOLATION: this site office is outside your area');
}

/** The Area Manager (ARM) of a site office, as registered. */
export async function areaManagerOf(siteOfficeId: string): Promise<string | null> {
    const s = await prisma.inventoryStore.findUnique({ where: { id: siteOfficeId }, select: { areaManagerId: true } });
    return s?.areaManagerId ?? null;
}

/** A release of petty cash at a site office is approved by its Area Manager: not by the Finance Manager, not by the person who asked. */
export async function assertAreaManagerApproves(actorId: string, siteOfficeId: string, makerId?: string | null): Promise<void> {
    const verdict = checkReleaseApprover({ areaManagerId: await areaManagerOf(siteOfficeId), actorId, makerId });
    if (!verdict.ok) throw verdict.reason === 'NO_AREA_MANAGER' ? AppError.badRequest(`${verdict.reason}: ${verdict.message}`) : AppError.forbidden(`${verdict.reason}: ${verdict.message}`);
}

/** Whether the person looks after the petty cash of this box. */
export async function isCustodian(userId: string, accountId: string): Promise<boolean> {
    return !!(await prisma.pettyCashCustodian.findUnique({ where: { accountId_userId: { accountId, userId } }, select: { id: true } }));
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
        select: { id: true, name: true, type: true, areaManagerId: true },
        orderBy: { name: 'asc' },
    });
}
