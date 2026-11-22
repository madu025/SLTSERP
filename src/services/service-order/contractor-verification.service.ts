import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { SodApprovalService } from '@/services/service-order/sod-approval.service';
import { SOD_READY_STAGES } from '@/lib/sod-approval-rules';

const MAX_ORDERS = 500;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

async function contractorOf(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { contractorId: true, status: true } });
    if (!u || u.status !== 'active' || !u.contractorId) throw AppError.forbidden('Only a contractor user can verify orders');
    return u.contractorId;
}

/**
 * The contractor's step between the Completed SOD check and the engineer's invoicing. The contractor sees the orders its own team did that
 * the Area Coordinator / QC Officer passed, and verifies them or reports a problem; a reported order goes back to the check with the note.
 */
export class ContractorVerificationService {
    static async list(userId: string) {
        const contractorId = await contractorOf(userId);
        const orders = await prisma.serviceOrder.findMany({
            where: { contractorId, invoiced: false, sodApprovalStage: { in: [...SOD_READY_STAGES] }, contractorVerifiedAt: null },
            orderBy: [{ completedDate: 'asc' }, { soNum: 'asc' }], take: MAX_ORDERS,
            select: {
                id: true, soNum: true, rtom: true, customerName: true, completedDate: true, contractorAmount: true,
                materialUsage: { select: { quantity: true, unit: true, item: { select: { name: true } } } },
            },
        });
        return orders.map((o) => ({
            id: o.id, soNum: o.soNum, rtom: o.rtom, customerName: o.customerName, completedDate: o.completedDate, contractorAmount: num(o.contractorAmount),
            material: o.materialUsage.map((m) => `${m.item?.name ?? '-'} × ${num(m.quantity)} ${m.unit}`),
        }));
    }

    static async verify(userId: string, sodIds: string[]) {
        const contractorId = await contractorOf(userId);
        const ids = [...new Set(sodIds)];
        if (ids.length === 0) throw AppError.badRequest('Select at least one order');
        if (ids.length > MAX_ORDERS) throw AppError.badRequest(`Verify at most ${MAX_ORDERS} orders at a time`);
        const r = await prisma.serviceOrder.updateMany({
            where: { id: { in: ids }, contractorId, invoiced: false, sodApprovalStage: { in: [...SOD_READY_STAGES] }, contractorVerifiedAt: null },
            data: { contractorVerifiedAt: new Date(), contractorVerifiedById: userId },
        });
        if (r.count > 0) await prisma.auditLog.createMany({ data: ids.map((id) => ({ action: 'SOD_VERIFIED_BY_CONTRACTOR', entity: 'ServiceOrder', entityId: id, userId, newValue: { contractorId } })) });
        return { verified: r.count, skipped: ids.length - r.count };
    }

    /** A problem with the orders (a wrong material, a missing item, a wrong customer): they go back to the Area Coordinator / QC Officer check. */
    static async report(userId: string, sodIds: string[], note: string) {
        const contractorId = await contractorOf(userId);
        const why = note.trim();
        if (why.length < 3) throw AppError.badRequest('Write what is wrong with the order');
        const mine = await prisma.serviceOrder.findMany({ where: { id: { in: [...new Set(sodIds)] }, contractorId, invoiced: false, sodApprovalStage: { in: [...SOD_READY_STAGES] } }, select: { id: true } });
        if (mine.length === 0) throw AppError.badRequest('None of these orders can be reported');
        const r = await SodApprovalService.returnReady(mine.map((o) => o.id), userId, why, undefined, 'contractor');
        return { returned: r.returned };
    }
}
