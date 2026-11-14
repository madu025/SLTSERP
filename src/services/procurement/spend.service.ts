import { prisma } from '@/lib/prisma';
import { StoreService } from '@/services/inventory/store.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { committedValue } from '@/lib/procurement-rules';

const OPEN_PROJECT_PO = ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'];
const SPEND_PROJECT_PO = ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'];
/**
 * Store purchase orders raised before this date did not track what was received per order line (goods receipts were only
 * checked against the stock request), so their balance is unknown and they are left out of the commitment figure instead
 * of being counted as fully outstanding.
 */
export const STORE_PO_TRACKING_START = new Date('2026-11-15T00:00:00Z');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SpendReport {
    asOf: string;
    monthly: { label: string; project: number; store: number }[];
    byExpenditure: { type: string; amount: number }[];
    committed: { store: number; project: number; total: number; openOrders: number; topProjects: { projectId: string; name: string; committed: number }[] };
    totalSpend6m: number;
}

export interface CommitmentRisk { projectId: string; name: string; budget: number; actual: number; committed: number }

/**
 * Procurement spend and commitment. Spend is every order that has been approved or beyond (store orders that are not
 * cancelled); committed is what is ordered but not yet received, at the order price. Callers only see their own stores
 * and the projects in their OPMC scope.
 */
export class SpendService {
    static async getSpend(userId: string | null, now = new Date()): Promise<SpendReport> {
        const scope = userId === null ? undefined : await resolveOpmcScope(userId);
        const storeIds = userId === null ? null : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
        const projectScope = scope === undefined ? {} : { project: { opmcId: { in: scope } } };
        const storeScope = storeIds === null ? {} : { stockRequest: { OR: [{ fromStoreId: { in: storeIds } }, { toStoreId: { in: storeIds } }] } };

        const [projectPos, storePos, openProject, openStore] = await Promise.all([
            prisma.projectPurchaseOrder.findMany({ where: { status: { in: SPEND_PROJECT_PO }, orderDate: { gte: since }, ...projectScope }, select: { orderDate: true, totalAmount: true, expenditureType: true } }),
            prisma.purchaseOrder.findMany({ where: { status: { not: 'CANCELLED' }, orderDate: { gte: since }, ...storeScope }, select: { orderDate: true, totalAmount: true } }),
            prisma.projectPurchaseOrder.findMany({ where: { status: { in: OPEN_PROJECT_PO }, ...projectScope }, select: { projectId: true, project: { select: { name: true } }, items: { select: { quantity: true, receivedQty: true, unitPrice: true } } } }),
            prisma.purchaseOrder.findMany({ where: { status: { notIn: ['CANCELLED', 'CLOSED', 'RECEIVED', 'COMPLETED'] }, createdAt: { gte: STORE_PO_TRACKING_START }, ...storeScope }, select: { items: { select: { quantity: true, receivedQty: true, unitPrice: true } } } }),
        ]);

        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
            return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], project: 0, store: 0 };
        });
        const slot = (d: Date) => months.find((m) => m.key === d.toISOString().slice(0, 7));
        const expenditure = new Map<string, number>();
        for (const po of projectPos) {
            const m = slot(po.orderDate);
            if (m) m.project += Number(po.totalAmount);
            expenditure.set(po.expenditureType, (expenditure.get(po.expenditureType) ?? 0) + Number(po.totalAmount));
        }
        let storeSpend = 0;
        for (const po of storePos) {
            const m = slot(po.orderDate);
            if (m) m.store += Number(po.totalAmount);
            storeSpend += Number(po.totalAmount);
        }
        if (storeSpend > 0) expenditure.set('STORES', storeSpend);

        const num = (items: { quantity: unknown; receivedQty: unknown; unitPrice: unknown }[]) => committedValue(items.map((i) => ({ quantity: Number(i.quantity), receivedQty: Number(i.receivedQty), unitPrice: Number(i.unitPrice) })));
        const byProject = new Map<string, { name: string; committed: number }>();
        let project = 0;
        for (const po of openProject) {
            const v = num(po.items);
            project += v;
            const cur = byProject.get(po.projectId) ?? { name: po.project.name, committed: 0 };
            cur.committed += v;
            byProject.set(po.projectId, cur);
        }
        const store = openStore.reduce((a, po) => a + num(po.items), 0);

        return {
            asOf: now.toISOString(),
            monthly: months.map(({ label, project: p, store: s }) => ({ label, project: Math.round(p), store: Math.round(s) })),
            byExpenditure: [...expenditure.entries()].map(([type, amount]) => ({ type, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount),
            committed: {
                store: Math.round(store), project: Math.round(project), total: Math.round(store + project), openOrders: openProject.length + openStore.length,
                topProjects: [...byProject.entries()].map(([projectId, v]) => ({ projectId, name: v.name, committed: Math.round(v.committed) })).sort((a, b) => b.committed - a.committed).slice(0, 5),
            },
            totalSpend6m: Math.round(months.reduce((a, m) => a + m.project + m.store, 0)),
        };
    }

    /** Projects whose actual cost plus open orders exceed their budget (company-wide view for management). */
    static async commitmentRisk(): Promise<CommitmentRisk[]> {
        const open = await prisma.projectPurchaseOrder.findMany({
            where: { status: { in: OPEN_PROJECT_PO } },
            select: { projectId: true, items: { select: { quantity: true, receivedQty: true, unitPrice: true } } },
        });
        const committed = new Map<string, number>();
        for (const po of open) committed.set(po.projectId, (committed.get(po.projectId) ?? 0) + committedValue(po.items.map((i) => ({ quantity: Number(i.quantity), receivedQty: Number(i.receivedQty), unitPrice: Number(i.unitPrice) }))));
        if (committed.size === 0) return [];
        const projects = await prisma.project.findMany({ where: { id: { in: [...committed.keys()] }, budget: { gt: 0 }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, select: { id: true, name: true, budget: true, actualCost: true } });
        return projects
            .map((p) => ({ projectId: p.id, name: p.name, budget: Number(p.budget), actual: Number(p.actualCost), committed: Math.round(committed.get(p.id) ?? 0) }))
            .filter((r) => r.actual + r.committed > r.budget && r.committed > 0)
            .sort((a, b) => (b.actual + b.committed - b.budget) - (a.actual + a.committed - a.budget));
    }
}
