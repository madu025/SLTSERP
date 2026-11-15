import { prisma } from '@/lib/prisma';
import { DAY_MS, type ApprovalAgeRow, type ApprovalAgeingReport } from '@/lib/control-shared';
import { ApprovalSlaService } from '@/services/notification/approval-sla.service';

/**
 * What is waiting for somebody's approval across the modules, and for how long. Counts come from each module's own
 * pending status and the oldest waiting item's creation date. SLA breaches are only reported where a module stores an SLA.
 */
export class ApprovalAgeingService {
    static async getReport(now = new Date()): Promise<ApprovalAgeingReport> {
        const age = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS)) : null);
        const rows: ApprovalAgeRow[] = [];
        const add = (type: string, pending: number, oldest: Date | null | undefined, href: string, overSla: number | null = null) => rows.push({ type, pending, oldestDays: age(oldest), overSla, href });

        // One after another: each is a count plus a minimum on an indexed status column
        const pv = await prisma.paymentVoucher.aggregate({ where: { status: 'PENDING_APPROVAL' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Payment vouchers', pv._count._all, pv._min.createdAt, '/finance/payment-vouchers');
        // Payments handed to Head Office and not yet confirmed paid; funding asked of Head Office and not yet decided
        const ho = await prisma.paymentVoucher.aggregate({ where: { status: 'SUBMITTED_TO_HO' }, _count: { _all: true }, _min: { submittedToHoAt: true } });
        add('Payments awaiting Head Office', ho._count._all, ho._min.submittedToHoAt, '/finance/ho-payments');
        const hb = await prisma.projectInvoice.aggregate({ where: { hoCollectionStatus: { in: ['SENT_TO_HO', 'PARTIALLY_COLLECTED'] } }, _count: { _all: true }, _min: { sentToHoAt: true } });
        add('Collections awaiting Head Office', hb._count._all, hb._min.sentToHoAt, '/finance/ho-billing');
        const hf = await prisma.hoFundingRequest.aggregate({ where: { status: { in: ['SUBMITTED', 'APPROVED'] } }, _count: { _all: true }, _min: { submittedAt: true } });
        add('Funding awaiting Head Office', hf._count._all, hf._min.submittedAt, '/finance/ho-funding');
        const pc = await prisma.pettyCashVoucher.aggregate({ where: { status: { in: ['PENDING_APPROVAL', 'SUBMITTED'] } }, _count: { _all: true }, _min: { createdAt: true } });
        add('Petty cash vouchers', pc._count._all, pc._min.createdAt, '/finance');
        const pi = await prisma.projectInvoice.aggregate({ where: { status: { in: ['PENDING_APPROVAL', 'SUBMITTED', 'PENDING'] } }, _count: { _all: true }, _min: { createdAt: true } });
        add('Project invoices', pi._count._all, pi._min.createdAt, '/projects');
        const po = await prisma.projectPurchaseOrder.aggregate({ where: { status: 'PENDING_APPROVAL' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Project purchase orders', po._count._all, po._min.createdAt, '/procurement/performance');
        const am = await prisma.invoiceAmendmentRequest.aggregate({ where: { status: 'PENDING_SF_APPROVAL' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Invoice amendments (SF Audit)', am._count._all, am._min.createdAt, '/finance/sf-audit/governance');
        const sr = await prisma.stockRequest.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Stock requests', sr._count._all, sr._min.createdAt, '/procurement/performance');
        const mrn = await prisma.mRN.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Material return notes', mrn._count._all, mrn._min.createdAt, '/inventory');
        const cc = await prisma.cycleCountHeader.aggregate({ where: { status: { in: ['PENDING_APPROVAL', 'SUBMITTED'] } }, _count: { _all: true }, _min: { createdAt: true } });
        add('Stock counts', cc._count._all, cc._min.createdAt, '/inventory');
        const ds = await prisma.assetDisposalRequest.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } });
        add('Asset disposals', ds._count._all, ds._min.createdAt, '/helpdesk');
        const ua = await prisma.universalApprovalInstance.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _min: { createdAt: true } });
        const slaBreaches = await ApprovalSlaService.findBreaches(now).catch(() => []);
        add('Process-gate approvals', ua._count._all, ua._min.createdAt, '/approvals', slaBreaches.length);
        const je = await prisma.journalEntry.aggregate({ where: { status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, _count: { _all: true }, _min: { createdAt: true } });
        add('Journal entries', je._count._all, je._min.createdAt, '/finance');

        rows.sort((a, b) => (b.oldestDays ?? -1) - (a.oldestDays ?? -1));
        return { asOf: now.toISOString(), rows, totalPending: rows.reduce((a, r) => a + r.pending, 0) };
    }
}
