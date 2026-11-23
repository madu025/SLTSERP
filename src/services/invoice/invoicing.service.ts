import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { ServiceOrderService } from '@/services/service-order';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';
import { InvoiceGateService } from '@/services/invoice/invoice-gate.service';
import { SodApprovalService, monthRange } from '@/services/service-order/sod-approval.service';
import { stageLabel } from '@/lib/approval-chain-rules';
import { SOD_PAT_OK, SOD_READY_STAGES, isLateSod, completedMonthLabel } from '@/lib/sod-approval-rules';

const MAX_ORDERS = 2000;

export interface InvoicingOrder {
    id: string; soNum: string; completedDate: Date | null; completedMonth: string; late: boolean;
    contractorAmount: number; revenueAmount: number; held: boolean; holdReason: string | null;
}
export interface InvoicingGroup {
    key: string; contractorId: string; contractorName: string; opmcId: string; area: string;
    orders: InvoicingOrder[]; total: number; lateCount: number;
}

export interface CreateOutcome { contractor: string; area: string; invoiceNumber?: string; orders: number; total?: number; error?: string }

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/**
 * The engineer's month-end step. The orders that the Area Coordinator and QC Officer passed (stage READY) are listed for the engineer's
 * area, grouped by contractor and RTOM, with the payment per order. One press creates the invoices: one per contractor, area and billing
 * month. An order completed in an earlier month than the billing month is a late SOD: it is billed now and shown as late on the invoice.
 */
