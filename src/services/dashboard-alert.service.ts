import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface AlertItem {
    type: string;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    storeId: string;
    itemId?: string;
    returnId?: string;
}

export class DashboardAlertService {
    static async getDashboardAlerts(userId: string, userRole: string): Promise<{ alerts: AlertItem[] }> {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        let storeIds: string[] = [];

        if (isAdmin) {
            const stores = await prisma.inventoryStore.findMany({ select: { id: true } });
            storeIds = stores.map(s => s.id);
        } else {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });

            if (!dbUser) return { alerts: [] };

            const accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);
            const baseWhere = {
                OR: [
                    { managerId: userId },
                    { opmcs: { some: { id: { in: accessibleOpmcIds } } } }
                ]
            };

            let whereClause: any = baseWhere;
            const isStoreStaff = userRole === 'STORES_MANAGER' || userRole === 'STORES_ASSISTANT';

            if (isStoreStaff) {
                const hasMainAccess = await prisma.inventoryStore.findFirst({
                    where: { ...baseWhere, type: 'MAIN' },
                    select: { id: true }
                });
                if (hasMainAccess) {
                    whereClause = {}; // All
                }
            }

            const stores = await prisma.inventoryStore.findMany({
                where: whereClause,
                select: { id: true }
            });
            storeIds = stores.map(s => s.id);
        }

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
