import { prisma } from '../src/lib/prisma';
import { validateSodForInvoicing } from '../src/services/service-order/sod-financial-validation';

/**
 * Reconcile legacy `isInvoicable` flags against the same validation used by
 * engineer verification and invoice generation.
 *
 * Safe default is dry-run. Use `--apply` only for the authorized repair. This
 * script never invents material prices and never changes stock.
 */
async function main() {
    const apply = process.argv.includes('--apply');
    const rows = await prisma.serviceOrder.findMany({
        where: { isInvoicable: true },
        select: {
            id: true,
            soNum: true,
            rtom: true,
            contractorId: true,
            completedDate: true,
            revenueAmount: true,
            contractorAmount: true,
            sltsPatStatus: true,
            opmcPatStatus: true,
            hoPatStatus: true,
            materialUsage: { select: { quantity: true, unitPrice: true, costPrice: true } }
        }
    });

    const invalid = rows.filter((row) => {
        const financial = validateSodForInvoicing(row).eligible;
        const patVerified = row.sltsPatStatus === 'PAT_PASSED'
            && row.opmcPatStatus === 'PAT_PASSED'
            && row.hoPatStatus === 'PAT_PASSED';
        return !financial || !patVerified;
    });
    const reasonCounts = new Map<string, number>();
    for (const row of invalid) {
        const reasons = [...validateSodForInvoicing(row).reasons];
        if (row.sltsPatStatus !== 'PAT_PASSED' || row.opmcPatStatus !== 'PAT_PASSED' || row.hoPatStatus !== 'PAT_PASSED') {
            reasons.push('PAT_VERIFICATION_INCOMPLETE');
        }
        for (const reason of reasons) {
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        }
    }

    console.log(JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        invoicableBefore: rows.length,
        invalidCount: invalid.length,
        reasonCounts: Object.fromEntries(reasonCounts),
        sample: invalid.slice(0, 10).map((row) => ({
            soNum: row.soNum,
            rtom: row.rtom,
            reasons: [
                ...validateSodForInvoicing(row).reasons,
                ...(row.sltsPatStatus === 'PAT_PASSED' && row.opmcPatStatus === 'PAT_PASSED' && row.hoPatStatus === 'PAT_PASSED' ? [] : ['PAT_VERIFICATION_INCOMPLETE'])
            ]
        }))
    }, null, 2));

    if (!apply || invalid.length === 0) return;

    const repairId = `INVOICABLE_RECONCILIATION_${new Date().toISOString()}`;
    await prisma.$transaction(async (tx) => {
        for (let offset = 0; offset < invalid.length; offset += 1000) {
            const ids = invalid.slice(offset, offset + 1000).map((row) => row.id);
            await tx.serviceOrder.updateMany({
                where: { id: { in: ids }, isInvoicable: true },
                data: { isInvoicable: false }
            });
        }

        await tx.auditLog.create({
            data: {
                action: 'INVOICABLE_DATA_RECONCILIATION',
                entity: 'ServiceOrder',
                entityId: repairId,
                newValue: {
                    repairId,
                    affectedCount: invalid.length,
                    reasonCounts: Object.fromEntries(reasonCounts),
                    rule: 'validateSodForInvoicing',
                    source: 'scripts/repair-invoicable-data.ts',
                    materialPricesInvented: false
                }
            }
        });
    }, { timeout: 120000, maxWait: 10000 });

    const remaining = await prisma.serviceOrder.count({ where: { isInvoicable: true } });
    console.log(JSON.stringify({ repairId, invoicableAfter: remaining, disabled: invalid.length }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
});
