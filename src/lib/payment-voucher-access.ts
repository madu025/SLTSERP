import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** A voucher for a monthly contractor (SOD) invoice carries the invoice id in its description. */
export const SOD_INVOICE_REF = 'BOM_INVOICING_REF:';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The contractor invoice a voucher pays, read from its description; null for any other voucher. */
export function sodInvoiceIdOf(description: string | null | undefined): string | null {
    if (!description || !description.startsWith(SOD_INVOICE_REF)) return null;
    return description.slice(SOD_INVOICE_REF.length).match(UUID)?.[0] ?? null;
}

/** An area decision: no restriction (company-wide) allows everything, otherwise the area must be one of the user's. */
export function areaAllows(scope: readonly string[] | undefined, opmcId: string | null | undefined): boolean {
    return scope === undefined || (!!opmcId && scope.includes(opmcId));
}

/** A contractor invoice follows its own area (the area of its orders), because it has no project. */
export async function assertContractorAreaAccess(opmcId: string | null | undefined, userId: string | null | undefined): Promise<void> {
    if (!areaAllows(await resolveOpmcScope(userId), opmcId)) {
        throw AppError.forbidden('This contractor invoice is outside your area');
    }
}

/**
 * A project voucher follows its project's access rules. A contractor (SOD) invoice voucher has no project: it follows the area of the
 * invoice's contractor. Any other voucher without a project (a vendor payment) is company-wide: only users with company-wide finance
 * access (no OPMC restriction) may see or act on it.
 */
export async function assertVoucherAccess(projectId: string | null | undefined, userId: string | null | undefined, description?: string | null): Promise<void> {
    if (projectId) {
        await assertProjectAccess(projectId, userId);
        return;
    }
    const scope = await resolveOpmcScope(userId);
    if (scope === undefined) return;
    const invoiceId = sodInvoiceIdOf(description);
    if (invoiceId) {
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { opmcId: true, contractor: { select: { opmcId: true } } } });
        if (areaAllows(scope, invoice?.opmcId ?? invoice?.contractor?.opmcId)) return;
        throw AppError.forbidden('This contractor invoice is outside your area');
    }
    throw AppError.forbidden('Vendor payments need company-wide finance access');
}

/** Ids of the project-less contractor invoice vouchers inside the given areas (for list filters). */
export async function sodVoucherIdsInScope(scope: readonly string[]): Promise<string[]> {
    if (scope.length === 0) return [];
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT pv.id FROM "PaymentVoucher" pv
        JOIN "Invoice" i ON pv."description" LIKE ${SOD_INVOICE_REF} || i.id::text || '%'
        JOIN "Contractor" c ON c.id = i."contractorId"
        WHERE pv."projectId" IS NULL AND COALESCE(i."opmcId", c."opmcId") = ANY(${[...scope]}::uuid[])`;
    return rows.map((r) => r.id);
}
