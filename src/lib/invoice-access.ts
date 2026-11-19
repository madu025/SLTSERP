import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/**
 * A monthly contractor (SOD) invoice belongs to its own area (the area of its orders; older invoices have the area of their contractor),
 * so a user may see and change only the invoices inside their own OPMC scope. Company-wide access (no restriction) sees all; no identity sees none.
 */
export function invoiceAreaOf(inv: { opmcId?: string | null; contractor?: { opmcId?: string | null } | null }): string | null {
    return inv.opmcId ?? inv.contractor?.opmcId ?? null;
}

/** The same rule as a database filter. */
export function invoiceAreaWhere(scope: readonly string[]): Prisma.InvoiceWhereInput {
    return { OR: [{ opmcId: { in: [...scope] } }, { opmcId: null, contractor: { opmcId: { in: [...scope] } } }] };
}

export async function invoiceScopeWhere(userId: string | null | undefined): Promise<Prisma.InvoiceWhereInput> {
    const scope = await resolveOpmcScope(userId);
    return scope === undefined ? {} : invoiceAreaWhere(scope);
}

/** Throws unless the invoice's contractor is inside the user's OPMC scope. */
export async function assertInvoiceAccess(invoiceId: string, userId: string | null | undefined): Promise<void> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { opmcId: true, contractor: { select: { opmcId: true } } } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    const scope = await resolveOpmcScope(userId);
    const area = invoiceAreaOf(invoice);
    if (scope !== undefined && (!area || !scope.includes(area))) {
        throw AppError.forbidden('This invoice is outside your area');
    }
}

/** Throws unless the contractor is inside the user's OPMC scope (used before an invoice is created for it). */
export async function assertContractorInScope(contractorId: string, userId: string | null | undefined): Promise<void> {
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId }, select: { opmcId: true } });
    if (!contractor) throw AppError.notFound('Contractor not found');
    const scope = await resolveOpmcScope(userId);
    if (scope !== undefined && (!contractor.opmcId || !scope.includes(contractor.opmcId))) {
        throw AppError.forbidden('This contractor is outside your area');
    }
}