export class InvoicingService {
    static async candidates(userId: string, filter: { month: number; year: number; rtom?: string; contractorId?: string }) {
        if (!filter.month || !filter.year) throw AppError.badRequest('Choose the billing month and year');
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope !== undefined && scope.length === 0) return { groups: [] as InvoicingGroup[], held: [] as InvoicingGroup[], total: 0, waitingCheck: 0, waitingContractor: 0 };
        const end = monthRange(filter.month, filter.year).lt;
        const orders = await prisma.serviceOrder.findMany({
            where: {
                sodApprovalStage: { in: [...SOD_READY_STAGES] }, invoiced: false, contractorId: { not: null }, contractorVerifiedAt: { not: null }, completedDate: { lt: end }, AND: [SOD_PAT_OK],
                ...(scope === undefined ? {} : { opmcId: { in: scope } }),
                ...(filter.rtom ? { rtom: filter.rtom } : {}), ...(filter.contractorId ? { contractorId: filter.contractorId } : {}),
            },
            orderBy: [{ completedDate: 'asc' }, { soNum: 'asc' }], take: MAX_ORDERS,
            select: {
                id: true, soNum: true, completedDate: true, contractorId: true, opmcId: true, rtom: true, contractorAmount: true, revenueAmount: true, invoicingHeldAt: true, invoicingHoldReason: true,
                contractor: { select: { name: true } },
            },
        });
        const byKey = new Map<string, InvoicingGroup>();
        const heldByKey = new Map<string, InvoicingGroup>();
        for (const o of orders) {
            if (!o.contractorId || !o.opmcId) continue;
            const held = !!o.invoicingHeldAt;
            const map = held ? heldByKey : byKey;
            const key = `${o.contractorId}:${o.opmcId}`;
            const g = map.get(key) ?? { key, contractorId: o.contractorId, contractorName: o.contractor?.name ?? '-', opmcId: o.opmcId, area: o.rtom, orders: [], total: 0, lateCount: 0 };
            const late = isLateSod(o.completedDate, filter.month, filter.year);
            g.orders.push({ id: o.id, soNum: o.soNum, completedDate: o.completedDate, completedMonth: completedMonthLabel(o.completedDate), late, contractorAmount: num(o.contractorAmount), revenueAmount: num(o.revenueAmount), held, holdReason: o.invoicingHoldReason });
            g.total += num(o.contractorAmount);
            if (late) g.lateCount += 1;
            map.set(key, g);
        }
        const sorted = (m: Map<string, InvoicingGroup>) => [...m.values()].sort((a, b) => a.area.localeCompare(b.area) || a.contractorName.localeCompare(b.contractorName));
        // finished orders of the area that still wait for the Completed SOD check (the engineer sees how many are on the way)
        const waitingCheck = await prisma.serviceOrder.count({
            where: {
                status: { in: ['COMPLETED', 'INSTALL_CLOSED'] }, invoiced: false, contractorId: { not: null },
                OR: [{ sodApprovalStage: null }, { sodApprovalStage: { notIn: [...SOD_READY_STAGES] } }], AND: [SOD_PAT_OK],
                ...(scope === undefined ? {} : { opmcId: { in: scope } }), ...(filter.rtom ? { rtom: filter.rtom } : {}),
            },
        });
        // passed the check but not yet verified by the contractor
        const waitingContractor = await prisma.serviceOrder.count({
            where: {
                sodApprovalStage: { in: [...SOD_READY_STAGES] }, invoiced: false, contractorId: { not: null }, contractorVerifiedAt: null,
                ...(scope === undefined ? {} : { opmcId: { in: scope } }), ...(filter.rtom ? { rtom: filter.rtom } : {}),
            },
        });
        return { groups: sorted(byKey), held: sorted(heldByKey), total: orders.length, waitingCheck, waitingContractor };
    }

    /**
     * Create the invoices for the chosen orders: the order financial check runs first (PAT, amounts, material costs; a line without a
     * cost is priced from the item), then one invoice per contractor and area. Each group is its own transaction, so one failing group
     * does not stop the others.
     */
    static async create(userId: string, input: { month: number; year: number; sodIds: string[] }) {
        const ids = [...new Set(input.sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_ORDERS) throw AppError.badRequest(`Create invoices for at most ${MAX_ORDERS} orders at a time`);
        const scope = await resolveOpmcScope(userId, 'finance');
        const end = monthRange(input.month, input.year).lt;
        const orders = await prisma.serviceOrder.findMany({
            where: {
                id: { in: ids }, sodApprovalStage: { in: [...SOD_READY_STAGES] }, invoiced: false, contractorId: { not: null }, contractorVerifiedAt: { not: null }, invoicingHeldAt: null, completedDate: { lt: end },
                ...(scope === undefined ? {} : { opmcId: { in: scope } }),
            },
            select: { id: true, soNum: true, contractorId: true, opmcId: true },
        });
        const notEligible = ids.length - orders.length;
        if (orders.length === 0) throw AppError.badRequest('None of the selected orders can be invoiced: they must be passed by the Area Coordinator and QC Officer, completed on or before the billing month, in your area, and not held back.');

        const check = await ServiceOrderService.verifyInvoicable(orders.map((o) => o.id), userId, 'Engineer invoicing', { lenient: true });
        const verified = new Set(check.verifiedIds);
        const blocked = check.rejected.map((r) => ({ soNum: r.soNum, reasons: r.reasons }));

        const groups = new Map<string, { contractorId: string; opmcId: string; ids: string[] }>();
        for (const o of orders) {
            if (!verified.has(o.id) || !o.contractorId || !o.opmcId) continue;
            const key = `${o.contractorId}:${o.opmcId}`;
            const g = groups.get(key) ?? { contractorId: o.contractorId, opmcId: o.opmcId, ids: [] };
            g.ids.push(o.id); groups.set(key, g);
        }

        const names = new Map((await prisma.contractor.findMany({ where: { id: { in: [...new Set([...groups.values()].map((g) => g.contractorId))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
        const areas = new Map((await prisma.oPMC.findMany({ where: { id: { in: [...new Set([...groups.values()].map((g) => g.opmcId))] } }, select: { id: true, rtom: true } })).map((a) => [a.id, a.rtom]));
        const created: CreateOutcome[] = [];
        for (const g of groups.values()) {
            const label = { contractor: names.get(g.contractorId) ?? '-', area: areas.get(g.opmcId) ?? '-', orders: g.ids.length };
            try {
                const res = await InvoiceGeneratorService.generateContractorMonthlyInvoice({ contractorId: g.contractorId, opmcId: g.opmcId, sodIds: g.ids, month: input.month, year: input.year, allowLate: true }, userId);
                await prisma.auditLog.createMany({ data: g.ids.map((id) => ({ action: 'SOD_INVOICED', entity: 'ServiceOrder', entityId: id, userId, newValue: { invoiceNumber: res.invoice.invoiceNumber, billingMonth: `${input.month}/${input.year}` } })) });
                await InvoiceGateService.startFor(res.invoice.id, 'Invoice created');
                created.push({ ...label, invoiceNumber: res.invoice.invoiceNumber, total: res.totalGrossAmount });
            } catch (e) {
                created.push({ ...label, error: e instanceof Error ? e.message : 'The invoice could not be created' });
            }
        }
        return { created, blocked, notEligible };
    }

    /** The latest invoices of the engineer's area and where each one waits (the engineer has no step on them, but follows them). */
    static async recentInvoices(userId: string, limit = 30) {
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope !== undefined && scope.length === 0) return [];
        const rows = await prisma.invoice.findMany({
            where: { sods: { some: {} }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
            orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, invoiceNumber: true, month: true, year: true, totalAmount: true, status: true, confirmStage: true, createdAt: true, contractor: { select: { name: true } }, opmc: { select: { rtom: true } }, _count: { select: { sods: true } } },
        });
        return rows.map((r) => ({ id: r.id, invoiceNumber: r.invoiceNumber, month: r.month, year: r.year, total: num(r.totalAmount), status: r.status, stage: stageLabel(r.confirmStage), createdAt: r.createdAt, contractor: r.contractor?.name ?? '-', area: r.opmc?.rtom ?? '-', orders: r._count.sods }));
    }

    /** Hold orders back from invoicing (a problem). They stay ready, are listed apart, and are billed when released. */
    static async hold(userId: string, sodIds: string[], reason: string) {
        const why = reason.trim();
        if (why.length < 3) throw AppError.badRequest('A reason is required');
        const scope = await resolveOpmcScope(userId, 'finance');
        const r = await prisma.serviceOrder.updateMany({
            where: { id: { in: [...new Set(sodIds)] }, invoiced: false, sodApprovalStage: { in: [...SOD_READY_STAGES] }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
            data: { invoicingHeldAt: new Date(), invoicingHoldReason: why },
        });
        if (r.count > 0) await prisma.auditLog.createMany({ data: sodIds.map((id) => ({ action: 'SOD_HELD_FROM_INVOICING', entity: 'ServiceOrder', entityId: id, userId, newValue: { reason: why } })) });
        return { held: r.count };
    }

    static async release(userId: string, sodIds: string[]) {
        const scope = await resolveOpmcScope(userId, 'finance');
        const r = await prisma.serviceOrder.updateMany({
            where: { id: { in: [...new Set(sodIds)] }, invoiced: false, invoicingHeldAt: { not: null }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
            data: { invoicingHeldAt: null, invoicingHoldReason: null },
        });
        return { released: r.count };
    }

    /** Orders that have a problem go back to the Area Coordinator (the whole chain again). */
    static async returnToCoordinator(userId: string, sodIds: string[], reason: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        return SodApprovalService.returnReady(sodIds, userId, reason, scope, 'engineer');
    }
}
