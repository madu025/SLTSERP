import type { TransactionClient } from '@/types/inventory/inventory-service.types';

export interface EntryDimensions {
    opmcId?: string | null;
    projectId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reference types whose reference id is a service order. */
const SOD_TYPES = new Set(['SOD_CONSUMPTION', 'SOD_REVENUE', 'SOD_WIP_ACCRUAL', 'CONTRACTOR_ACCRUAL', 'SOD']);

/**
 * Work out the OPMC / project an entry belongs to from the document it was posted for.
 *
 * Attribution is best effort and read-only: an unknown reference type, a non-UUID reference or any lookup
 * failure yields no dimension (the entry is then reported as "Unattributed") and can never block a posting.
 * Keep this in step with the backfill in migration 20261121000000_journal_entry_dimensions.
 */
export async function resolveEntryDimensions(
    tx: Pick<TransactionClient, 'serviceOrder' | 'projectExpense' | 'projectInvoice' | 'customerReceipt' | 'invoice' | 'paymentVoucher' | 'projectLDPenalty' | 'projectRetention' | 'pettyCashVoucher' | 'pettyCashReimbursement' | 'pettyCashAccount' | 'payrollExpense' | 'project'>,
    referenceType: string | null | undefined,
    referenceId: string | null | undefined,
): Promise<EntryDimensions> {
    if (!referenceType || !referenceId || !UUID_RE.test(referenceId)) return {};
    const type = referenceType.replace(/^REVERSAL_/, '');
    try {
        const withProject = async (projectId: string | null | undefined): Promise<EntryDimensions> => {
            if (!projectId) return {};
            const project = await tx.project.findUnique({ where: { id: projectId }, select: { opmcId: true } });
            return { projectId, opmcId: project?.opmcId ?? null };
        };

        if (SOD_TYPES.has(type)) {
            const so = await tx.serviceOrder.findUnique({ where: { id: referenceId }, select: { opmcId: true } });
            return { opmcId: so?.opmcId ?? null };
        }
        switch (type) {
            case 'PROJECT_EXPENSE':
                return withProject((await tx.projectExpense.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            case 'INVOICE_ISSUANCE':
            case 'INVOICE_GENERATION': {
                const client = await tx.projectInvoice.findUnique({ where: { id: referenceId }, select: { projectId: true } });
                if (client?.projectId) return withProject(client.projectId);
                return withProject((await tx.invoice.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            }
            case 'CONTRACTOR_INVOICE':
                return withProject((await tx.invoice.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            case 'CUSTOMER_RECEIPT': {
                const receipt = await tx.customerReceipt.findUnique({ where: { id: referenceId }, select: { invoiceId: true } });
                if (!receipt?.invoiceId) return {};
                return withProject((await tx.projectInvoice.findUnique({ where: { id: receipt.invoiceId }, select: { projectId: true } }))?.projectId);
            }
            case 'PV_PAYMENT':
                return withProject((await tx.paymentVoucher.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            case 'LD_PENALTY':
                return withProject((await tx.projectLDPenalty.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            case 'RETENTION_RELEASE':
                return withProject((await tx.projectRetention.findUnique({ where: { id: referenceId }, select: { projectId: true } }))?.projectId);
            case 'PETTY_CASH_EXPENSE': {
                const v = await tx.pettyCashVoucher.findUnique({ where: { id: referenceId }, select: { accountId: true } });
                if (!v) return {};
                return { opmcId: (await tx.pettyCashAccount.findUnique({ where: { id: v.accountId }, select: { opmcId: true } }))?.opmcId ?? null };
            }
            case 'PETTY_CASH_REIMBURSEMENT': {
                const r = await tx.pettyCashReimbursement.findUnique({ where: { id: referenceId }, select: { accountId: true } });
                if (!r) return {};
                return { opmcId: (await tx.pettyCashAccount.findUnique({ where: { id: r.accountId }, select: { opmcId: true } }))?.opmcId ?? null };
            }
            case 'PAYROLL_ALLOCATION':
                return { opmcId: (await tx.payrollExpense.findUnique({ where: { id: referenceId }, select: { opmcId: true } }))?.opmcId ?? null };
            default:
                return {};
        }
    } catch (error) {
        // A failed lookup inside a Postgres transaction poisons it; the caller must not depend on this result.
        console.warn('[LEDGER-DIM] Dimension lookup skipped:', error instanceof Error ? error.message : error);
        return {};
    }
}
