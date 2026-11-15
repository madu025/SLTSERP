import { prisma } from '@/lib/prisma';
import { StoreService } from '@/services/inventory/store.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { unifiedPoStatus } from '@/lib/procurement-rules';

export interface UnifiedPo {
    kind: 'STORE' | 'PROJECT';
    id: string;
    poNumber: string;
    vendorId: string | null;
    vendorName: string;
    status: string;
    rawStatus: string;
    total: number;
    currency: string;
    orderDate: string;
    expectedDelivery: string | null;
    /** The store request or project the order belongs to */
    scopeLabel: string;
    href: string;
    /** An invoice can be entered for it: it has a vendor record and has been issued or received against */
    invoiceable: boolean;
}

/**
 * One purchase-order list over the two tables (stock purchases and project purchases), with one status vocabulary:
 * pending approval, approved, issued, partially received, received, closed, cancelled (project drafts show as draft).
 * Each caller only sees the stores they can access and the projects in their OPMC scope.
 */
export class UnifiedPoService {
    static async list(userId: string, filter: { kind?: 'STORE' | 'PROJECT'; status?: string } = {}): Promise<UnifiedPo[]> {
        const scope = await resolveOpmcScope(userId);
        const storeIds = filter.kind === 'PROJECT' ? [] : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        const [store, project] = await Promise.all([
            filter.kind === 'PROJECT' ? [] : prisma.purchaseOrder.findMany({
                where: { stockRequest: { OR: [{ fromStoreId: { in: storeIds } }, { toStoreId: { in: storeIds } }] } },
                orderBy: { createdAt: 'desc' }, take: 300,
                select: { id: true, poNumber: true, vendorId: true, vendor: true, status: true, totalAmount: true, currency: true, orderDate: true, expectedDelivery: true, stockRequest: { select: { requestNr: true } } },
            }),
            filter.kind === 'STORE' ? [] : prisma.projectPurchaseOrder.findMany({
                where: scope === undefined ? {} : { project: { opmcId: { in: scope } } },
                orderBy: { createdAt: 'desc' }, take: 300,
                select: { id: true, poNumber: true, vendorId: true, vendorName: true, status: true, totalAmount: true, currency: true, orderDate: true, expectedDelivery: true, projectId: true, project: { select: { name: true } } },
            }),
        ]);

        const rows: UnifiedPo[] = [
            ...store.map((p) => {
                const status = unifiedPoStatus('STORE', p.status);
                return { kind: 'STORE' as const, id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, vendorName: p.vendor, status, rawStatus: p.status, total: Number(p.totalAmount), currency: p.currency, orderDate: p.orderDate.toISOString(), expectedDelivery: p.expectedDelivery ? p.expectedDelivery.toISOString() : null, scopeLabel: p.stockRequest.requestNr, href: '/procurement/orders', invoiceable: !!p.vendorId && ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(status) };
            }),
            ...project.map((p) => {
                const status = unifiedPoStatus('PROJECT', p.status);
                return { kind: 'PROJECT' as const, id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, vendorName: p.vendorName, status, rawStatus: p.status, total: Number(p.totalAmount), currency: p.currency, orderDate: p.orderDate.toISOString(), expectedDelivery: p.expectedDelivery ? p.expectedDelivery.toISOString() : null, scopeLabel: p.project.name, href: `/projects/${p.projectId}`, invoiceable: ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(status) };
            }),
        ];
        return rows.filter((r) => !filter.status || r.status === filter.status).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
    }
}
