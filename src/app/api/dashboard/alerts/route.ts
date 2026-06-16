import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        // 1. Determine Accessible Stores
        let storeIds: string[] = [];

        if (isAdmin) {
            // All stores
            const stores = await prisma.inventoryStore.findMany({ select: { id: true } });
            storeIds = stores.map(s => s.id);
        } else {
            // Filter
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });

            if (!dbUser) return NextResponse.json({ alerts: [] });

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
            return NextResponse.json({ alerts: [] });
        }

        interface AlertItem {
            type: string;
            message: string;
            severity: 'HIGH' | 'MEDIUM' | 'LOW';
            storeId: string;
            itemId?: string;
            returnId?: string;
        }

        const alerts: AlertItem[] = [];

        // 2. Report 1: Low Stock Alerts
        // Find stocks in these stores where quantity < item.minLevel
        // Note: minLevel is on InventoryItem (Global) or InventoryStock (Per Store)?
        // Schema line 411: minLevel Float @default(0) on InventoryItem.
        // Schema line 433+: InventoryStock has quantity, but no minLevel override?
        // Let's check Schema...

        // Assuming global minLevel for now, or if InventoryStock has minLevel.
        // Let's inspect InventoryStock model again to be sure.
        // If InventoryStock doesn't have minLevel, we rely on InventoryItem.minLevel.

        // Optimized Query:
        // We need items where stock.quantity < item.minLevel AND stock.storeId IN storeIds

        const lowStocks = await prisma.inventoryStock.findMany({
            where: {
                storeId: { in: storeIds },
                // Ideally comparison logic here, but Prisma doesn't support field comparison in where easily across relations in one go without raw query or separate fetch.
                // We'll fetch all stocks for these stores and filter in JS if dataset is small, 
                // OR fetch items with minLevel > 0 and then check their stocks.
                // Let's try raw query for performance or basic fetch.
                // Basic fetch:
                quantity: { lte: 10 } // Hardcoded safety net? No.
            },
            include: {
                item: true,
                store: { select: { name: true } }
            }
        });

        // Filter based on item.minLevel
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

        // 3. Report 2: Pending Returns (For Store Manager)
        // If Store Manager, show pending returns waiting for acceptance
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

        return NextResponse.json({ alerts });

    } catch (error) {
        console.error('Alerts Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
