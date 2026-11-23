import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { StoreService } from '@/services/inventory/store.service';

export interface ApprovalRow { id: string; ref: string; store: string; by: string; at: string; detail: string; own: boolean; ageDays: number }
export interface InventoryApprovalQueue {
    requests: ApprovalRow[];
    mrns: ApprovalRow[];
    wastage: ApprovalRow[];
    stockTakes: ApprovalRow[];
    totals: { requests: number; mrns: number; wastage: number; stockTakes: number; all: number };
}

const LIMIT = 50;
const days = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));

/**
 * Everything of the stores that waits for an approval, in one place: material requests, returns to the supplier (MRN), contractor wastage and stock-take variances.
 * For the Stores Manager and the Executive (the deputy). What the person raised is marked, because nobody approves their own.
 */
export class InventoryApprovalQueueService {
    static async forUser(userId: string): Promise<InventoryApprovalQueue> {
        const global = (await resolveOpmcScope(userId, 'inventory')) === undefined;
        const storeIds = global ? undefined : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        const inStores = (field: string) => (storeIds ? { [field]: { in: storeIds } } : {});

        const [reqs, mrns, was, cc] = await Promise.all([
            prisma.stockRequest.findMany({
                where: { status: 'PENDING', ...(storeIds ? { OR: [{ fromStoreId: { in: storeIds } }, { toStoreId: { in: storeIds } }] } : {}) },
                select: { id: true, requestNr: true, workflowStage: true, createdAt: true, requestedById: true, fromStore: { select: { name: true } }, requestedBy: { select: { name: true } }, items: { select: { id: true } } },
                orderBy: { createdAt: 'asc' }, take: LIMIT,
            }),
            prisma.mRN.findMany({
                where: { status: 'PENDING', ...inStores('storeId') },
                select: { id: true, mrnNumber: true, returnType: true, createdAt: true, returnedById: true, store: { select: { name: true } }, returnedBy: { select: { name: true } }, items: { select: { id: true } } },
                orderBy: { createdAt: 'asc' }, take: LIMIT,
            }),
            prisma.contractorWastage.findMany({
                where: { status: 'PENDING', ...inStores('storeId') },
                select: { id: true, createdAt: true, reportedById: true, description: true, month: true, store: { select: { name: true } }, contractor: { select: { name: true } }, items: { select: { id: true } } },
                orderBy: { createdAt: 'asc' }, take: LIMIT,
            }),
            prisma.cycleCountHeader.findMany({
                where: { status: 'PENDING_APPROVAL', ...inStores('storeId') },
                select: { id: true, countNumber: true, createdAt: true, countedById: true, store: { select: { name: true } }, countedBy: { select: { name: true } }, lines: { select: { id: true } } },
                orderBy: { createdAt: 'asc' }, take: LIMIT,
            }),
        ]);

        const requests = reqs.map((r): ApprovalRow => ({ id: r.id, ref: r.requestNr, store: r.fromStore?.name ?? '-', by: r.requestedBy?.name ?? '-', at: r.createdAt.toISOString(), detail: `${r.items.length} line(s), waiting at ${r.workflowStage}`, own: r.requestedById === userId, ageDays: days(r.createdAt) }));
        const mrnRows = mrns.map((m): ApprovalRow => ({ id: m.id, ref: m.mrnNumber, store: m.store?.name ?? '-', by: m.returnedBy?.name ?? '-', at: m.createdAt.toISOString(), detail: `${m.items.length} line(s), return to ${m.returnType}`, own: m.returnedById === userId, ageDays: days(m.createdAt) }));
        const wastage = was.map((w): ApprovalRow => ({ id: w.id, ref: `Wastage ${w.month}`, store: w.store?.name ?? '-', by: w.contractor?.name ?? '-', at: w.createdAt.toISOString(), detail: `${w.items.length} line(s), contractor ${w.contractor?.name ?? ''}`, own: w.reportedById === userId, ageDays: days(w.createdAt) }));
        const stockTakes = cc.map((c): ApprovalRow => ({ id: c.id, ref: c.countNumber, store: c.store?.name ?? '-', by: c.countedBy?.name ?? '-', at: c.createdAt.toISOString(), detail: `${c.lines.length} counted line(s), variance to approve`, own: c.countedById === userId, ageDays: days(c.createdAt) }));
        const totals = { requests: requests.length, mrns: mrnRows.length, wastage: wastage.length, stockTakes: stockTakes.length, all: requests.length + mrnRows.length + wastage.length + stockTakes.length };
        return { requests, mrns: mrnRows, wastage, stockTakes, totals };
    }
}
