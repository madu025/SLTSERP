import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { NIL_UUID } from '@/lib/opmc-scope';
import { Prisma } from '@prisma/client';

interface AlertItem {
    type: string;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    storeId: string;
    itemId?: string;
    returnId?: string;
}

export class DashboardAlertService {
    static async getDashboardAlerts(userId: string): Promise<{ alerts: AlertItem[] }> {
        const accessibleOpmcScope = await resolveOpmcScope(userId);
        const storeWhere: Prisma.InventoryStoreWhereInput = accessibleOpmcScope === undefined
            ? {}
            : accessibleOpmcScope.length > 0
                ? { opmcs: { some: { id: { in: accessibleOpmcScope } } } }
                : { id: NIL_UUID };

        const stores = await prisma.inventoryStore.findMany({
            where: storeWhere,
            select: { id: true }
        });
        const storeIds = stores.map(s => s.id);

        if (storeIds.length === 0) {
            return { alerts: [] };
        }

        const alerts: AlertItem[] = [];

        const lowStocks = await prisma.inventoryStock.findMany({
            where: {
                storeId: { in: storeIds },
                quantity: { lte: 10 }
            },
            include: {
                item: true,
                store: { select: { name: true } }
            }
        });

        lowStocks.forEach(stock => {
            if (stock.quantity <= stock.item.minLevel) {
                alerts.push({
                    type: 'LOW_STOCK',
                    message: `Low Stock: ${stock.item.name} (${stock.quantity} ${stock.item.unit}) at ${stock.store.name}`,
                    severity: 'HIGH',
                    storeId: stock.storeId,
                    itemId: stock.item.id
                });
            }
        });

        const pendingReturns = await prisma.contractorMaterialReturn.findMany({
            where: {
                storeId: { in: storeIds },
                status: 'PENDING'
            },
            include: {
                contractor: { select: { name: true } },
                store: { select: { name: true } }
            }
        });

        pendingReturns.forEach(ret => {
            alerts.push({
                type: 'PENDING_RETURN',
                message: `Pending Return from ${ret.contractor.name} at ${ret.store.name}`,
                severity: 'MEDIUM',
                storeId: ret.storeId,
                returnId: ret.id
            });
        });

        return { alerts };
    }
}
